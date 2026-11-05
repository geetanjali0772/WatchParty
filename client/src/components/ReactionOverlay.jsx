import React from 'react';

// Pre-calculated pseudo-random horizontal offsets to spread animations nicely
const offsets = [15, 30, 45, 60, 75, 85, 25, 40, 55, 70];

export const ReactionOverlay = ({ reactions = [] }) => {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {reactions.map((reaction, index) => {
        const leftPercent = offsets[index % offsets.length];
        return (
          <div
            key={reaction.id || `${reaction.timestamp}-${index}`}
            className="absolute bottom-12 flex flex-col items-center animate-reaction-float"
            style={{
              left: `${leftPercent}%`,
            }}
          >
            <span className="text-3xl sm:text-4xl filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] select-none">
              {reaction.emoji}
            </span>
            {reaction.username && (
              <span className="text-[10px] text-white/90 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-full mt-1 font-medium whitespace-nowrap shadow-md">
                {reaction.username}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ReactionOverlay;

