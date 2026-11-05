import React from 'react';
import { Users, ChevronRight } from 'lucide-react';
import ParticipantCard from './ParticipantCard';

export const ParticipantsList = ({
  participants = [],
  currentUserId,
  isCurrentUserHost,
  onPromote,
  onDemote,
  onRemove,
  onTransferHost,
}) => {
  return (
    <div className="bg-white border border-gray-200/90 rounded-2xl p-4 flex flex-col h-full shadow-sm">
      {/* Header matching Screenshot 2: Participants (3) > */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-sm text-gray-900">
            Participants ({participants.length})
          </h3>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {participants.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            No participants in this room.
          </div>
        ) : (
          participants.map((p) => (
            <ParticipantCard
              key={p.userId}
              participant={p}
              isSelf={p.userId === currentUserId}
              isCurrentUserHost={isCurrentUserHost}
              onPromote={onPromote}
              onDemote={onDemote}
              onRemove={onRemove}
              onTransferHost={onTransferHost}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ParticipantsList;
