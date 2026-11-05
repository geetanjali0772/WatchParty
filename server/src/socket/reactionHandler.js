import crypto from 'crypto';
import { Room } from '../models/Room.js';
import { Participant } from '../models/Participant.js';

export const ALLOWED_EMOJIS = ['❤️', '🔥', '😂', '👏', '🎉', '😮'];

// Rate limiter: max 8 reactions per 3 seconds per user
const reactionRateLimits = new Map();
const RATE_LIMIT_WINDOW_MS = 3000;
const MAX_REACTIONS_PER_WINDOW = 8;

const isReactionRateLimited = (userId) => {
  const now = Date.now();
  const timestamps = reactionRateLimits.get(userId) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= MAX_REACTIONS_PER_WINDOW) {
    reactionRateLimits.set(userId, recent);
    return true;
  }

  recent.push(now);
  reactionRateLimits.set(userId, recent);
  return false;
};

export const registerReactionHandlers = (io, socket) => {
  socket.on('send_reaction', async (data, ack = () => {}) => {
    try {
      const roomId = socket.data?.roomId;
      const userId = socket.data?.userId || socket.user?.userId;

      const fail = (message, code) => {
        const payload = { message, code };
        socket.emit('error', payload);
        if (typeof ack === 'function') ack({ success: false, ...payload });
      };
      if (!roomId || !userId) {
        return fail('Unauthorized: You must join a room before sending reactions', 'UNAUTHORIZED');
      }

      // 1. Verify that room exists
      const cleanRoomId = roomId.toUpperCase().trim();
      const room = await Room.findOne({ roomId: cleanRoomId });
      if (!room) {
        return fail('Room not found', 'ROOM_NOT_FOUND');
      }

      // 2. Reject removed or banned participants
      if (room.bannedUserIds && room.bannedUserIds.includes(userId)) {
        return fail('Unauthorized: You have been removed from this room', 'USER_REMOVED');
      }

      // 3. Verify that participant exists in MongoDB for this room
      const participant = await Participant.findOne({ roomId: cleanRoomId, userId });
      if (!participant) {
        return fail('Unauthorized: Participant not found in room', 'UNAUTHORIZED');
      }

      // 4. Validate emoji whitelist
      const { emoji } = data || {};
      if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
        return fail(`Invalid emoji reaction. Allowed: ${ALLOWED_EMOJIS.join(' ')}`, 'INVALID_REACTION');
      }

      // 5. Enforce sliding window rate limit
      if (isReactionRateLimited(userId)) {
        return fail('Reaction rate limit exceeded. Please wait a moment.', 'RATE_LIMITED');
      }

      const reactionPayload = {
        id: crypto.randomUUID(),
        emoji,
        userId: participant.userId,
        username: participant.username,
        timestamp: Date.now(),
      };

      // 6. Broadcast reaction exclusively to participants in this room
      io.to(cleanRoomId).emit('new_reaction', reactionPayload);
      if (typeof ack === 'function') ack({ success: true, data: reactionPayload });
    } catch (err) {
      console.error('[Socket] send_reaction error:', err);
      const payload = { message: 'Failed to process reaction', code: 'REACTION_ERROR' };
      socket.emit('error', payload);
      if (typeof ack === 'function') ack({ success: false, ...payload });
    }
  });
};
