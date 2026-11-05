import React from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Link2,
  Zap,
  ShieldCheck,
  Users,
  Monitor,
  Play,
  Pause,
  Volume2,
  Maximize2,
  Settings,
  Subtitles,
  Crown,
  Home as HomeIcon,
  Coffee,
  Plane,
} from 'lucide-react';

export const Home = () => {
  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      {/* Background Organic Green Gradients & Waves matching Screenshot 1 */}
      <div className="absolute top-0 right-1/4 w-[650px] h-[650px] bg-gradient-to-br from-emerald-100/70 via-emerald-50/40 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] bg-gradient-to-tl from-emerald-200/50 via-emerald-100/30 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Decorative organic green wave path in bottom-right */}
      <svg
        className="absolute bottom-0 right-0 w-[55vw] max-w-[800px] pointer-events-none -z-10 text-emerald-100/50"
        viewBox="0 0 600 300"
        fill="currentColor"
      >
        <path d="M0,192 C150,90 350,-20 600,120 L600,300 L0,300 Z" />
      </svg>

      {/* Main Hero Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-14 pb-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Hero Text & Actions */}
          <div className="lg:col-span-6 xl:col-span-6 text-left">
            {/* Top Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E8F5EE] border border-emerald-200/70 text-emerald-900 text-xs font-bold mb-6 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time Watch Party</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl xl:text-[56px] font-extrabold text-gray-900 tracking-tight leading-[1.12] mb-6">
              Watch YouTube <br />
              Together, Anytime, <br />
              <span className="text-emerald-600 relative inline-block">
                Anywhere.
                {/* Hand-drawn Green Underline Brush Wave */}
                <svg
                  className="absolute -bottom-2.5 left-0 w-full h-4 text-emerald-600"
                  viewBox="0 0 240 16"
                  fill="none"
                >
                  <path
                    d="M3 11C60 4 180 4 237 12"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
                {/* Playful Accent Rays next to Period */}
                <span className="absolute -top-1 -right-6 text-emerald-600 font-bold text-lg select-none">
                  彡
                </span>
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-gray-600 text-base sm:text-lg leading-relaxed max-w-lg mb-8 font-normal">
              Create a room, invite your friends, and watch YouTube videos in real time — simultaneously, from any device, anywhere in the world.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/create"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-lg shadow-emerald-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Create Room</span>
              </Link>

              <Link
                to="/join"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm border border-gray-300 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Link2 className="w-4 h-4 text-gray-700" />
                <span>Join Room</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Hero Graphic Orbit & Connected Cards */}
          <div className="lg:col-span-6 xl:col-span-6 relative flex items-center justify-center min-h-[460px] sm:min-h-[520px]">
            {/* Globe Background Grid & Orbital Rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Dotted globe outline */}
              <div className="w-[360px] sm:w-[460px] h-[360px] sm:h-[460px] rounded-full border border-dashed border-emerald-300/60 relative animate-[spin_120s_linear_infinite]" />
              <div className="w-[280px] sm:w-[360px] h-[280px] sm:h-[360px] rounded-full border border-dashed border-emerald-200/50 absolute" />
              {/* Radial green glow behind video */}
              <div className="w-[260px] h-[260px] rounded-full bg-emerald-400/15 blur-2xl absolute" />
            </div>

            {/* Center: YouTube Video Player Mockup */}
            <div className="relative z-10 w-full max-w-[340px] sm:max-w-[400px] rounded-2xl overflow-hidden shadow-2xl bg-[#0F172A] border border-gray-800/80">
              {/* Video Thumbnail Image */}
              <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                <img
                  src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80"
                  alt="Scenic Sunset Mountain Lake"
                  className="w-full h-full object-cover"
                />

                {/* YouTube Logo Badge on top-left of video */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[11px] font-bold">
                  <div className="w-4 h-3 bg-red-600 rounded-[2px] flex items-center justify-center">
                    <Play className="w-1.5 h-1.5 text-white fill-white ml-0.5" />
                  </div>
                  <span>YouTube</span>
                </div>

                {/* Video controls overlay at bottom of video frame */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 text-white">
                  {/* Progress scrub bar */}
                  <div className="w-full h-1 bg-white/30 rounded-full mb-1.5 relative overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[24%]" />
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2">
                      <Pause className="w-3 h-3 fill-white" />
                      <Volume2 className="w-3 h-3" />
                      <span className="font-mono text-[9px] text-gray-200">2:30 / 10:24</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Subtitles className="w-3 h-3" />
                      <Settings className="w-3 h-3" />
                      <Maximize2 className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Orbiting Participant Cards with Location / Role Badges */}
            
            {/* 1. Top Card: Home */}
            <div className="absolute top-2 sm:top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center group">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-white shadow-xl bg-white relative">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                  alt="Person at Home"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
              </div>
              <div className="mt-1.5 px-3 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-md flex items-center gap-1">
                <HomeIcon className="w-3 h-3" />
                <span>Home</span>
              </div>
            </div>

            {/* 2. Left Card: Cafe */}
            <div className="absolute left-0 sm:left-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center group">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-white shadow-xl bg-white relative">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80"
                  alt="Person at Cafe"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
              </div>
              <div className="mt-1.5 px-3 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-md flex items-center gap-1">
                <Coffee className="w-3 h-3" />
                <span>Cafe</span>
              </div>
            </div>

            {/* 3. Right Card: Travel */}
            <div className="absolute right-0 sm:right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center group">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-white shadow-xl bg-white relative">
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80"
                  alt="Person Traveling"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
              </div>
              <div className="mt-1.5 px-3 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-md flex items-center gap-1">
                <Plane className="w-3 h-3" />
                <span>Travel</span>
              </div>
            </div>

            {/* 4. Bottom Card: Host */}
            <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center group">
              {/* Playful accent rays around Host */}
              <span className="absolute -left-3 top-2 text-emerald-500 font-bold text-sm">彡</span>
              <span className="absolute -right-3 top-2 text-emerald-500 font-bold text-sm -scale-x-100">彡</span>

              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-white shadow-xl bg-white relative">
                <img
                  src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80"
                  alt="Host"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
              </div>
              <div className="mt-1.5 px-3.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-md flex items-center gap-1.5">
                <Crown className="w-3 h-3 text-amber-300 fill-amber-300" />
                <span>Host</span>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Bottom 4 Feature Cards Grid matching Screenshot 1 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Feature 1 */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5 fill-emerald-600/20" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Real-Time Sync</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Play, pause, seek and change videos in perfect sync.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5 fill-emerald-600/20" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Role-Based Access</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Host, Moderator and Participant roles with secure controls.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 fill-emerald-600/20" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Approval Workflow</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Participants can request playback or video changes for approval.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <Monitor className="w-5 h-5 fill-emerald-600/20" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Multi-Device Ready</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Watch together on laptop, tablet and mobile — anywhere.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
