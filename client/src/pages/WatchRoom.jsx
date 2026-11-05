import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Copy,
  Check,
  UserPlus,
  LogOut,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Film,
  Pencil,
  Share2,
  Settings,
  ListOrdered,
  Moon,
  Sun,
  Shield,
  X,
} from 'lucide-react';
import { useRoom } from '../hooks/useRoom';
import { getRoom } from '../services/api';
import VideoPlayer from '../components/VideoPlayer';
import ParticipantsList from '../components/ParticipantsList';
import RequestPanel from '../components/RequestPanel';
import ChatPanel from '../components/ChatPanel';
import WatchQueuePanel from '../components/WatchQueuePanel';

export const WatchRoom = () => {
  const { roomId: routeRoomId } = useParams();
  const navigate = useNavigate();
  const cleanRoomId = (routeRoomId || '').toUpperCase();

  const {
    user,
    updateUsername,
    ensureSession,
    roomId,
    roomName,
    setRoomName,
    currentVideoId,
    playbackState,
    currentTime,
    syncTimestamp,
    seekCommand,
    myRole,
    participants,
    pendingRequests,
    videoQueue,
    pendingVideoRequests,
    onlineCount,
    isConnected,
    notification,
    kickedOut,
    joinRoomChannel,
    getStoredHostToken,
    leaveRoom,
    sendUpdateRoomTitle,
    sendPlay,
    sendPause,
    sendSeek,
    sendChangeVideo,
    sendAddToQueue,
    sendRequestQueueVideo,
    sendApproveVideoRequest,
    sendRejectVideoRequest,
    sendRemoveQueueItem,
    sendPlayNextVideo,
    sendAssignRole,
    sendRemoveParticipant,
    sendPlaybackRequest,
    sendApproveRequest,
    sendRejectRequest,
    messages,
    sendMessage,
    activeReactions,
    sendReaction,
    sendTransferHost,
    showNotification,
  } = useRoom();

  const [loading, setLoading] = useState(() => !(roomId === cleanRoomId));
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [namePromptModal, setNamePromptModal] = useState(false);
  const [tempName, setTempName] = useState(user.username || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState(roomName || '');
  const [theaterMode, setTheaterMode] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'roles' | 'queue' | 'settings' | 'share'

  // Keep newRoomTitle in sync with roomName updates
  useEffect(() => {
    if (roomName) {
      setNewRoomTitle(roomName);
    }
  }, [roomName]);

  // Initial room bootstrap. Do not set the global roomId from the public REST
  // lookup: that used to change this effect's dependencies and cancel the actual
  // Socket.IO join halfway through a page refresh.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!cleanRoomId) {
        navigate('/');
        return;
      }

      // CreateRoom / JoinRoom may already have completed the authoritative socket join.
      if (roomId === cleanRoomId && isConnected) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const res = await getRoom(cleanRoomId);
        if (cancelled) return;

        if (!res.success || !res.data) {
          setError('Room not found or expired.');
          return;
        }

        // Public room metadata is safe to display while joining, but membership,
        // role, participants and playback must come from the socket join snapshot.
        setRoomName(res.data.roomName || '');
        setNewRoomTitle(res.data.roomName || '');

        if (!user.username || !user.username.trim()) {
          setNamePromptModal(true);
          return;
        }

        const hostToken = getStoredHostToken(cleanRoomId);
        await ensureSession(user.username);
        if (cancelled) return;

        // joinRoomChannel performs the authoritative DB + Socket.IO membership
        // operation and returns only after the server has sent the complete room state.
        await joinRoomChannel(cleanRoomId, user.username, hostToken);
        if (cancelled) return;

      } catch (err) {
        if (cancelled) return;
        console.error('WatchRoom init error:', err);
        const status = err.response?.status;
        if (status === 409 || err.code === 'USERNAME_TAKEN') {
          setNamePromptModal(true);
          setError(err.response?.data?.message || err.message || 'Username already taken in this room. Please choose another display name.');
        } else if (status === 404 || err.code === 'ROOM_NOT_FOUND') {
          setError('Room not found. Please verify the room code or invitation link.');
        } else if (status === 403 || err.code === 'INVALID_HOST_TOKEN') {
          setError(err.response?.data?.message || err.message || 'Access denied: You cannot join this room.');
        } else {
          setError(err.response?.data?.message || err.message || 'Failed to load room.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
    // This bootstrap should run on room-route changes only. It must not restart
    // when the socket join itself updates roomId/isConnected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanRoomId]);

  const handleSaveNameAndJoin = async (e) => {
    e.preventDefault();
    if (!tempName.trim()) return;

    try {
      setLoading(true);
      setError('');
      updateUsername(tempName.trim());
      await ensureSession(tempName.trim());

      const hostToken = getStoredHostToken(cleanRoomId);

      await joinRoomChannel(cleanRoomId, tempName.trim(), hostToken);
      setNamePromptModal(false);
    } catch (err) {
      if (err.response?.status === 409 || err.code === 'USERNAME_TAKEN') {
        setError(err.response?.data?.message || 'Username already taken in this room. Please choose another display name.');
      } else {
        setError(err.response?.data?.message || 'Failed to join room with chosen name.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(cleanRoomId);
    setCopiedCode(true);
    showNotification('Room code copied to clipboard!', 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}/join/${cleanRoomId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    showNotification('Invite link copied! Send it to your friends.', 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRenameTitle = async (e) => {
    e.preventDefault();
    if (!newRoomTitle.trim()) return;
    try {
      await sendUpdateRoomTitle(newRoomTitle.trim());
      setIsEditingTitle(false);
    } catch (err) {
      console.error('Rename title error:', err);
    }
  };

  const handleLeaveRoom = async () => {
    try {
      await leaveRoom();
    } finally {
      navigate('/', { replace: true });
    }
  };

  const isHost = myRole === 'Host';
  const canReviewRequests = myRole === 'Host' || myRole === 'Moderator';
  const isParticipant = myRole === 'Participant';

  // Handle Kicked Out state
  if (kickedOut) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="bg-white border border-rose-200 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-500 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Removed from Room</h2>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            You were removed from this Watch Party room by the Host. You can no longer access this session.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-semibold text-white text-sm shadow-md shadow-emerald-600/20 transition-all"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Handle Loading state
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-sm text-gray-600 font-medium">Connecting to Watch Party...</p>
      </div>
    );
  }

  // Handle Error state
  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-500 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Join Room</h2>
          <p className="text-sm text-gray-600 mb-6">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/join"
              className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 text-sm text-gray-700 font-medium transition-colors"
            >
              Try Another Code
            </Link>
            <Link
              to="/"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm text-white font-medium transition-colors shadow-sm"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2.5 backdrop-blur-md ${
              notification.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : notification.type === 'warning'
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-white text-gray-800 border-gray-200'
            }`}
          >
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Top Room Subheader Bar matching Screenshot 2 */}
      <div className="border-b border-gray-200/80 bg-white/70 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Clapperboard Icon + Movie Night Title + Code + Invite */}
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            {/* Room Title */}
            <div className="flex items-center gap-2 font-bold text-gray-900 text-base sm:text-lg">
              <span className="text-xl">🎬</span>
              {isEditingTitle ? (
                <form onSubmit={handleRenameTitle} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newRoomTitle}
                    onChange={(e) => setNewRoomTitle(e.target.value)}
                    className="px-2 py-0.5 rounded-md border border-emerald-500 text-sm focus:outline-none"
                    autoFocus
                  />
                  <button type="submit" className="text-xs text-emerald-600 font-bold px-2 py-1 bg-emerald-50 rounded">
                    Save
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span>{roomName || 'Movie Night'}</span>
                  {isHost && (
                    <button
                      onClick={() => setIsEditingTitle(true)}
                      className="text-gray-400 hover:text-gray-700 p-0.5 rounded transition-colors"
                      title="Edit Room Title"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Room Code Pill Badge */}
            <button
              onClick={handleCopyCode}
              title="Click to copy code"
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-300 text-xs font-semibold text-gray-700 shadow-sm hover:border-gray-400 transition-all"
            >
              <span>Room Code:</span>
              <span className="font-mono text-emerald-700 font-bold tracking-wider">{cleanRoomId}</span>
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>

            {/* Invite Friends Button */}
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white border border-emerald-500/80 hover:bg-emerald-50/60 text-emerald-700 text-xs font-semibold shadow-sm transition-all"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Invite Friends</span>
            </button>
          </div>

          {/* Right: Online Indicator + Leave Room */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{onlineCount} Online</span>
            </div>

            <div className="h-4 w-px bg-gray-200 hidden sm:block" />

            <button
              type="button"
              onClick={handleLeaveRoom}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-red-50 border border-red-300 hover:border-red-400 text-red-600 text-xs font-semibold shadow-sm transition-all"
              title="Leave Room"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave Room</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main 3-Column Layout matching Screenshot 2 */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className={`grid grid-cols-1 ${theaterMode ? 'lg:grid-cols-1' : 'lg:grid-cols-12'} gap-5 items-start`}>
          
          {/* Column 1: Video Player, Playback Controls & Change Video (approx 6 cols) */}
          <div className={`${theaterMode ? 'w-full max-w-4xl mx-auto' : 'lg:col-span-6'} space-y-3`}>
            <VideoPlayer
              videoId={currentVideoId}
              playbackState={playbackState}
              currentTime={currentTime}
              syncTimestamp={syncTimestamp}
              seekCommand={seekCommand}
              myRole={myRole}
              reactions={activeReactions}
              onSelectReaction={(emoji) => sendReaction(emoji)}
              onPlay={(time) => sendPlay(time)}
              onPause={(time) => sendPause(time)}
              onSeek={(time) => sendSeek(time)}
              onChangeVideo={(urlOrId) => sendChangeVideo(urlOrId)}
              onAddToQueue={(url) => sendAddToQueue(url)}
              onRequestQueueVideo={(url) => sendRequestQueueVideo(url)}
              onRequestAction={(type, payload) => sendPlaybackRequest(type, payload)}
            />
          </div>

          {!theaterMode && (
            <>
              {/* Column 2: Participants (top) & Playback Requests (bottom) (approx 3 cols) */}
              <div className="lg:col-span-3 space-y-4">
                {/* Top: Participants List */}
                <div className="h-[280px]">
                  <ParticipantsList
                    participants={participants}
                    currentUserId={user.userId}
                    isCurrentUserHost={isHost}
                    onPromote={(targetId) => sendAssignRole(targetId, 'Moderator')}
                    onDemote={(targetId) => sendAssignRole(targetId, 'Participant')}
                    onRemove={(targetId) => sendRemoveParticipant(targetId)}
                    onTransferHost={(targetId) => sendTransferHost(targetId)}
                  />
                </div>

                {/* Bottom: Playback Requests */}
                <div>
                  <RequestPanel
                    pendingRequests={pendingRequests}
                    canReview={canReviewRequests}
                    isParticipant={isParticipant}
                    currentPlaybackTime={currentTime}
                    onApprove={(requestId) => sendApproveRequest(requestId)}
                    onReject={(requestId) => sendRejectRequest(requestId)}
                    onSubmitRequest={(type, payload) => sendPlaybackRequest(type, payload)}
                  />
                </div>
              </div>

              {/* Column 3: Room Chat (approx 3 cols) */}
              <div className="lg:col-span-3 h-[520px]">
                <ChatPanel
                  messages={messages}
                  currentUserId={user.userId}
                  onSendMessage={sendMessage}
                />
              </div>
            </>
          )}

        </div>
      </main>

      {/* Bottom Toolbar Pills matching Screenshot 2 */}
      <footer className="border-t border-gray-200/80 bg-white/80 backdrop-blur-md py-3 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
          <button
            onClick={() => setActiveModal('roles')}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 shadow-sm transition-all"
          >
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Manage Roles</span>
          </button>

          <button
            onClick={() => setActiveModal('queue')}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 shadow-sm transition-all"
          >
            <ListOrdered className="w-4 h-4 text-emerald-600" />
            <span>Watch Queue</span>
          </button>

          <button
            onClick={() => setActiveModal('settings')}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 shadow-sm transition-all"
          >
            <Settings className="w-4 h-4 text-emerald-600" />
            <span>Room Settings</span>
          </button>

          <button
            onClick={() => {
              handleCopyLink();
              setActiveModal('share');
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 shadow-sm transition-all"
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span>Share Room</span>
          </button>

          <button
            onClick={() => setTheaterMode(!theaterMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-semibold shadow-sm transition-all ${
              theaterMode
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
            }`}
          >
            {theaterMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-emerald-600" />}
            <span>{theaterMode ? 'Exit Theater' : 'Theater Mode'}</span>
          </button>
        </div>
      </footer>

      {/* Feature Modals for bottom pills */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={`bg-white border border-gray-200 rounded-3xl p-6 ${activeModal === 'queue' ? 'max-w-2xl max-h-[88vh] overflow-y-auto' : 'max-w-md'} w-full shadow-2xl relative`}>
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>

            {activeModal === 'roles' && (
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-600" /> Manage Room Roles
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  The Room Host can promote any participant to Moderator or transfer ownership from the participant card menu.
                </p>
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                    <strong>👑 Host:</strong> Full playback control, participant kicking, moderator promotions, and ownership transfer.
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                    <strong>🛡 Moderator:</strong> Direct playback controls and participant request approvals.
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-800">
                    <strong>👤 Participant:</strong> Synchronized live playback with approval requests.
                  </div>
                </div>
              </div>
            )}

            {activeModal === 'queue' && (
              <WatchQueuePanel
                currentVideoId={currentVideoId}
                videoQueue={videoQueue}
                pendingVideoRequests={pendingVideoRequests}
                canManageQueue={canReviewRequests}
                onApprove={sendApproveVideoRequest}
                onReject={sendRejectVideoRequest}
                onRemove={sendRemoveQueueItem}
                onPlayNext={sendPlayNextVideo}
              />
            )}

            {activeModal === 'settings' && (
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-emerald-600" /> Room Settings
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50 border border-gray-200">
                    <div>
                      <p className="font-semibold text-gray-900">Room Code</p>
                      <p className="text-gray-500">{cleanRoomId}</p>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-semibold"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-600">
                    Socket.IO synchronization mode: <strong>Authoritative Real-Time</strong>
                  </div>
                </div>
              </div>
            )}

            {activeModal === 'share' && (
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-emerald-600" /> Share Watch Party
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Send this link to friends so they can jump straight into the party:
                </p>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between text-xs font-mono text-gray-700 mb-4 break-all">
                  <span>{window.location.origin}/join/{cleanRoomId}</span>
                  <button
                    onClick={handleCopyLink}
                    className="ml-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold shrink-0"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setActiveModal(null)}
              className="mt-5 w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Name Prompt Modal for Direct Invite Visitors */}
      {namePromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Enter Your Display Name</h3>
            <p className="text-xs text-gray-500 mb-4">
              You are joining room <span className="font-mono text-emerald-700 font-bold">{cleanRoomId}</span>.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSaveNameAndJoin}>
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="Your display name..."
                maxLength={30}
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-500 mb-4 text-sm font-medium"
              />
              <button
                type="submit"
                disabled={!tempName.trim()}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 font-semibold text-white shadow-md shadow-emerald-600/20 transition-all text-sm"
              >
                Join Party
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchRoom;
