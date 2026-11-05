import React from 'react';

const REACTIONS = ['❤️', '🔥', '😂', '👏', '🎉', '😮'];

export const ReactionPicker = ({ onSelectReaction }) => {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-2xl bg-white border border-gray-200/90 shadow-sm">
      <span className="text-[11px] font-semibold text-gray-400 mr-1 hidden sm:inline select-none">
        React:
      </span>
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelectReaction(emoji)}
          className="text-lg sm:text-xl p-1 rounded-lg hover:bg-emerald-50 hover:scale-125 active:scale-95 transition-all duration-150 select-none"
          title={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default ReactionPicker;
