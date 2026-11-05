import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, ArrowUp, ArrowDown, Trash2, Crown, ShieldAlert } from 'lucide-react';
import RoleBadge from './RoleBadge';

// Helper to generate consistent avatar background colors based on username
const getAvatarGradient = (name = '') => {
  const gradients = [
    'from-emerald-500 to-teal-600',
    'from-blue-500 to-indigo-600',
    'from-amber-500 to-orange-600',
    'from-purple-500 to-pink-600',
    'from-rose-500 to-red-600',
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return gradients[sum % gradients.length];
};

export const ParticipantCard = ({
  participant,
  isSelf,
  isCurrentUserHost,
  onPromote,
  onDemote,
  onRemove,
  onTransferHost,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const initials = participant.username
    ? participant.username.slice(0, 2).toUpperCase()
    : '??';

  const canManageThisUser = isCurrentUserHost && !isSelf && participant.role !== 'Host';

  const handleConfirmTransfer = () => {
    if (onTransferHost) {
      onTransferHost(participant.userId);
    }
    setShowTransferModal(false);
  };

  return (
    <>
      <div className="relative flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50/80 border border-transparent hover:border-gray-100 transition-all">
        {/* Left: Avatar & Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div
              className={`w-9 h-9 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                participant.username
              )} flex items-center justify-center font-bold text-white text-xs shadow-inner`}
            >
              {initials}
            </div>
            {/* Green online indicator dot */}
            <span
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                participant.isOnline ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs sm:text-sm text-gray-900 truncate">
                {participant.username}
              </span>
              {isSelf && (
                <span className="text-[11px] font-medium text-gray-500">
                  (You)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Role Badge & Action Menu */}
        <div className="flex items-center gap-2 shrink-0">
          <RoleBadge role={participant.role} />

          {canManageThisUser && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Manage Participant"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-white border border-gray-200 shadow-xl z-30 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-150">
                  {participant.role === 'Participant' && (
                    <button
                      onClick={() => {
                        onPromote(participant.userId);
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-left font-medium"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                      Promote to Moderator
                    </button>
                  )}

                  {participant.role === 'Moderator' && (
                    <button
                      onClick={() => {
                        onDemote(participant.userId);
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors text-left font-medium"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-amber-600" />
                      Demote to Participant
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setShowTransferModal(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-amber-700 hover:bg-amber-50 transition-colors text-left font-medium"
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    Transfer Host Role
                  </button>

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    onClick={() => {
                      onRemove(participant.userId);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-rose-600 hover:bg-rose-50 transition-colors text-left font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    Remove Participant
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transfer Host Confirmation Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-1">
              Transfer Host Ownership?
            </h3>
            <p className="text-xs text-gray-500 text-center mb-5 leading-relaxed">
              Are you sure you want to transfer Host control to{' '}
              <span className="font-semibold text-emerald-700">{participant.username}</span>? You
              will become a regular Participant.
            </p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmTransfer}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white transition-colors shadow-md shadow-emerald-600/20"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ParticipantCard;
