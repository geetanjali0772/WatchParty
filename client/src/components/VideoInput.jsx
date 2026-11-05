import React, { useState } from 'react';
import { Link2, ArrowRight, Send, Shuffle } from 'lucide-react';
import { extractYoutubeId } from '../utils/youtube';

export const VideoInput = ({
  canControl = false,
  onChangeVideo,
  onRequestVideoChange,
}) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Please enter a YouTube video URL or ID.');
      return;
    }

    const videoId = extractYoutubeId(url);
    if (!videoId) {
      setError('Invalid YouTube link. Please paste a valid YouTube watch or share URL.');
      return;
    }

    if (canControl) {
      onChangeVideo(url);
      setUrl('');
    } else {
      onRequestVideoChange(url);
      setUrl('');
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="bg-white border border-gray-200/90 rounded-xl p-1.5 pl-3.5 shadow-sm">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="text-gray-400 pointer-events-none shrink-0">
            <Link2 className="w-4 h-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError('');
            }}
            placeholder="Paste YouTube URL (e.g., https://youtube.com/watch?v=...)"
            className="flex-1 bg-transparent border-0 text-sm focus:outline-none text-gray-800 placeholder-gray-400"
          />

          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 font-semibold text-white flex items-center justify-center gap-1.5 text-xs shadow-sm transition-all shrink-0 active:scale-95"
          >
            {canControl ? (
              <>
                <Shuffle className="w-3.5 h-3.5" />
                <span>Change Video</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Request Video</span>
              </>
            )}
          </button>
        </form>
      </div>

      {error && (
        <p className="text-xs text-rose-500 px-2 font-medium">
          {error}
        </p>
      )}
    </div>
  );
};

export default VideoInput;
