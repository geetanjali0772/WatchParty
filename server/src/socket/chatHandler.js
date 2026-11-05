import { Message } from '../models/Message.js';
import { Room } from '../models/Room.js';
import { Participant } from '../models/Participant.js';
import { sanitizeHtml } from '../utils/sanitize.js';

// Sliding-window rate limiter: max 5 messages per 5 seconds per user
const chatRateLimits = new Map();
const RATE_LIMIT_WINDOW_MS = 5000;
const MAX_MESSAGES_PER_WINDOW = 5;

const isRateLimited = (userId) => {
  const now = Date.now();
  const timestamps = chatRateLimits.get(userId) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= MAX_MESSAGES_PER_WINDOW) {
    chatRateLimits.set(userId, recent);
    return true;
  }

  recent.push(now);
  chatRateLimits.set(userId, recent);
  return false;
};

export const registerChatHandlers = (io, socket) => {
  socket.on('send_message', async (data) => {
    try {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;

      if (!roomId || !userId) {
        return socket.emit('error', {
          message: 'Unauthorized: You must join a room before sending messages',
          code: 'UNAUTHORIZED',
        });
      }

      const { content } = data || {};
      if (typeof content !== 'string' || !content.trim()) {
        return socket.emit('error', {
          message: 'Message content cannot be empty',
          code: 'INVALID_MESSAGE',
        });
      }

      const trimmed = content.trim();
      if (trimmed.length > 500) {
        return socket.emit('error', {
          message: 'Message exceeds maximum length of 500 characters',
          code: 'MESSAGE_TOO_LONG',
        });
      }

      // Check rate limiting
      if (isRateLimited(userId)) {
        return socket.emit('error', {
          message: 'You are sending messages too fast. Please slow down.',
          code: 'RATE_LIMITED',
        });
      }

      // Verify room existence and ban status
      const cleanRoomId = roomId.toUpperCase().trim();
      const room = await Room.findOne({ roomId: cleanRoomId });
      if (!room) {
        return socket.emit('error', { message: 'Room not found', code: 'ROOM_NOT_FOUND' });
      }

      if (room.bannedUserIds && room.bannedUserIds.includes(userId)) {
        return socket.emit('error', {
          message: 'Unauthorized: You have been removed from this room',
          code: 'USER_REMOVED',
        });
      }

      // Verify participant exists in this room
      const participant = await Participant.findOne({ roomId: cleanRoomId, userId });
      if (!participant) {
        return socket.emit('error', {
          message: 'Unauthorized: Participant not found in room',
          code: 'UNAUTHORIZED',
        });
      }

      // Sanitize against XSS
      const sanitized = sanitizeHtml(trimmed);

      // Save to database
      const messageDoc = await Message.create({
        roomId,
        userId,
        username: participant.username,
        role: participant.role,
        content: sanitized,
      });

      const messagePayload = {
        _id: messageDoc._id,
        roomId: messageDoc.roomId,
        userId: messageDoc.userId,
        username: messageDoc.username,
        role: messageDoc.role,
        content: messageDoc.content,
        createdAt: messageDoc.createdAt,
      };

      // Broadcast exclusively to participants in this room
      io.to(roomId).emit('new_message', { message: messagePayload });

      console.log(`[Chat] ${participant.username} sent message in ${roomId}`);
    } catch (err) {
      console.error('[Socket] send_message error:', err);
      socket.emit('error', { message: 'Failed to send message', code: 'CHAT_ERROR' });
    }
  });
};

