import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { Link2, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { joinRoom } from '../services/api';
import { useRoom } from '../hooks/useRoom';

export const JoinRoom = () => {
  const navigate = useNavigate();
  const { code: pathCode } = useParams();
  const [searchParams] = useSearchParams();
  const queryCode = searchParams.get('code') || searchParams.get('roomId');

  const { user, updateUsername, ensureSession, joinRoomChannel, getStoredHostToken } = useRoom();

  // Helper to extract room code even if full URL is pasted
  const parseRoomCode = (input) => {
    if (!input) return '';
    const trimmed = input.trim();
    const urlMatch = trimmed.match(/(?:join|room)\/([A-Za-z0-9]+)/i) || trimmed.match(/[?&](?:code|roomId)=([A-Za-z0-9]+)/i);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1].toUpperCase();
    }
    return trimmed.toUpperCase();
  };

  const initialCode = parseRoomCode(pathCode || queryCode || '');
  const [roomCode, setRoomCode] = useState(initialCode);
  const [username, setUsername] = useState(user.username || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const raw = pathCode || queryCode;
    if (raw) {
      setRoomCode(parseRoomCode(raw));
    }
  }, [pathCode, queryCode]);

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');

    const cleanCode = parseRoomCode(roomCode);

    if (!cleanCode) {
      setError('Please enter a room code.');
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

      const hostToken = getStoredHostToken(cleanCode);

      const res = await joinRoom(cleanCode, {
        hostToken,
      });

      if (res.success && res.data?.room) {
        // Wait for authoritative Socket.IO confirmation before navigation!
        await joinRoomChannel(cleanCode, username.trim(), hostToken);
        navigate(`/room/${cleanCode}`);
      } else {
        setError(res.message || 'Room not found or invalid.');
      }
    } catch (err) {
      console.error('Join room error:', err);
      if (err.response?.status === 404) {
        setError('Room not found. Please double-check the room code or invitation link.');
      } else if (err.response?.status === 409) {
        setError(err.response.data?.message || 'Username already taken in this room. Please choose another display name.');
      } else if (err.response?.status === 403) {
        setError(err.response.data?.message || 'Access denied: You cannot join this room.');
      } else {
        setError(
          err.response?.data?.message || err.message || 'Failed to join room. Please try again.'
        );
      }
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
            <Link2 className="w-7 h-7" />
          </div>

          {/* Title & Description */}
          <div className="text-center mb-7">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1.5">Join a Watch Room</h2>
            <p className="text-xs text-gray-500">
              Enter a room code to join an existing room.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleJoin} className="space-y-4">
            {/* Room Code */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Room Code
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => {
                  setRoomCode(e.target.value.toUpperCase());
                  if (error) setError('');
                }}
                placeholder="e.g. A7F3K9"
                maxLength={10}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-colors text-sm font-mono tracking-widest uppercase font-bold"
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
                  <span>Joining Room...</span>
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  <span>Join Room</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default JoinRoom;
