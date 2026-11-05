import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, Loader2, AlertCircle, ArrowLeft, Plus } from 'lucide-react';
import { createRoom } from '../services/api';
import { useRoom } from '../hooks/useRoom';

export const CreateRoom = () => {
  const navigate = useNavigate();
  const { user, updateUsername, ensureSession, joinRoomChannel, storeHostToken } = useRoom();

  const [roomName, setRoomName] = useState('');
  const [username, setUsername] = useState(user.username || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');

    if (!roomName.trim()) {
      setError('Please enter a room name.');
      return;
    }
    if (!username.trim()) {
      setError('Please enter your display name.');
      return;
    }

    setLoading(true);
    try {
      updateUsername(username.trim());
      await ensureSession(username.trim());

      const res = await createRoom({
        roomName: roomName.trim(),
      });

      if (res.success && res.data?.room) {
        const newRoomId = res.data.room.roomId;
        const hostToken = res.data.hostToken;

        if (hostToken) {
          storeHostToken(newRoomId, hostToken);
        }

        await joinRoomChannel(newRoomId, username.trim(), hostToken);
        navigate(`/room/${newRoomId}`);
      } else {
        setError(res.message || 'Failed to create room.');
      }
    } catch (err) {
      console.error('Create room error:', err);
      setError(
        err.response?.data?.message || err.message || 'Unable to connect to server. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 relative">
      {/* Background soft ambient mint glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-emerald-100/50 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>

        {/* Card Container */}
        <div className="bg-white border border-gray-200/90 rounded-3xl p-7 sm:p-9 shadow-xl relative">
          {/* Header Icon */}
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-sm">
            <Users className="w-7 h-7" />
          </div>

          {/* Title & Description */}
          <div className="text-center mb-7">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1.5">Create a Watch Room</h2>
            <p className="text-xs text-gray-500">
              Create a new room and invite others to watch together.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Room Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Room Name
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => {
                  setRoomName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Movie Night"
                maxLength={60}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-colors text-sm font-medium"
                autoFocus
              />
            </div>

            {/* Your Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Your Display Name
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Geetanjali"
                maxLength={30}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-colors text-sm font-medium"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 font-semibold text-white shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-sm transition-all mt-2 active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Room...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Create Room</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateRoom;
