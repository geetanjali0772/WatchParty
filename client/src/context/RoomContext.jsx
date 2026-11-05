import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getSocket, disconnectSocket } from '../services/socket';
import { createSession, getRoomMessages, updateRoomTitle } from '../services/api';

const RoomContext = createContext(null);

const USER_STORAGE_KEY = 'watchparty_user_session';

export const RoomProvider = ({ children }) => {
  // Initialize user identity from localStorage (metadata only, no sensitive tokens)
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(USER_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { userId: null, username: '' };
  });

  // Socket callbacks are long-lived. Keep the current identity/session callback
  // in refs so events never compare roles against a stale render after refresh.
  const liveStateRef = useRef({});
  const socketListenersBoundRef = useRef(new WeakSet());

  const updateUsername = useCallback((name) => {
    setUser((prev) => {
      const updated = { ...prev, username: name.trim() };
      try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, []);

  // Ensure authenticated session exists (backend signs identity into secure HttpOnly cookie)
  const ensureSession = useCallback(async (preferredUsername, forceRefresh = false) => {
    const usernameToUse = (preferredUsername || user.username || 'Guest').trim();
    if (!forceRefresh && user.userId && user.username === usernameToUse) {
      return { user };
    }

    try {
      const res = await createSession({ username: usernameToUse });
      if (res.success && res.data) {
        const receivedUser = res.data.user;
        setUser(receivedUser);
        try {
          // Strictly store only user profile metadata in localStorage, NEVER the JWT
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(receivedUser));
        } catch (e) {}
        return { user: receivedUser };
      }
    } catch (err) {
      console.warn('Session creation warning:', err);
    }
    return { user };
  }, [user]);

  liveStateRef.current = {
    userId: user?.userId || null,
    username: user?.username || '',
    ensureSession,
  };

  const getStoredHostToken = useCallback((rId) => {
    if (!rId) return null;
    try {
      return localStorage.getItem(`watchparty_host_token_${rId.toUpperCase()}`) || null;
    } catch (e) {
      return null;
    }
  }, []);

  const storeHostToken = useCallback((rId, hostTok) => {
    if (!rId || !hostTok) return;
    try {
      localStorage.setItem(`watchparty_host_token_${rId.toUpperCase()}`, hostTok);
    } catch (e) {}
  }, []);

  // Room state
  const [roomId, setRoomIdState] = useState(null);
  const roomIdRef = useRef(null);

  const setRoomId = useCallback((id) => {
    const cleanId = id ? id.toUpperCase().trim() : null;
    roomIdRef.current = cleanId;
    setRoomIdState(cleanId);
  }, []);

  const [roomName, setRoomName] = useState('');
  const [hostId, setHostId] = useState(null);
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const [playbackState, setPlaybackState] = useState('paused');
  const [currentTime, setCurrentTime] = useState(0);
  const [myRole, setMyRole] = useState('Participant');
  const [participants, setParticipants] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [videoQueue, setVideoQueue] = useState([]);
  const [pendingVideoRequests, setPendingVideoRequests] = useState([]);
  const [onlineCount, setOnlineCount] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const [notification, setNotification] = useState(null);
  const [kickedOut, setKickedOut] = useState(false);

  // Bonus Features State: Chat & Reactions
  const [messages, setMessages] = useState([]);
  const [activeReactions, setActiveReactions] = useState([]);

  // Sync event counter to force video player alignment when events arrive
  const [syncTimestamp, setSyncTimestamp] = useState(Date.now());
  const [seekCommand, setSeekCommand] = useState(null);

  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type, id: Date.now() });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  // Load chat messages from REST API with ID deduplication
  const loadMessages = useCallback(async (rId) => {
    if (!rId) return;
    try {
      const res = await getRoomMessages(rId);
      if (res.success && Array.isArray(res.data)) {
        setMessages((prev) => {
          const map = new Map();
          for (const m of prev) {
            const key = m._id || m.id || `${m.timestamp}-${m.content}`;
            map.set(key, m);
          }
          for (const m of res.data) {
            const key = m._id || m.id || `${m.timestamp}-${m.content}`;
            map.set(key, m);
          }
          return Array.from(map.values()).sort(
            (a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp)
          );
        });
      }
    } catch (err) {
      console.error('Failed to load room messages:', err);
    }
  }, []);

  // Apply one authoritative room snapshot from join/reconnect acknowledgements.
  const applyRoomSnapshot = useCallback((snapshot) => {
    if (!snapshot) return;
    const room = snapshot.room;
    if (room) {
      if (room.roomId) setRoomId(room.roomId);
      setRoomName(room.roomName || '');
      setHostId(room.hostId || null);
      setCurrentVideoId(room.currentVideoId || null);
      setPlaybackState(room.playbackState || 'paused');
      setCurrentTime(Number.isFinite(Number(room.currentTime)) ? Number(room.currentTime) : 0);
    }

    if (Array.isArray(snapshot.participants)) {
      setParticipants(snapshot.participants);
      const self = snapshot.participants.find((participant) => participant.userId === liveStateRef.current.userId);
      if (self?.role) setMyRole(self.role);
    }
    if (snapshot.myRole) setMyRole(snapshot.myRole);
    if (Array.isArray(snapshot.pendingRequests)) setPendingRequests(snapshot.pendingRequests);
    if (Array.isArray(snapshot.videoQueue)) setVideoQueue(snapshot.videoQueue);
    if (Array.isArray(snapshot.pendingVideoRequests)) setPendingVideoRequests(snapshot.pendingVideoRequests);
    if (typeof snapshot.onlineCount === 'number') setOnlineCount(snapshot.onlineCount);
    // A seek command belongs to the previous room/session; never replay it
    // against a newly joined room after navigation or reconnect.
    setSeekCommand(null);
    setSyncTimestamp(Date.now());
  }, [setRoomId]);

  // Socket event listeners are registered once per Socket.IO instance. Do not
  // removeAllListeners() during a room join: it also removes listeners owned by
  // other hooks and used to make role/reconnect events unreliable.
  const initSocketListeners = useCallback((socket) => {
    if (!socket || socketListenersBoundRef.current.has(socket)) {
      if (socket?.connected) setIsConnected(true);
      return;
    }
    socketListenersBoundRef.current.add(socket);

    if (socket.connected) setIsConnected(true);

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket] Connected with id:', socket.id);

      // A fresh socket must rejoin the last active room before using its events.
      const activeRoom = roomIdRef.current;
      if (!activeRoom) return;
      const hostToken = getStoredHostToken(activeRoom);
      socket.emit('join_room', { roomId: activeRoom, hostToken }, (res) => {
        if (res?.success && res.data) {
          applyRoomSnapshot(res.data);
          loadMessages(activeRoom);
        } else if (res && !res.success) {
          showNotification(res.message || 'Could not restore the room connection.', 'error');
        }
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Socket] Disconnected');
    });

    socket.on('sync_state', (data) => {
      applyRoomSnapshot(data);
    });

    socket.on('room_updated', (data) => {
      if (data && data.roomName) {
        setRoomName(data.roomName);
        showNotification(`Room title updated to "${data.roomName}"`, 'info');
      }
    });

    socket.on('user_joined', (data) => {
      if (Array.isArray(data.participants)) setParticipants(data.participants);
      if (typeof data.onlineCount === 'number') setOnlineCount(data.onlineCount);
      if (data.user && data.user.userId !== liveStateRef.current.userId) {
        showNotification(`${data.user.username} joined the party! 🎉`, 'info');
      }
    });

    socket.on('user_left', (data) => {
      if (Array.isArray(data.participants)) setParticipants(data.participants);
      if (typeof data.onlineCount === 'number') setOnlineCount(data.onlineCount);
      if (data.username && data.userId !== liveStateRef.current.userId) {
        showNotification(`${data.username} left the room.`, 'info');
      }
    });

    socket.on('playback_updated', (data) => {
      if (data.playbackState) setPlaybackState(data.playbackState);
      if (typeof data.currentTime === 'number') setCurrentTime(data.currentTime);
      setSyncTimestamp(Date.now());
      if (data.updatedBy && data.updatedBy.userId !== liveStateRef.current.userId) {
        const actionVerb = data.playbackState === 'playing' ? 'resumed' : 'paused';
        showNotification(`${data.updatedBy.username} ${actionVerb} the video.`, 'info');
      }
    });

    socket.on('seek_applied', (data) => {
      const targetTime = Number(data?.currentTime);
      if (!Number.isFinite(targetTime) || targetTime < 0) return;

      if (data.playbackState) setPlaybackState(data.playbackState);
      if (Object.prototype.hasOwnProperty.call(data, 'currentVideoId')) {
        setCurrentVideoId(data.currentVideoId || null);
      }
      setCurrentTime(targetTime);
      setSeekCommand({
        seekId: data.seekId || `${data.requestId || 'approved'}:${Date.now()}`,
        requestId: data.requestId || null,
        requestedByUserId: data.requestedByUserId || null,
        currentTime: targetTime,
        currentVideoId: data.currentVideoId || null,
        playbackState: data.playbackState || 'paused',
        issuedAt: Date.now(),
      });
      setSyncTimestamp(Date.now());
    });

    socket.on('video_changed', (data) => {
      if (Object.prototype.hasOwnProperty.call(data, 'currentVideoId')) {
        setCurrentVideoId(data.currentVideoId || null);
      }
      if (typeof data.currentTime === 'number') setCurrentTime(data.currentTime);
      if (data.playbackState) setPlaybackState(data.playbackState);
      setSyncTimestamp(Date.now());
      if (data.updatedBy && data.updatedBy.userId !== liveStateRef.current.userId) {
        showNotification(`${data.updatedBy.username} changed the video! 🎬`, 'info');
      }
    });

    socket.on('periodic_sync', (data) => {
      if (data.playbackState) setPlaybackState(data.playbackState);
      if (typeof data.currentTime === 'number') setCurrentTime(data.currentTime);
      if (Object.prototype.hasOwnProperty.call(data, 'currentVideoId')) {
        setCurrentVideoId(data.currentVideoId || null);
      }
      setSyncTimestamp(Date.now());
    });

    socket.on('role_assigned', (data) => {
      if (Array.isArray(data.participants)) {
        setParticipants(data.participants);
        const self = data.participants.find((participant) => participant.userId === liveStateRef.current.userId);
        if (self?.role) setMyRole(self.role);
      }
      if (data.targetUserId === liveStateRef.current.userId) {
        setMyRole(data.newRole);
        showNotification(`Your role was changed to: ${data.newRole} 🌟`, 'success');
      } else if (data.targetUsername) {
        showNotification(`${data.targetUsername} is now a ${data.newRole}.`, 'info');
      }
    });

    socket.on('host_transferred', (data) => {
      if (Array.isArray(data.participants)) {
        setParticipants(data.participants);
        const self = data.participants.find((participant) => participant.userId === liveStateRef.current.userId);
        if (self?.role) setMyRole(self.role);
      }
      if (data.newHostId) setHostId(data.newHostId);

      const currentUserId = liveStateRef.current.userId;
      if (data.newHostId === currentUserId) {
        setMyRole('Host');
        showNotification('You are now the Host of this room! 👑', 'success');
      } else if (data.previousHostId === currentUserId) {
        setMyRole('Participant');
        showNotification(`You transferred host ownership to ${data.newHostUsername || 'another participant'}.`, 'info');
      } else if (data.newHostUsername) {
        showNotification(`${data.newHostUsername} is now the Host! 👑`, 'info');
      }
      setSyncTimestamp(Date.now());
    });

    socket.on('host_promoted', (data) => {
      const activeRoom = data?.roomId || roomIdRef.current;
      if (data?.hostToken && activeRoom) {
        storeHostToken(activeRoom, data.hostToken);
        setHostId(liveStateRef.current.userId);
        setMyRole('Host');
      }
    });

    socket.on('participant_removed', (data) => {
      if (data.isTarget || data.targetUserId === liveStateRef.current.userId) {
        setKickedOut(true);
        showNotification(data.reason || 'You have been removed from the room by the Host.', 'error');
        disconnectSocket();
      } else {
        if (Array.isArray(data.participants)) setParticipants(data.participants);
        if (typeof data.onlineCount === 'number') setOnlineCount(data.onlineCount);
        if (data.targetUsername) showNotification(`${data.targetUsername} was removed from the room.`, 'warning');
      }
    });

    // Chat handlers intentionally remain the same: existing room chat behavior is preserved.
    socket.on('new_message', (data) => {
      if (data && data.message) setMessages((prev) => [...prev, data.message]);
    });

    socket.on('new_reaction', (reaction) => {
      if (reaction && reaction.emoji) {
        setActiveReactions((prev) => [...prev, reaction]);
        setTimeout(() => {
          setActiveReactions((prev) => prev.filter((item) => item.id !== reaction.id));
        }, 3500);
      }
    });

    socket.on('request_received', (data) => {
      if (Array.isArray(data.pendingRequests)) setPendingRequests(data.pendingRequests);
      if (data.request) showNotification(`${data.request.username} requested a playback change.`, 'info');
    });

    socket.on('request_approved', (data) => {
      if (Array.isArray(data.pendingRequests)) setPendingRequests(data.pendingRequests);
      showNotification(`Request approved by ${data.approvedBy?.username || 'Host'}.`, 'success');
    });

    socket.on('request_rejected', (data) => {
      if (Array.isArray(data.pendingRequests)) setPendingRequests(data.pendingRequests);
      showNotification('Request declined.', 'warning');
    });

    // Persistent watch queue and participant video suggestions.
    socket.on('queue_updated', (data) => {
      if (Array.isArray(data?.videoQueue)) setVideoQueue(data.videoQueue);
      if (Array.isArray(data?.pendingVideoRequests)) setPendingVideoRequests(data.pendingVideoRequests);
    });

    socket.on('video_request_received', (data) => {
      if (Array.isArray(data?.videoQueue)) setVideoQueue(data.videoQueue);
      if (Array.isArray(data?.pendingVideoRequests)) setPendingVideoRequests(data.pendingVideoRequests);
      if (data?.request) {
        if (data.request.userId !== liveStateRef.current.userId) {
          showNotification(`${data.request.username} suggested a video for the watch queue.`, 'info');
        }
      }
    });

    socket.on('video_request_resolved', (data) => {
      if (Array.isArray(data?.videoQueue)) setVideoQueue(data.videoQueue);
      if (Array.isArray(data?.pendingVideoRequests)) setPendingVideoRequests(data.pendingVideoRequests);
      if (data?.requesterUserId === liveStateRef.current.userId) {
        showNotification(
          data.approved
            ? 'Your video suggestion was approved and added to the queue.'
            : 'Your video suggestion was declined.',
          data.approved ? 'success' : 'warning'
        );
      } else if (data?.requestId && data?.approved) {
        showNotification('A participant video suggestion was added to the queue.', 'success');
      }
    });

    socket.on('error', (err) => {
      console.error('[Socket] Server Error event:', err);
      showNotification(err.message || 'An error occurred', 'error');
    });

    socket.on('connect_error', async (err) => {
      console.error('[Socket] Connection error:', err.message);
      if (err.message && err.message.includes('Authentication error')) {
        showNotification('Session expired. Renewing session...', 'warning');
        try {
          await liveStateRef.current.ensureSession?.(liveStateRef.current.username || 'Guest', true);
          if (!socket.connected) socket.connect();
        } catch (refreshErr) {
          showNotification('Failed to renew session. Please try joining the room again.', 'error');
        }
      } else {
        showNotification(err.message || 'Socket connection failed', 'error');
      }
    });
  }, [applyRoomSnapshot, getStoredHostToken, loadMessages, showNotification, storeHostToken]);

  // Handle session expiration detected by REST API response interceptor
  useEffect(() => {
    const handleExpired = async () => {
      showNotification('Session expired. Reconnecting...', 'warning');
      try {
        await ensureSession(user.username, true);
        const socket = getSocket();
        if (socket && !socket.connected) {
          socket.connect();
        }
      } catch (e) {
        console.error('Failed to renew session:', e);
      }
    };

    window.addEventListener('watchparty_session_expired', handleExpired);
    return () => window.removeEventListener('watchparty_session_expired', handleExpired);
  }, [ensureSession, user.username, showNotification]);

  // Connect and wait for Socket.IO before emitting the authoritative room join.
  const joinRoomChannel = useCallback(async (targetRoomId, usernameOverride, explicitHostToken) => {
    setKickedOut(false);
    const cleanRoomId = (targetRoomId || '').toUpperCase().trim();
    if (!cleanRoomId) throw new Error('Room ID is required to join');

    const nameToUse = (usernameOverride || user.username || 'Anonymous').trim();
    if (usernameOverride) updateUsername(usernameOverride);

    await ensureSession(nameToUse);

    // Register listeners before connecting so the first `connect` event cannot be missed.
    const socket = getSocket();
    initSocketListeners(socket);

    if (!socket.connected) {
      await new Promise((resolve, reject) => {
        let finished = false;
        const timeout = setTimeout(() => {
          if (finished) return;
          finished = true;
          socket.off('connect', onConnect);
          reject(new Error('Connection timed out. Please check your network and try again.'));
        }, 15000);
        const onConnect = () => {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          socket.off('connect', onConnect);
          resolve();
        };
        socket.once('connect', onConnect);
        socket.connect();
      });
    }

    const hostTokenToUse = explicitHostToken || getStoredHostToken(cleanRoomId);
    const joinData = await new Promise((resolve, reject) => {
      let finished = false;
      const timeout = setTimeout(() => {
        if (finished) return;
        finished = true;
        reject(new Error('Timed out while joining the room. Please try again.'));
      }, 12000);

      socket.emit('join_room', { roomId: cleanRoomId, hostToken: hostTokenToUse }, (res) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        if (res?.success && res.data) {
          applyRoomSnapshot(res.data);
          resolve(res.data);
        } else {
          const error = new Error(res?.message || 'Failed to join room');
          error.code = res?.code;
          reject(error);
        }
      });
    });

    // Chat history is fetched only after the server confirms socket membership.
    await loadMessages(cleanRoomId);
    return joinData;
  }, [user, updateUsername, ensureSession, initSocketListeners, getStoredHostToken, loadMessages, applyRoomSnapshot]);

  // Playback control actions
  const sendPlay = useCallback((time) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('play', { currentTime: time });
    }
  }, []);

  const sendPause = useCallback((time) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('pause', { currentTime: time });
    }
  }, []);

  const sendSeek = useCallback((time) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('seek', { currentTime: time });
    }
  }, []);

  const sendChangeVideo = useCallback((urlOrId) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('change_video', { url: urlOrId });
    }
  }, []);

  // Role management actions (Host only). Wait for server acknowledgement so
  // a failed update is visible instead of leaving the UI looking stale.
  const sendAssignRole = useCallback((targetUserId, newRole) => {
    const socket = getSocket();
    if (!socket || !socket.connected) {
      showNotification('Not connected. Role change was not sent.', 'error');
      return;
    }
    socket.emit('assign_role', { targetUserId, newRole }, (res) => {
      if (!res?.success) {
        showNotification(res?.message || 'Could not update participant role.', 'error');
      } else {
        showNotification(`Participant role updated to ${newRole}.`, 'success');
      }
    });
  }, [showNotification]);

  const sendRemoveParticipant = useCallback((targetUserId) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('remove_participant', { targetUserId });
    }
  }, []);

  const sendTransferHost = useCallback((targetUserId) => {
    const socket = getSocket();
    if (!socket || !socket.connected) {
      showNotification('Not connected. Host transfer was not sent.', 'error');
      return;
    }
    socket.emit('transfer_host', { targetUserId }, (res) => {
      if (!res?.success) {
        showNotification(res?.message || 'Could not transfer Host ownership.', 'error');
      }
    });
  }, [showNotification]);

  // Chat message action
  const sendMessage = useCallback((content) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('send_message', { content });
    }
  }, []);

  // Reaction action
  const sendReaction = useCallback((emoji) => {
    const socket = getSocket();
    if (!socket || !socket.connected) {
      showNotification('Not connected. Reaction was not sent.', 'error');
      return;
    }
    socket.emit('send_reaction', { emoji }, (res) => {
      if (!res?.success) {
        showNotification(res?.message || 'Could not send reaction.', 'error');
      }
    });
  }, [showNotification]);

  // Leave Room action. Clear the ref before waiting for the server so a
  // reconnect cannot automatically rejoin the room while the leave is pending.
  const leaveRoom = useCallback(async () => {
    const socket = getSocket();
    const activeRoomId = roomIdRef.current;
    setRoomId(null);

    try {
      if (socket?.connected && activeRoomId) {
        await new Promise((resolve) => {
          let finished = false;
          const finish = (result) => {
            if (finished) return;
            finished = true;
            window.clearTimeout(timeoutId);
            resolve(result);
          };
          const timeoutId = window.setTimeout(() => finish({ success: false, timedOut: true }), 3000);
          socket.emit('leave_room', (result) => finish(result || { success: false }));
        });
      }
    } finally {
      // The server has either confirmed the leave or the socket will be
      // disconnected, which invokes the same server-side disconnect cleanup.
      disconnectSocket();
      setIsConnected(false);
      setRoomName('');
      setHostId(null);
      setCurrentVideoId(null);
      setPlaybackState('paused');
      setCurrentTime(0);
      setMyRole('Participant');
      setParticipants([]);
      setPendingRequests([]);
      setVideoQueue([]);
      setPendingVideoRequests([]);
      setOnlineCount(0);
      setMessages([]);
      setActiveReactions([]);
      setSeekCommand(null);
      setSyncTimestamp(Date.now());
    }
  }, [setRoomId]);

  // Update room title action (Host only)
  const sendUpdateRoomTitle = useCallback(async (newRoomTitle) => {
    const trimmed = (newRoomTitle || '').trim();
    if (!trimmed) throw new Error('Room title cannot be empty');
    const currentRId = roomIdRef.current;
    if (!currentRId) throw new Error('No active room');

    const socket = getSocket();
    if (socket && socket.connected) {
      return new Promise((resolve, reject) => {
        socket.emit('update_room_title', { roomName: trimmed }, (res) => {
          if (res && res.success) {
            setRoomName(trimmed);
            showNotification('Room title updated!', 'success');
            resolve(res.data);
          } else {
            const msg = res?.message || 'Failed to update room title';
            showNotification(msg, 'error');
            reject(new Error(msg));
          }
        });
      });
    } else {
      const res = await updateRoomTitle(currentRId, { roomName: trimmed });
      if (res.success && res.data) {
        setRoomName(res.data.roomName);
        showNotification('Room title updated!', 'success');
        return res.data;
      }
    }
  }, [showNotification]);

  // Request actions (Participants submit with ack confirmation, Host/Mods review)
  const sendPlaybackRequest = useCallback((type, payload) => {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        showNotification('Not connected to server', 'error');
        return reject(new Error('Not connected to server'));
      }

      socket.emit('playback_request', { type, payload }, (res) => {
        if (res && res.success) {
          showNotification('Playback request submitted to Host & Moderators!', 'success');
          resolve(res);
        } else {
          const errMsg = res?.message || 'Failed to submit playback request';
          showNotification(errMsg, 'error');
          reject(new Error(errMsg));
        }
      });
    });
  }, [showNotification]);

  const sendApproveRequest = useCallback((requestId) => {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        const error = new Error('Not connected to server');
        showNotification(error.message, 'error');
        reject(error);
        return;
      }
      socket.emit('approve_request', { requestId }, (res) => {
        if (res?.success) {
          showNotification('Playback request approved.', 'success');
          resolve(res);
        } else {
          const error = new Error(res?.message || 'Failed to approve request');
          showNotification(error.message, 'error');
          reject(error);
        }
      });
    });
  }, [showNotification]);

  const sendRejectRequest = useCallback((requestId) => {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        const error = new Error('Not connected to server');
        showNotification(error.message, 'error');
        reject(error);
        return;
      }
      socket.emit('reject_request', { requestId }, (res) => {
        if (res?.success) {
          showNotification('Playback request rejected.', 'info');
          resolve(res);
        } else {
          const error = new Error(res?.message || 'Failed to reject request');
          showNotification(error.message, 'error');
          reject(error);
        }
      });
    });
  }, [showNotification]);

  // Queue actions share one acknowledgement path so the UI never claims a
  // queue mutation succeeded before the server has persisted it.
  const emitQueueAction = useCallback((eventName, payload, successMessage) => {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        const error = new Error('Not connected to server.');
        showNotification(error.message, 'error');
        reject(error);
        return;
      }

      socket.emit(eventName, payload || {}, (res) => {
        if (res?.success) {
          const data = res.data || {};
          if (Array.isArray(data.videoQueue)) setVideoQueue(data.videoQueue);
          if (Array.isArray(data.pendingVideoRequests)) setPendingVideoRequests(data.pendingVideoRequests);
          if (successMessage) showNotification(successMessage, 'success');
          resolve(res);
        } else {
          const error = new Error(res?.message || 'Queue action failed.');
          showNotification(error.message, 'error');
          reject(error);
        }
      });
    });
  }, [showNotification]);

  const sendAddToQueue = useCallback((url) => (
    emitQueueAction('add_to_queue', { url }, 'Video added to the watch queue.')
  ), [emitQueueAction]);

  const sendRequestQueueVideo = useCallback((url) => (
    emitQueueAction('request_queue_video', { url }, 'Video suggestion sent to the Host and Moderators.')
  ), [emitQueueAction]);

  const sendApproveVideoRequest = useCallback((requestId) => (
    emitQueueAction('approve_video_request', { requestId }, 'Video suggestion approved and added to the queue.')
  ), [emitQueueAction]);

  const sendRejectVideoRequest = useCallback((requestId) => (
    emitQueueAction('reject_video_request', { requestId }, 'Video suggestion rejected.')
  ), [emitQueueAction]);

  const sendRemoveQueueItem = useCallback((itemId) => (
    emitQueueAction('remove_from_queue', { itemId }, 'Video removed from the queue.')
  ), [emitQueueAction]);

  const sendPlayNextVideo = useCallback(() => (
    emitQueueAction('play_next_video', {}, 'Playing the next video in the queue.')
  ), [emitQueueAction]);

  const value = {
    user,
    token: null,
    updateUsername,
    ensureSession,
    roomId,
    setRoomId,
    roomName,
    setRoomName,
    hostId,
    currentVideoId,
    playbackState,
    currentTime,
    setCurrentTime,
    myRole,
    participants,
    pendingRequests,
    videoQueue,
    pendingVideoRequests,
    onlineCount,
    isConnected,
    notification,
    kickedOut,
    syncTimestamp,
    seekCommand,
    messages,
    sendMessage,
    activeReactions,
    sendReaction,
    sendTransferHost,
    leaveRoom,
    sendUpdateRoomTitle,
    joinRoomChannel,
    getStoredHostToken,
    storeHostToken,
    sendPlay,
    sendPause,
    sendSeek,
    sendChangeVideo,
    sendAssignRole,
    sendRemoveParticipant,
    sendPlaybackRequest,
    sendApproveRequest,
    sendRejectRequest,
    sendAddToQueue,
    sendRequestQueueVideo,
    sendApproveVideoRequest,
    sendRejectVideoRequest,
    sendRemoveQueueItem,
    sendPlayNextVideo,
    showNotification,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
};

export const useRoomContext = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoomContext must be used within a RoomProvider');
  }
  return context;
};
