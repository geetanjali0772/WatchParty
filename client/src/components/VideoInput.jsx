import React, { useState } from 'react';
import { Link2, Play, ListPlus, Send } from 'lucide-react';
import { extractYoutubeId } from '../utils/youtube';

export const VideoInput = ({
  canControl = false,
  onChangeVideo,
  onAddToQueue,
  onRequestQueueVideo,
}) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAction = async (action) => {
    if (!url.trim()) {
      setError('Please enter a YouTube video URL or ID.');
      return;
    }

    const videoId = extractYoutubeId(url);
    if (!videoId) {
      setError('Invalid YouTube link. Paste a valid YouTube URL or video ID.');
      return;
    }

    const callback = action === 'play'
      ? onChangeVideo
      : canControl
        ? onAddToQueue
        : onRequestQueueVideo;

    if (typeof callback !== 'function') {
      setError('This action is not available right now.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await callback(url);
      setUrl('');
    } catch (err) {
      setError(err?.message || 'Could not submit this video. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="bg-white border border-gray-200/90 rounded-xl p-1.5 pl-3.5 shadow-sm">
        <form onSubmit={(event) => {
          event.preventDefault();
          handleAction(canControl ? 'play' : 'request');
        }} className="flex flex-wrap items-center gap-2">
          <div className="text-gray-400 pointer-events-none shrink-0">
            <Link2 className="w-4 h-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={url}
            disabled={busy}
            onChange={(event) => {
              setUrl(event.target.value);
              if (error) setError('');
            }}
            placeholder="Paste YouTube URL (e.g., https://youtube.com/watch?v=...)"
            className="min-w-[180px] flex-1 bg-transparent border-0 text-sm focus:outline-none text-gray-800 placeholder-gray-400"
          />

          {canControl ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAction('play')}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 font-semibold text-white flex items-center justify-center gap-1.5 text-xs shadow-sm transition-all shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Now</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAction('queue')}
                className="px-3.5 py-2 rounded-lg bg-white hover:bg-emerald-50 disabled:opacity-50 border border-emerald-200 font-semibold text-emerald-700 flex items-center justify-center gap-1.5 text-xs transition-all shrink-0"
              >
                <ListPlus className="w-3.5 h-3.5" />
                <span>Add to Queue</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleAction('request')}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 font-semibold text-white flex items-center justify-center gap-1.5 text-xs shadow-sm transition-all shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Request Video</span>
            </button>
          )}
        </form>
      </div>
      {error && <p className="text-xs text-rose-500 px-2 font-medium">{error}</p>}
      <p className="text-[11px] text-gray-400 px-2">
        {canControl
          ? 'Play Now starts immediately. Add to Queue saves it for later.'
          : 'Your video suggestion will be added after Host/Moderator approval.'}
      </p>
    </div>
  );
};

export default VideoInput;
