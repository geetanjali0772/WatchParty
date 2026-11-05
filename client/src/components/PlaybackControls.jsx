import React, { useState, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize2,
  Lock,
} from 'lucide-react';
import { formatTime } from '../utils/youtube';

export const PlaybackControls = ({
  isPlaying,
  currentTime = 0,
  duration = 0,
  volume = 80,
  isMuted = false,
  hasVideo = true,
  canControl = false,
  onPlay,
  onPause,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  onRequestAction,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [tempSeekTime, setTempSeekTime] = useState(0);
  const [showSeekRequestModal, setShowSeekRequestModal] = useState(false);
  const [seekRequestMinutes, setSeekRequestMinutes] = useState('');
  const [seekRequestSeconds, setSeekRequestSeconds] = useState('0');
  const [isSubmittingSeekRequest, setIsSubmittingSeekRequest] = useState(false);
  const isDraggingRef = useRef(false);
  const lastCommittedRef = useRef(-1);

  const maxDuration = Math.max(0, duration || 0);

  // When dragging, strictly preserve temporary user drag position; otherwise show synchronized time
  const displayTime = isDragging
    ? tempSeekTime
    : Math.max(0, Math.min(maxDuration > 0 ? maxDuration : 999999, currentTime || 0));

  const commitSeek = useCallback(
    (targetSeconds) => {
      if (!canControl) return;
      const raw = parseFloat(targetSeconds);
      if (isNaN(raw) || !Number.isFinite(raw)) return;

      const clamped = Math.max(0, Math.min(maxDuration > 0 ? maxDuration : 999999, raw));

      // Prevent duplicate seek commits within 0.25s of the same timestamp
      if (Math.abs(clamped - lastCommittedRef.current) < 0.25) return;
      lastCommittedRef.current = clamped;

      if (onSeek && typeof onSeek === 'function') {
        onSeek(clamped);
      }
    },
    [canControl, maxDuration, onSeek]
  );

  const handlePointerDown = (e) => {
    if (!canControl) return;
    isDraggingRef.current = true;
    setIsDragging(true);

    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      setTempSeekTime(val);
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}
  };

  const handleInput = (e) => {
    if (!canControl) return;
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      setTempSeekTime(val);
    }
  };

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}

    const val = parseFloat(e.target.value);
    commitSeek(val);
  };

  const handlePointerCancel = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}
  };

  const handleKeyDown = (e) => {
    if (!canControl) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
      isDraggingRef.current = true;
      setIsDragging(true);
    }
  };

  const handleKeyUp = (e) => {
    if (!canControl) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
      isDraggingRef.current = false;
      setIsDragging(false);
      const val = parseFloat(e.target.value);
      commitSeek(val);
    }
  };

  const handleSkip = (secondsDelta) => {
    if (!canControl) return;
    const base = isDragging ? tempSeekTime : currentTime;
    const newTarget = Math.max(0, Math.min(maxDuration > 0 ? maxDuration : 999999, base + secondsDelta));
    commitSeek(newTarget);
  };

  const submitSeekRequest = async (event) => {
    event.preventDefault();
    const minutes = Number(seekRequestMinutes);
    const seconds = Number(seekRequestSeconds || 0);
    if (!Number.isInteger(minutes) || minutes < 0 || !Number.isInteger(seconds) || seconds < 0 || seconds > 59) {
      return;
    }

    const targetTime = minutes * 60 + seconds;
    setIsSubmittingSeekRequest(true);
    try {
      // Never send the current playback time as a seek target. The Participant
      // must explicitly choose the timestamp that the Host/Moderator will approve.
      await onRequestAction?.('seek', { currentTime: targetTime });
      setShowSeekRequestModal(false);
      setSeekRequestMinutes('');
      setSeekRequestSeconds('0');
    } catch (err) {
      // Keep the dialog open so the Participant can retry after a network error.
    } finally {
      setIsSubmittingSeekRequest(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200/90 rounded-2xl p-3.5 shadow-sm space-y-3">
      {/* Progress / Seek bar */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono font-medium text-gray-700 w-14 text-right shrink-0">
          {formatTime(displayTime)}
        </span>

        <div className="relative flex-1 flex items-center group">
          <input
            type="range"
            min="0"
            max={maxDuration > 0 ? maxDuration : 100}
            step="0.1"
            value={displayTime}
            disabled={!canControl}
            onPointerDown={handlePointerDown}
            onInput={handleInput}
            onChange={handleInput}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 transition-all accent-emerald-600 ${
              !canControl ? 'cursor-not-allowed opacity-60' : 'hover:h-2.5'
            }`}
            title={canControl ? `Seek: ${formatTime(displayTime)}` : 'Playback controlled by Host/Moderator'}
          />
        </div>

        <span className="text-xs font-mono font-medium text-gray-400 w-14 shrink-0">
          {formatTime(duration)}
        </span>
      </div>

      {/* Control Buttons row matching Screenshot 2 */}
      <div className="flex items-center justify-between">
        {/* Left: Play/Pause and Skip buttons */}
        <div className="flex items-center gap-2.5">
          {canControl ? (
            <>
              {/* Circular Emerald Play / Pause button */}
              <button
                onClick={isPlaying ? onPause : onPlay}
                disabled={!hasVideo}
                className="w-11 h-11 disabled:opacity-40 disabled:cursor-not-allowed rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/25 transition-all active:scale-95"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-white" />
                ) : (
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                )}
              </button>

              {/* Rewind 10s button */}
              <button
                onClick={() => handleSkip(-10)}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-semibold transition-all relative"
                title="Rewind 10 seconds"
              >
                <RotateCcw className="w-4 h-4 text-gray-700" />
                <span className="absolute text-[8px] font-bold text-gray-700 pt-0.5">10</span>
              </button>

              {/* Fast forward 10s button */}
              <button
                onClick={() => handleSkip(10)}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-semibold transition-all relative"
                title="Fast forward 10 seconds"
              >
                <RotateCw className="w-4 h-4 text-gray-700" />
                <span className="absolute text-[8px] font-bold text-gray-700 pt-0.5">10</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-xs font-medium text-gray-500">
              <Lock className="w-3.5 h-3.5 text-gray-400" />
              <span>Host/Mod controlled</span>
              {onRequestAction && (
                <button
                  type="button"
                  onClick={() => setShowSeekRequestModal(true)}
                  className="ml-1 text-[11px] text-emerald-600 hover:text-emerald-700 underline font-semibold"
                >
                  Request Seek
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Volume & Fullscreen */}
        <div className="flex items-center gap-3">
          {/* Volume controls */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200/80">
            <button
              onClick={onToggleMute}
              className="text-gray-500 hover:text-gray-800 transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-gray-600" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-16 sm:w-20 h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-emerald-600"
              title={`Volume: ${isMuted ? 0 : volume}%`}
            />
          </div>

          {/* Fullscreen toggle */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200/80 text-gray-600 hover:text-gray-900 flex items-center justify-center transition-all"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Participant seek requests must choose an actual target timestamp. */}
      {showSeekRequestModal && !canControl && hasVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 max-w-xs w-full shadow-2xl">
            <h4 className="text-sm font-bold text-gray-900 mb-2">Request Seek Time</h4>
            <p className="text-xs text-gray-500 mb-3">Choose where you want the room video to jump. The Host or Moderator must approve it.</p>
            <form onSubmit={submitSeekRequest} className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Min"
                  value={seekRequestMinutes}
                  onChange={(event) => setSeekRequestMinutes(event.target.value)}
                  className="w-1/2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-emerald-500"
                  required
                />
                <span className="text-gray-400 font-bold">:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  step="1"
                  placeholder="Sec"
                  value={seekRequestSeconds}
                  onChange={(event) => setSeekRequestSeconds(event.target.value)}
                  className="w-1/2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSeekRequestModal(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-100 text-xs font-medium text-gray-600"
                  disabled={isSubmittingSeekRequest}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSeekRequest || !seekRequestMinutes}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {isSubmittingSeekRequest ? 'Sending…' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaybackControls;
