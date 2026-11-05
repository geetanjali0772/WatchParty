import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Smile, CheckCheck } from 'lucide-react';
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

export const ChatPanel = ({
  messages = [],
  currentUserId,
  onSendMessage,
}) => {
  const [content, setContent] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    if (trimmed.length > 500) return;

    onSendMessage(trimmed);
    setContent('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTime = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200/90 overflow-hidden shadow-sm">
      {/* Header matching Screenshot 2: 💬 Room Chat */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-sm text-gray-900">Room Chat</h3>
        </div>
        <span className="text-[11px] text-gray-400 font-medium">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </span>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-[220px] max-h-[380px] custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-2">
            <Smile className="w-8 h-8 text-gray-300" />
            <p className="text-xs font-medium">No messages yet.</p>
            <p className="text-[11px] text-gray-400">Say hello to everyone in the room!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.userId === currentUserId;
            const initials = msg.username ? msg.username.slice(0, 2).toUpperCase() : '?';

            return (
              <div
                key={msg._id || index}
                className={`flex gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {/* Avatar for received messages */}
                {!isMe && (
                  <div
                    className={`w-7 h-7 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                      msg.username
                    )} flex items-center justify-center font-bold text-white text-[10px] shrink-0 mt-1 shadow-sm`}
                  >
                    {initials}
                  </div>
                )}

                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                  {!isMe && (
                    <span className="text-[11px] font-semibold text-gray-800 mb-1">
                      {msg.username}
                    </span>
                  )}

                  {/* Message Bubble matching Screenshot 2 */}
                  <div
                    className={`px-3.5 py-2 rounded-2xl text-xs break-words leading-relaxed shadow-sm ${
                      isMe
                        ? 'bg-[#E6F7ED] text-emerald-950 border border-emerald-200/60 rounded-tr-sm'
                        : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Timestamp & double checkmarks */}
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400">
                    <span>{formatTime(msg.createdAt)}</span>
                    {isMe && <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form matching Screenshot 2 */}
      <form onSubmit={handleSubmit} className="p-2.5 border-t border-gray-100 bg-white">
        <div className="relative flex items-center gap-2 bg-gray-50 border border-gray-200/80 rounded-full px-3 py-1.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
          <Smile className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            maxLength={500}
            className="flex-1 bg-transparent border-0 text-xs text-gray-900 placeholder-gray-400 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!content.trim()}
            className="w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-sm shrink-0"
            title="Send Message"
          >
            <Send className="w-3 h-3 ml-0.5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;
