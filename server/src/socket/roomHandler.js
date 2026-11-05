import { Room } from '../models/Room.js';
import { Participant } from '../models/Participant.js';
import * as roomService from '../services/roomService.js';
import { ROLES } from '../services/permissionService.js';

export const registerRoomHandlers = (io, socket) => {
  // Join Room with Socket.IO Acknowledgement Support
  socket.on('join_room', async (data, callback) => {
    const ack = typeof callback === 'function' ? callback : () => {};

    try {
      // Security: Strictly enforce authenticated socket identity derived from JWT
      if (!socket.user || !socket.user.userId) {
        const errPayload = {
          message: 'Authentication required: You must have a verified session to join a room',
          code: 'UNAUTHORIZED',
        };
        socket.emit('error', errPayload);
        return ack({ success: false, ...errPayload });
      }

      const { roomId, hostToken } = data || {};

      if (!roomId || typeof roomId !== 'string' || !roomId.trim()) {
        const errPayload = { message: 'Missing or invalid roomId', code: 'INVALID_PARAMS' };
        socket.emit('error', errPayload);
        return ack({ success: false, ...errPayload });
      }

      // Identity is derived EXCLUSIVELY from verified JWT claims
      const userId = socket.user.userId;
      const cleanUsername = (socket.user.username || 'Anonymous').trim();

      const cleanRoomId = roomId.toUpperCase().trim();
      const room = await Room.findOne({ roomId: cleanRoomId }).select('+hostTokenHash');

      if (!room) {
        const errPayload = { message: 'Room not found', code: 'ROOM_NOT_FOUND' };
        socket.emit('error', errPayload);
        return ack({ success: false, ...errPayload });
      }

      // Check if user has been removed/banned from this room
      if (room.bannedUserIds && room.bannedUserIds.includes(userId)) {
        const errPayload = {
          message: 'You have been removed from this room and cannot rejoin.',
          code: 'USER_REMOVED',
        };
        socket.emit('error', errPayload);
        return ack({ success: false, ...errPayload });
      }

      // Check if user is attempting to join as Host
      let participant = await Participant.findOne({ roomId: cleanRoomId, userId });
      const isClaimingHost = userId === room.hostId || (participant && participant.role === ROLES.HOST);

      if (isClaimingHost) {
        const isAuthorized = room.verifyHostToken(hostToken);
        if (!isAuthorized) {
          const errPayload = {
            message: 'Host authorization failed: A valid host token is required to join as Host.',
            code: 'INVALID_HOST_TOKEN',
          };
          socket.emit('error', errPayload);
          return ack({ success: false, ...errPayload });
        }
      }

      // Check if username is already taken by another user in this room (Fix 3: Validate BEFORE socket.join)
      if (!participant) {
        const existingNameUser = await Participant.findOne({
          roomId: cleanRoomId,
          username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') },
          userId: { $ne: userId },
        });

        if (existingNameUser) {
          const errPayload = {
            message: 'Username already taken in this room.',
            code: 'USERNAME_TAKEN',
          };
          socket.emit('error', errPayload);
          return ack({ success: false, ...errPayload });
        }

        const role = (isClaimingHost && room.verifyHostToken(hostToken)) ? ROLES.HOST : ROLES.PARTICIPANT;
        participant = await Participant.create({
          userId,
          username: cleanUsername,
          roomId: cleanRoomId,
          role,
          socketId: socket.id,
          isOnline: true,
        });
      } else {
        // If updating username, check that another user in this room doesn't have it
        if (cleanUsername && participant.username.toLowerCase() !== cleanUsername.toLowerCase()) {
          const existingNameUser = await Participant.findOne({
            roomId: cleanRoomId,
            username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') },
            userId: { $ne: userId },
          });

          if (existingNameUser) {
            const errPayload = {
              message: 'Username already taken in this room.',
              code: 'USERNAME_TAKEN',
            };
            socket.emit('error', errPayload);
            return ack({ success: false, ...errPayload });
          }
          participant.username = cleanUsername;
        }

        participant.socketId = socket.id;
        participant.isOnline = true;
        await participant.save();
      }

      // Associate socket session with authenticated room & user ONLY AFTER validations succeed
      socket.join(cleanRoomId);
      socket.data.roomId = cleanRoomId;
      socket.data.userId = userId;
      socket.data.username = cleanUsername;

      const participants = await roomService.getRoomParticipants(cleanRoomId);
      const calculatedCurrentTime = room.getCalculatedCurrentTime();

      // Count distinct active users in room across all socket connections
      const socketsInRoom = await io.in(cleanRoomId).fetchSockets();
      const onlineUserIds = new Set(socketsInRoom.map((s) => s.data.userId).filter(Boolean));
      const onlineCount = onlineUserIds.size;

      const syncData = {
        room: {
          roomId: room.roomId,
          roomName: room.roomName,
          hostId: room.hostId,
          currentVideoId: room.currentVideoId,
          playbackState: room.playbackState,
          currentTime: calculatedCurrentTime,
          lastUpdated: room.lastUpdated,
        },
        myRole: participant.role,
        participants,
        pendingRequests: room.pendingRequests || [],
        videoQueue: room.videoQueue || [],
        pendingVideoRequests: room.pendingVideoRequests || [],
        onlineCount,
      };

      // Emit full sync state to connecting socket
      socket.emit('sync_state', syncData);

      // Broadcast user_joined to others in room
      socket.to(cleanRoomId).emit('user_joined', {
        user: participant,
        participants,
        onlineCount,
      });

      // Acknowledge the client's join request
      ack({
        success: true,
        data: syncData,
      });

      console.log(`[Socket] User ${participant.username} (${userId}) joined room ${cleanRoomId} as ${participant.role}`);
    } catch (err) {
      console.error('[Socket] join_room error:', err);
      const errPayload = { message: err.message || 'Failed to join room', code: 'JOIN_ERROR' };
      socket.emit('error', errPayload);
      ack({ success: false, ...errPayload });
    }
  });

  // Update Room Title (Host only)
  socket.on('update_room_title', async (data, ack = () => {}) => {
    try {
      const { roomId, userId } = socket.data || {};
      if (!roomId || !userId) {
        const errPayload = { message: 'Unauthorized: You must join a room first', code: 'UNAUTHORIZED' };
        socket.emit('error', errPayload);
        return ack({ success: false, ...errPayload });
      }

      const { roomName } = data || {};
      const updatedRoom = await roomService.updateRoomTitle({
        roomId,
        userId,
        roomName,
      });

      // Broadcast room_updated event to all clients in the room
      io.to(roomId).emit('room_updated', {
        roomId: updatedRoom.roomId,
        roomName: updatedRoom.roomName,
      });

      ack({
        success: true,
        data: {
          roomId: updatedRoom.roomId,
          roomName: updatedRoom.roomName,
        },
      });

      console.log(`[Room] Title of room ${roomId} updated to "${updatedRoom.roomName}" by Host (${userId})`);
    } catch (err) {
      console.error('[Socket] update_room_title error:', err);
      const errPayload = {
        message: err.message || 'Failed to update room title',
        code: err.statusCode === 403 ? 'FORBIDDEN' : 'UPDATE_ERROR',
      };
      socket.emit('error', errPayload);
      ack({ success: false, ...errPayload });
    }
  });

  // Leave Room. The acknowledgement is sent only after the socket has left
  // the room and its online presence has been updated in MongoDB.
  socket.on('leave_room', async (ack = () => {}) => {
    try {
      const result = await handleUserLeaving(io, socket, { explicit: true });
      if (typeof ack === 'function') ack({ success: true, data: result });
    } catch (err) {
      console.error('[Socket] Explicit leave_room error:', err);
      if (typeof ack === 'function') {
        ack({ success: false, message: 'Could not leave the room cleanly.', code: 'LEAVE_ERROR' });
      }
    }
  });

  // A disconnect follows the same cleanup path, but another open tab for the
  // same user keeps that user online in the room.
  socket.on('disconnect', async () => {
    await handleUserLeaving(io, socket, { explicit: false });
  });
};

const handleUserLeaving = async (io, socket, { explicit = false } = {}) => {
  const { roomId, userId, username } = socket.data || {};
  if (!roomId || !userId) return { left: false, roomId: null };

  // Leave first, then query the adapter. Awaiting leave also works with async
  // Socket.IO adapters (for example, when a Redis adapter is used).
  await Promise.resolve(socket.leave(roomId));
  socket.data.roomId = null;

  const remainingSockets = (await io.in(roomId).fetchSockets()).filter(
    (candidate) => candidate.id !== socket.id
  );
  const isStillConnected = remainingSockets.some((candidate) => candidate.data.userId === userId);

  if (!isStillConnected && Participant.db.readyState === 1) {
    await Participant.updateOne(
      { roomId, userId },
      { $set: { isOnline: false, socketId: null } }
    );

    const participants = await roomService.getRoomParticipants(roomId);
    const onlineUserIds = new Set(remainingSockets.map((candidate) => candidate.data.userId).filter(Boolean));

    // Broadcast to the remaining room members after the departing user is no
    // longer part of the active roster.
    io.to(roomId).emit('user_left', {
      userId,
      username,
      participants,
      onlineCount: onlineUserIds.size,
      reason: explicit ? 'left' : 'disconnected',
    });
    console.log(`[Socket] User ${username} (${userId}) left room ${roomId}`);
  } else if (isStillConnected) {
    console.log(`[Socket] User ${username} (${userId}) closed one tab but remains online in room ${roomId}`);
  }

  return { left: true, roomId, stillConnected: isStillConnected };
};
