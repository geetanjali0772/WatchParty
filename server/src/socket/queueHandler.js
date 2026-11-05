import crypto from 'crypto';
import { Room } from '../models/Room.js';
import { Participant } from '../models/Participant.js';
import { canControlPlayback, canReviewRequests, canSubmitRequests } from '../services/permissionService.js';
import { extractYoutubeId } from '../utils/extractYoutubeId.js';

const MAX_QUEUE_SIZE = 50;
const MAX_PENDING_VIDEO_REQUESTS = 30;

const queueSnapshot = (room) => ({
  videoQueue: room.videoQueue || [],
  pendingVideoRequests: room.pendingVideoRequests || [],
});

export const registerQueueHandlers = (io, socket) => {
  const getRoomParticipant = async () => {
    const roomId = socket.data?.roomId;
    const userId = socket.data?.userId;
    if (!roomId || !userId) return { error: { message: 'Join a room first.', code: 'UNAUTHORIZED' } };

    const [room, participant] = await Promise.all([
      Room.findOne({ roomId }),
      Participant.findOne({ roomId, userId, isOnline: true }),
    ]);

    if (!room) return { error: { message: 'Room not found.', code: 'ROOM_NOT_FOUND' } };
    if (!participant) return { error: { message: 'You are not an active participant in this room.', code: 'UNAUTHORIZED' } };
    if (room.bannedUserIds?.includes(userId)) {
      return { error: { message: 'You have been removed from this room.', code: 'USER_REMOVED' } };
    }
    return { room, participant, roomId, userId };
  };

  const fail = (ack, message, code = 'QUEUE_ERROR') => {
    const result = { success: false, message, code };
    socket.emit('error', { message, code });
    if (typeof ack === 'function') ack(result);
  };

  const broadcastQueue = (roomId, room) => {
    io.to(roomId).emit('queue_updated', queueSnapshot(room));
  };

  // Host/Moderator add a video directly to the persistent queue.
  socket.on('add_to_queue', async (data, ack = () => {}) => {
    try {
      const auth = await getRoomParticipant();
      if (auth.error) return fail(ack, auth.error.message, auth.error.code);
      const { room, participant, roomId, userId } = auth;
      if (!canControlPlayback(participant.role)) {
        return fail(ack, 'Only the Host or a Moderator can add videos directly to the queue.', 'FORBIDDEN');
      }

      const videoId = extractYoutubeId(data?.url || data?.videoId);
      if (!videoId) return fail(ack, 'Paste a valid YouTube URL or 11-character video ID.', 'INVALID_VIDEO_URL');
      if ((room.videoQueue || []).length >= MAX_QUEUE_SIZE) {
        return fail(ack, `The watch queue is full (maximum ${MAX_QUEUE_SIZE} videos).`, 'QUEUE_FULL');
      }
      if (room.currentVideoId === videoId || room.videoQueue.some((item) => item.videoId === videoId)) {
        return fail(ack, 'This video is already playing or is already in the queue.', 'DUPLICATE_QUEUE_ITEM');
      }

      room.videoQueue.push({
        itemId: crypto.randomUUID(),
        videoId,
        addedByUserId: userId,
        addedByUsername: participant.username,
        addedAt: new Date(),
      });
      await room.save();
      broadcastQueue(roomId, room);
      if (typeof ack === 'function') ack({ success: true, data: queueSnapshot(room) });
    } catch (error) {
      console.error('[Queue] add_to_queue error:', error);
      fail(ack, 'Could not add this video to the queue.', 'QUEUE_ERROR');
    }
  });

  // Participants suggest a video; it is not added until Host/Moderator approval.
  socket.on('request_queue_video', async (data, ack = () => {}) => {
    try {
      const auth = await getRoomParticipant();
      if (auth.error) return fail(ack, auth.error.message, auth.error.code);
      const { room, participant, roomId, userId } = auth;
      if (!canSubmitRequests(participant.role)) {
        return fail(ack, 'Only Participants should submit video suggestions. Host and Moderators can add videos directly.', 'FORBIDDEN');
      }

      const videoId = extractYoutubeId(data?.url || data?.videoId);
      if (!videoId) return fail(ack, 'Paste a valid YouTube URL or 11-character video ID.', 'INVALID_VIDEO_URL');
      if (room.currentVideoId === videoId || room.videoQueue.some((item) => item.videoId === videoId)) {
        return fail(ack, 'This video is already playing or is already in the queue.', 'DUPLICATE_QUEUE_ITEM');
      }
      if (room.pendingVideoRequests.some((request) => request.videoId === videoId && request.userId === userId)) {
        return fail(ack, 'You have already requested this video.', 'DUPLICATE_REQUEST');
      }
      if (room.pendingVideoRequests.length >= MAX_PENDING_VIDEO_REQUESTS) {
        return fail(ack, 'There are too many pending video suggestions. Please try again later.', 'REQUEST_LIMIT');
      }

      const request = {
        requestId: crypto.randomUUID(),
        videoId,
        userId,
        username: participant.username,
        createdAt: new Date(),
      };
      room.pendingVideoRequests.push(request);
      await room.save();

      io.to(roomId).emit('video_request_received', {
        request,
        ...queueSnapshot(room),
      });
      if (typeof ack === 'function') ack({ success: true, data: { request, ...queueSnapshot(room) } });
    } catch (error) {
      console.error('[Queue] request_queue_video error:', error);
      fail(ack, 'Could not submit this video suggestion.', 'QUEUE_ERROR');
    }
  });

  // Host/Moderator approves a participant suggestion and appends it to the queue.
  socket.on('approve_video_request', async (data, ack = () => {}) => {
    try {
      const auth = await getRoomParticipant();
      if (auth.error) return fail(ack, auth.error.message, auth.error.code);
      const { room, participant, roomId } = auth;
      if (!canReviewRequests(participant.role)) {
        return fail(ack, 'Only the Host or a Moderator can approve video suggestions.', 'FORBIDDEN');
      }

      const requestId = data?.requestId;
      const requestIndex = room.pendingVideoRequests.findIndex((item) => item.requestId === requestId);
      if (requestIndex < 0) return fail(ack, 'Video suggestion not found or already processed.', 'REQUEST_NOT_FOUND');
      if (room.videoQueue.length >= MAX_QUEUE_SIZE) return fail(ack, `The watch queue is full (maximum ${MAX_QUEUE_SIZE} videos).`, 'QUEUE_FULL');

      const [request] = room.pendingVideoRequests.splice(requestIndex, 1);
      if (room.currentVideoId !== request.videoId && !room.videoQueue.some((item) => item.videoId === request.videoId)) {
        room.videoQueue.push({
          itemId: crypto.randomUUID(),
          videoId: request.videoId,
          addedByUserId: request.userId,
          addedByUsername: request.username,
          addedAt: new Date(),
        });
      }
      await room.save();

      const result = {
        requestId,
        approved: true,
        requesterUserId: request.userId,
        decidedBy: { userId: auth.userId, username: participant.username },
        ...queueSnapshot(room),
      };
      io.to(roomId).emit('video_request_resolved', result);
      broadcastQueue(roomId, room);
      if (typeof ack === 'function') ack({ success: true, data: result });
    } catch (error) {
      console.error('[Queue] approve_video_request error:', error);
      fail(ack, 'Could not approve this video suggestion.', 'QUEUE_ERROR');
    }
  });

  socket.on('reject_video_request', async (data, ack = () => {}) => {
    try {
      const auth = await getRoomParticipant();
      if (auth.error) return fail(ack, auth.error.message, auth.error.code);
      const { room, participant, roomId } = auth;
      if (!canReviewRequests(participant.role)) {
        return fail(ack, 'Only the Host or a Moderator can reject video suggestions.', 'FORBIDDEN');
      }

      const requestId = data?.requestId;
      const requestIndex = room.pendingVideoRequests.findIndex((item) => item.requestId === requestId);
      if (requestIndex < 0) return fail(ack, 'Video suggestion not found or already processed.', 'REQUEST_NOT_FOUND');

      const [request] = room.pendingVideoRequests.splice(requestIndex, 1);
      await room.save();
      const result = {
        requestId,
        approved: false,
        requesterUserId: request.userId,
        decidedBy: { userId: auth.userId, username: participant.username },
        ...queueSnapshot(room),
      };
      io.to(roomId).emit('video_request_resolved', result);
      broadcastQueue(roomId, room);
      if (typeof ack === 'function') ack({ success: true, data: result });
    } catch (error) {
      console.error('[Queue] reject_video_request error:', error);
      fail(ack, 'Could not reject this video suggestion.', 'QUEUE_ERROR');
    }
  });

  socket.on('remove_from_queue', async (data, ack = () => {}) => {
    try {
      const auth = await getRoomParticipant();
      if (auth.error) return fail(ack, auth.error.message, auth.error.code);
      const { room, participant, roomId } = auth;
      if (!canControlPlayback(participant.role)) {
        return fail(ack, 'Only the Host or a Moderator can remove queue items.', 'FORBIDDEN');
      }

      const itemId = data?.itemId;
      const before = room.videoQueue.length;
      room.videoQueue = room.videoQueue.filter((item) => item.itemId !== itemId);
      if (room.videoQueue.length === before) return fail(ack, 'Queue item not found.', 'QUEUE_ITEM_NOT_FOUND');
      await room.save();
      broadcastQueue(roomId, room);
      if (typeof ack === 'function') ack({ success: true, data: queueSnapshot(room) });
    } catch (error) {
      console.error('[Queue] remove_from_queue error:', error);
      fail(ack, 'Could not remove this queue item.', 'QUEUE_ERROR');
    }
  });

  // Play Next pops the oldest item and makes it the authoritative room video.
  socket.on('play_next_video', async (_data, ack = () => {}) => {
    try {
      const auth = await getRoomParticipant();
      if (auth.error) return fail(ack, auth.error.message, auth.error.code);
      const { room, participant, roomId, userId } = auth;
      if (!canControlPlayback(participant.role)) {
        return fail(ack, 'Only the Host or a Moderator can play the next queued video.', 'FORBIDDEN');
      }
      if (!room.videoQueue.length) return fail(ack, 'The watch queue is empty.', 'QUEUE_EMPTY');

      const [nextItem] = room.videoQueue.splice(0, 1);
      room.currentVideoId = nextItem.videoId;
      room.currentTime = 0;
      room.playbackState = 'playing';
      room.lastUpdated = new Date();
      await room.save();

      io.to(roomId).emit('video_changed', {
        currentVideoId: room.currentVideoId,
        currentTime: 0,
        playbackState: 'playing',
        lastUpdated: room.lastUpdated,
        updatedBy: { userId, username: participant.username, role: participant.role },
        queueItem: nextItem,
      });
      broadcastQueue(roomId, room);
      if (typeof ack === 'function') ack({ success: true, data: { played: nextItem, ...queueSnapshot(room) } });
    } catch (error) {
      console.error('[Queue] play_next_video error:', error);
      fail(ack, 'Could not play the next queued video.', 'QUEUE_ERROR');
    }
  });
};
