import React, { useState } from 'react';
import {
  Bell,
  Check,
  X,
  Play,
  Pause,
  Clock,
  Film,
  Sparkles,
} from 'lucide-react';
import { formatTime } from '../utils/youtube';

export const RequestPanel = ({
  pendingRequests = [],
  canReview = false,
  isParticipant = false,
  currentPlaybackTime = 0,
  onApprove,
  onReject,
  onSubmitRequest,
}) => {
  const [showSeekModal, setShowSeekModal] = useState(false);
  const [seekMinutes, setSeekMinutes] = useState('');
  const [seekSeconds, setSeekSeconds] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState(null);

  const handleSeekSubmit = async (e) => {
    e.preventDefault();
    const min = Number(seekMinutes);
    const sec = Number(seekSeconds || 0);
    if (!Number.isInteger(min) || min < 0 || !Number.isInteger(sec) || sec < 0 || sec > 59) return;

    const totalSec = min * 60 + sec;
    setSubmitting(true);
    try {
      await onSubmitRequest('seek', { currentTime: totalSec });
      setShowSeekModal(false);
      setSeekMinutes('');
      setSeekSeconds('');
    } catch (err) {
      // Keep the dialog open so the participant can correct/retry.
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (action, requestId) => {
    setProcessingRequestId(requestId);
    try {
      await action(requestId);
    } catch (err) {
      // The shared context displays the server error.
    } finally {
      setProcessingRequestId(null);
    }
  };

  const getActionLabel = (type, payload) => {
    switch (type) {
      case 'play':
        return 'Play the video';
      case 'pause':
        return 'Pause';
      case 'seek':
        return `Seek to ${formatTime(payload?.currentTime || 0)}`;
      case 'change_video':
        return 'Change the video';
      default:
        return type;
    }
  };

  return (
    <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-sm space-y-3">
      {/* Header matching Screenshot 2: Playback Requests (1) + Spark icon */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-sm text-gray-900">
            Playback Requests ({pendingRequests.length})
          </h3>
        </div>
        <Sparkles className="w-4 h-4 text-amber-400" />
      </div>

      {/* For Host/Moderator: Pending approval queue */}
      {canReview && (
        <div className="space-y-3">
          {pendingRequests.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">
              No pending participant requests.
            </p>
          ) : (
            pendingRequests.map((req) => (
              <div
                key={req.requestId}
                className="p-3 rounded-xl bg-gray-50/80 border border-gray-200/80 space-y-2.5 text-xs"
              >
                {/* User info & request description */}
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {req.username ? req.username.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-800 font-semibold truncate">
                      {req.username} <span className="font-normal text-gray-500">requested to</span> {getActionLabel(req.type, req.payload)}
                    </p>
                    <p className="text-[10px] text-gray-400">Just now</p>
                  </div>
                </div>

                {/* Approve / Reject buttons matching Screenshot 2 */}
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    onClick={() => handleReview(onReject, req.requestId)}
                    disabled={processingRequestId === req.requestId}
                    className="flex-1 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs border border-emerald-200/70 flex items-center justify-center gap-1 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>

                  <button
                    onClick={() => handleReview(onApprove, req.requestId)}
                    disabled={processingRequestId === req.requestId}
                    className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1 shadow-sm shadow-emerald-600/20 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* For Participant: Request Actions Toolbar */}
      {isParticipant && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            Ask Host & Moderators to adjust playback:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onSubmitRequest('play', { currentTime: currentPlaybackTime })}
              className="py-2 px-2.5 rounded-xl bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 text-gray-700 hover:text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
              <span>Play</span>
            </button>

            <button
              onClick={() => onSubmitRequest('pause', { currentTime: currentPlaybackTime })}
              className="py-2 px-2.5 rounded-xl bg-gray-50 hover:bg-amber-50 border border-gray-200 hover:border-amber-200 text-gray-700 hover:text-amber-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Pause className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Pause</span>
            </button>

            <button
              onClick={() => setShowSeekModal(true)}
              className="py-2 px-2.5 rounded-xl bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 text-gray-700 hover:text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Seek</span>
            </button>
          </div>
        </div>
      )}

      {/* Seek Request Modal */}
      {showSeekModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 max-w-xs w-full shadow-2xl">
            <h4 className="text-sm font-bold text-gray-900 mb-2">Request Seek Time</h4>
            <form onSubmit={handleSeekSubmit} className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Min"
                  value={seekMinutes}
                  onChange={(e) => setSeekMinutes(e.target.value)}
                  className="w-1/2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-emerald-500"
                />
                <span className="text-gray-400 font-bold">:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="Sec"
                  value={seekSeconds}
                  onChange={(e) => setSeekSeconds(e.target.value)}
                  className="w-1/2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSeekModal(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-100 text-xs font-medium text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !seekMinutes}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestPanel;
