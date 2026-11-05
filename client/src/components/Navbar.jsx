import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Play,
  User,
  ChevronDown,
  Bell,
  Home as HomeIcon,
  Users,
  Compass,
  Gift,
  X,
  Radio,
  Info,
  Sparkles,
} from 'lucide-react';
import { useRoom } from '../hooks/useRoom';

export const Navbar = () => {
  const location = useLocation();
  const { user, updateUsername, roomId } = useRoom();
  const [showAbout, setShowAbout] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [tempName, setTempName] = useState(user.username || '');

  const handleSaveName = (e) => {
    e.preventDefault();
    if (tempName.trim()) {
      updateUsername(tempName.trim());
      setShowUserModal(false);
    }
  };

  const isHome = location.pathname === '/';
  const isRoom = location.pathname.startsWith('/room/');

  // Determine avatar initials and display name
  const displayName = user.username || (isRoom ? 'Kavya Malhotra' : 'Geetanjali');
  const avatarInitials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <header className="border-b border-gray-100 bg-white/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200">
              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-gray-900">
              Watch<span className="text-emerald-600">Party</span>
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-7">
            {isRoom ? (
              <>
                <Link
                  to="/"
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <HomeIcon className="w-4 h-4" />
                  <span>Home</span>
                </Link>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800 bg-[#E6F7ED] border border-emerald-200/80 px-3.5 py-1.5 rounded-full shadow-sm">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>My Rooms</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAbout(true)}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <Compass className="w-4 h-4" />
                  <span>Explore</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAbout(true)}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <Gift className="w-4 h-4" />
                  <span>Premium</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/"
                  className="text-sm font-bold text-gray-900 flex flex-col items-center group relative py-1"
                >
                  <span>Home</span>
                  <span className="w-8 h-1 bg-emerald-600 rounded-full mt-1" />
                </Link>
                <button
                  type="button"
                  onClick={() => setShowAbout(true)}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Features
                </button>
                <button
                  type="button"
                  onClick={() => setShowAbout(true)}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  How it Works
                </button>
                <button
                  type="button"
                  onClick={() => setShowAbout(true)}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  About
                </button>
              </>
            )}
          </nav>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {isRoom && (
              <>
                <button
                  type="button"
                  className="relative p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  title="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
                </button>
                <div className="h-5 w-px bg-gray-200 hidden sm:block" />
              </>
            )}

            {/* Profile Pill matching exact screenshot design */}
            <button
              onClick={() => {
                setTempName(user.username || '');
                setShowUserModal(true);
              }}
              title="Change Display Name"
              className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#111827] hover:bg-gray-800 text-white shadow-sm transition-all text-sm group"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {avatarInitials || <User className="w-3.5 h-3.5" />}
              </div>
              <span className="max-w-[130px] truncate text-xs font-semibold tracking-wide">
                {displayName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>
      </header>

      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setShowAbout(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3.5 mb-5">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">About WatchParty</h3>
                <p className="text-xs text-emerald-600 font-medium">Real-Time Synchronized Streaming</p>
              </div>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed mb-5">
              WatchParty allows you and your friends to stream YouTube videos simultaneously with synchronized playback, chat, and interactive role management from any device, anywhere in the world.
            </p>

            <div className="space-y-3 mb-6 text-xs text-gray-600">
              <div className="flex items-start gap-3 bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100/70">
                <Radio className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-gray-900 block font-semibold mb-0.5">Real-time Playback Sync</strong>
                  Play, pause, seek, and video changes reflect synchronously using bidirectional Socket.IO channels.
                </div>
              </div>
              <div className="flex items-start gap-3 bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100/70">
                <Info className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-gray-900 block font-semibold mb-0.5">Role-Based Access (RBAC)</strong>
                  Hosts and Moderators control playback directly. Participants submit approval requests to maintain order.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowAbout(false)}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-semibold text-white shadow-md shadow-emerald-600/20 transition-all text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* User Name Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => setShowUserModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-gray-900 mb-1">Your Display Name</h3>
            <p className="text-xs text-gray-500 mb-4">
              This name will be visible to other room participants.
            </p>

            <form onSubmit={handleSaveName}>
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="Enter your name..."
                maxLength={30}
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 mb-4 text-sm font-medium"
              />
              <button
                type="submit"
                disabled={!tempName.trim()}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 font-semibold text-white shadow-md shadow-emerald-600/20 transition-all text-sm"
              >
                Save Name
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
