import React, { useState } from 'react';
import { Check, Clock3, ListOrdered, Play, Trash2, X } from 'lucide-react';

const youtubeUrl = (videoId) => `https://www.youtube.com/watch?v=${videoId}`;

const VideoRow = ({ videoId, title, subtitle, right }) => (
  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2.5">
    <img
      src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
      alt="YouTube video thumbnail"
      className="h-14 w-24 rounded-lg object-cover bg-gray-100 shrink-0"
      loading="lazy"
      onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
    />
    <div className="min-w-0 flex-1">
      <a href={youtubeUrl(videoId)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-gray-800 hover:text-emerald-700 break-all">
        {title || videoId}
      </a>
      {subtitle && <p className="mt-1 text-[10px] text-gray-500">{subtitle}</p>}
    </div>
    {right}
  </div>
);

export const WatchQueuePanel = ({
  currentVideoId,
  videoQueue = [],
  pendingVideoRequests = [],
  canManageQueue = false,
  onApprove,
  onReject,
  onRemove,
  onPlayNext,
}) => {
  const [busyId, setBusyId] = useState(null);

  const run = async (id, action) => {
    setBusyId(id);
    try {
      await action(id);
    } catch (error) {
      // The RoomContext displays the server's acknowledgement error.
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-emerald-600" /> Watch Queue
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            {canManageQueue
              ? 'Add videos from the URL bar. Participant suggestions appear below for approval.'
              : 'Suggest a video from the URL bar. It enters the queue after Host/Moderator approval.'}
          </p>
        </div>
        {canManageQueue && videoQueue.length > 0 && (
          <button
            type="button"
            disabled={Boolean(busyId)}
            onClick={() => run('next', onPlayNext)}
            className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Play className="h-3.5 w-3.5 fill-current" /> Play Next
          </button>
        )}
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-gray-800">Currently Playing</h4>
          <span className="text-[10px] text-emerald-700 font-semibold">Live</span>
        </div>
        {currentVideoId ? (
          <VideoRow videoId={currentVideoId} title={currentVideoId} subtitle="Current room video" />
        ) : (
          <p className="rounded-xl border border-dashed border-gray-200 p-3 text-xs text-gray-400 text-center">No video is playing right now.</p>
        )}
      </section>

      {canManageQueue && (
        <section className="space-y-2">
          <h4 className="text-xs font-bold text-gray-800">Participant Suggestions ({pendingVideoRequests.length})</h4>
          {pendingVideoRequests.length === 0 ? (
            <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-400 text-center">No pending video suggestions.</p>
          ) : (
            pendingVideoRequests.map((request) => (
              <VideoRow
                key={request.requestId}
                videoId={request.videoId}
                subtitle={`Suggested by ${request.username || 'Participant'}`}
                right={(
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => run(request.requestId, onApprove)}
                      className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <Check className="h-3 w-3" /> Approve
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => run(request.requestId, onReject)}
                      className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600 disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <X className="h-3 w-3" /> Reject
                    </button>
                  </div>
                )}
              />
            ))
          )}
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-gray-800">Up Next ({videoQueue.length})</h4>
          <span className="text-[10px] text-gray-400">First in list plays next</span>
        </div>
        {videoQueue.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 p-3 text-xs text-gray-400 text-center">
            Queue is empty. {canManageQueue ? 'Add a video using the URL bar below the player.' : 'Request a video and wait for approval.'}
          </p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {videoQueue.map((item, index) => (
              <VideoRow
                key={item.itemId}
                videoId={item.videoId}
                title={`${index + 1}. ${item.videoId}`}
                subtitle={`Added by ${item.addedByUsername || 'Member'}`}
                right={canManageQueue ? (
                  <button
                    type="button"
                    title="Remove from queue"
                    disabled={Boolean(busyId)}
                    onClick={() => run(item.itemId, onRemove)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="text-[10px] text-gray-400 inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> Queued</span>
                )}
              />
            ))}
          </div>
        )}
      </section>

      <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3 text-[11px] leading-relaxed text-emerald-900">
        <strong>How it works:</strong> Host/Moderators can add or remove queued videos and play the next item. Participants can suggest videos, but each suggestion needs Host/Moderator approval before it joins the shared queue. The queue is saved with the room and shared live with everyone.
      </div>
    </div>
  );
};

export default WatchQueuePanel;
