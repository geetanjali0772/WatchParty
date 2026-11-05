import React, { useRef } from 'react';
import { Play, Radio } from 'lucide-react';
import useYoutubePlayer from '../hooks/useYoutubePlayer';
import PlaybackControls from './PlaybackControls';
import VideoInput from './VideoInput';
import ReactionOverlay from './ReactionOverlay';
import ReactionPicker from './ReactionPicker';

export const VideoPlayer = ({
  videoId,
  playbackState,
  currentTime,
  syncTimestamp,
  seekCommand,
  myRole,
  reactions = [],
  onSelectReaction,
  onPlay,
  onPause,
  onSeek,
  onChangeVideo,
  onAddToQueue,
  onRequestQueueVideo,
  onRequestAction,
}) => {
  const containerRef = useRef(null);
  const canControl = myRole === 'Host' || myRole === 'Moderator';
  const isPlaying = playbackState === 'playing';

  const {
    duration,
    localCurrentTime,
    volume,
    isMuted,
    handleVolumeChange,
    handleToggleMute,
    seekTo,
  } = useYoutubePlayer({
    containerId: 'youtube-party-player',
    videoId,
    playbackState,
    currentTime,
    syncTimestamp,
    seekCommand,
    canControl,
    onUserPlay: (time) => {
      onPlay(time);
    },
    onUserPause: (time) => {
      onPause(time);
    },
  });

  const handleSeek = (seekTime) => {
    if (!canControl || !videoId) return;
    seekTo(seekTime);
    onSeek?.(seekTime);
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  return (
    <div className="space-y-3" ref={containerRef}>
      {/* Video Container (16:9) matching Screenshot 2 */}
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-gray-200 shadow-sm">
        <div id="youtube-party-player" className="w-full h-full" />
        {!videoId && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950 text-center px-6">
            <div className="text-white text-lg font-bold">No video selected</div>
            <p className="mt-2 max-w-sm text-sm text-slate-300">
              {canControl
                ? 'Paste a YouTube video link below to start the watch party.'
                : 'Waiting for the Host or a Moderator to add a video.'}
            </p>
          </div>
        )}

        {/* Top-left: YouTube Badge */}
        <div className="absolute top-3 left-3 z-20 pointer-events-none flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm text-white text-xs font-bold tracking-tight">
          <div className="w-4 h-3 bg-red-600 rounded-[2px] flex items-center justify-center">
            <Play className="w-2 h-2 text-white fill-white ml-0.5" />
          </div>
          <span>YouTube</span>
        </div>

        {/* Top-right: ((•)) Synchronized Green Badge */}
        <div className="absolute top-3 right-3 z-20 pointer-events-none">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 backdrop-blur-md border border-emerald-500/50 text-emerald-400 text-xs font-semibold shadow-lg">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span className="text-[11px] tracking-wide">Synchronized</span>
          </div>
        </div>

        {/* Unmute notification pill if browser autoplay muted audio */}
        {isMuted && isPlaying && (
          <button
            type="button"
            onClick={handleToggleMute}
            className="absolute bottom-4 left-4 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/80 hover:bg-black text-white text-xs font-semibold backdrop-blur-md border border-white/20 shadow-lg transition-transform hover:scale-105"
            title="Tap to Unmute"
          >
            <span>🔇 Audio Muted — Tap to Unmute 🔊</span>
          </button>
        )}

        {/* Floating Emoji Reactions Overlay */}
        <ReactionOverlay reactions={reactions} />
      </div>

      {/* Floating Reaction Picker Bar */}
      <div className="flex items-center justify-between px-1">
        <ReactionPicker onSelectReaction={onSelectReaction} />
      </div>

      {/* Playback Controls Card */}
      <PlaybackControls
        isPlaying={isPlaying}
        currentTime={localCurrentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        hasVideo={Boolean(videoId)}
        canControl={canControl && Boolean(videoId)}
        onPlay={() => onPlay(localCurrentTime)}
        onPause={() => onPause(localCurrentTime)}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        onToggleFullscreen={handleToggleFullscreen}
        onRequestAction={onRequestAction}
      />

      {/* Video URL Input & Change Video Bar */}
      <VideoInput
        canControl={canControl}
        onChangeVideo={onChangeVideo}
      onAddToQueue={onAddToQueue}
      onRequestQueueVideo={onRequestQueueVideo}
      />
    </div>
  );
};

export default VideoPlayer;
