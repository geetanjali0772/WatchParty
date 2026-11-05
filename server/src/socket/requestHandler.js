import { Room } from '../models/Room.js';
import { Participant } from '../models/Participant.js';
import * as roomService from '../services/roomService.js';
import { canReviewRequests, canSubmitRequests } from '../services/permissionService.js';
import { extractYoutubeId } from '../utils/extractYoutubeId.js';

export const registerRequestHandlers = (io, socket) => {
  // Submit playback change request
  socket.on('playback_request', async (data, ack = () => {}) => {
    try {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;

      if (!roomId || !userId) {
        const errPayload = {
          message: 'Unauthorized: You must join a room before submitting requests',
          code: 'UNAUTHORIZED',
        };
        socket.emit('error', errPayload);
        if (typeof ack === 'function') ack({ success: false, ...errPayload });
        return;
      }

      const { type, payload = {} } = data || {};

      if (!type || !['play', 'pause', 'seek', 'change_video'].includes(type)) {
        const errPayload = { message: 'Invalid request type', code: 'INVALID_REQUEST_TYPE' };
        socket.emit('error', errPayload);
        if (typeof ack === 'function') ack({ success: false, ...errPayload });
        return;
      }

      const participant = await Participant.findOne({ roomId, userId });
      if (!participant) {
        const errPayload = {
          message: 'Unauthorized: Participant not found in room',
          code: 'UNAUTHORIZED',
        };
        socket.emit('error', errPayload);
        if (typeof ack === 'function') ack({ success: false, ...errPayload });
        return;
      }

      // Only Participants can submit playback requests (Fix 4)
      if (!canSubmitRequests(participant.role)) {
        const errPayload = {
          message: 'Permission denied: Only Participants can submit playback requests. Hosts and Moderators can control playback directly.',
          code: 'UNAUTHORIZED',
        };
        socket.emit('error', errPayload);
        if (typeof ack === 'function') ack({ success: false, ...errPayload });
        return;
      }

      // Seek requests must contain a real, non-negative timestamp.
      if (type === 'seek') {
        const requestedTime = Number(payload?.currentTime);
        if (!Number.isFinite(requestedTime) || requestedTime < 0) {
          const errPayload = {
            message: 'Invalid seek time. Enter a valid time of 0 seconds or more.',
            code: 'INVALID_TIMESTAMP',
          };
          if (typeof ack === 'function') ack({ success: false, ...errPayload });
          return;
        }
        payload.currentTime = requestedTime;
      }

      // If change_video, validate url before creating request
      if (type === 'change_video') {
        const videoId = extractYoutubeId(payload.url || payload.videoId);
        if (!videoId) {
          const errPayload = {
            message: 'Invalid YouTube URL or video ID for request.',
            code: 'INVALID_VIDEO_URL',
          };
          socket.emit('error', errPayload);
          if (typeof ack === 'function') ack({ success: false, ...errPayload });
          return;
        }
        payload.videoId = videoId;
      }

      const { request, pendingRequests } = await roomService.addRoomRequest({
        roomId,
        userId,
        username: participant.username,
        type,
        payload,
      });

      // Broadcast new request to everyone in the room
      io.to(roomId).emit('request_received', {
        request,
        pendingRequests,
      });

      if (typeof ack === 'function') {
        ack({
          success: true,
          data: {
            request,
            pendingRequests,
          },
        });
      }

      console.log(`[Request] ${participant.username} submitted request '${type}' in ${roomId}`);
    } catch (err) {
      console.error('[Socket] playback_request error:', err);
      const errPayload = { message: 'Failed to submit playback request', code: 'REQUEST_ERROR' };
      socket.emit('error', errPayload);
      if (typeof ack === 'function') ack({ success: false, ...errPayload });
    }
  });

  // Approve playback request
  socket.on('approve_request', async (data, ack = () => {}) => {
    try {
      const roomId = socket.data.roomId;
      const reviewerUserId = socket.data.userId;

      if (!roomId || !reviewerUserId) {
        const errPayload = {
          message: 'Unauthorized: You must join a room to approve requests',
          code: 'UNAUTHORIZED',
        };
        socket.emit('error', errPayload);
        if (typeof ack === 'function') ack({ success: false, ...errPayload });
        return;
      }

      const { requestId } = data || {};
      if (!requestId) {
        const errPayload = { message: 'Missing requestId', code: 'INVALID_PARAMS' };
        socket.emit('error', errPayload);
        if (typeof ack === 'function') ack({ success: false, ...errPayload });
        return;
      }

      const reviewer = await Participant.findOne({ roomId, userId: reviewerUserId });
      if (!reviewer || !canReviewRequests(reviewer.role)) {
        const errPayload = {
          message: 'Permission denied: Only Host and Moderator can approve requests',
          code: 'UNAUTHORIZED',
        };
        socket.emit('error', errPayload);
        if (typeof ack === 'function') ack({ success: false, ...errPayload });
        return;
      }

      const room = await Room.findOne({ roomId });
      if (!room) {
        const errPayload = { message: 'Room not found', code: 'ROOM_NOT_FOUND' };
        socket.emit('error', errPayload);
        if (typeof ack === 'function') ack({ success: false, ...errPayload });
        return;
      }

      const reqIndex = room.pendingRequests.findIndex((r) => r.requestId === requestId);
      if (reqIndex === -1) {
        const errPayload = { message: 'Request not found or already processed', code: 'NOT_FOUND' };
        socket.emit('error', errPayload);
        if (typeof ack === 'function') ack({ success: false, ...errPayload });
        return;
      }

      const targetRequest = room.pendingRequests[reqIndex];

      // Remove from pending
      room.pendingRequests.splice(reqIndex, 1);

      // Execute requested action
      let executedAction = null;
      if (targetRequest.type === 'play') {
        const currentTime = typeof targetRequest.payload?.currentTime === 'number'
          ? targetRequest.payload.currentTime
          : room.getCalculatedCurrentTime();

        room.playbackState = 'playing';
        room.currentTime = currentTime;
        room.lastUpdated = new Date();
        executedAction = { type: 'play', currentTime };
      } else if (targetRequest.type === 'pause') {
        const currentTime = typeof targetRequest.payload?.currentTime === 'number'
          ? targetRequest.payload.currentTime
          : room.getCalculatedCurrentTime();

        room.playbackState = 'paused';
        room.currentTime = currentTime;
        room.lastUpdated = new Date();
        executedAction = { type: 'pause', currentTime };
      } else if (targetRequest.type === 'seek') {
        const requestedTime = Number(targetRequest.payload?.currentTime);
        if (!Number.isFinite(requestedTime) || requestedTime < 0) {
          room.pendingRequests.splice(reqIndex, 0, targetRequest);
          const errPayload = { message: 'This seek request has an invalid timestamp.', code: 'INVALID_TIMESTAMP' };
          if (typeof ack === 'function') ack({ success: false, ...errPayload });
          return;
        }
        const currentTime = requestedTime;
        room.currentTime = currentTime;
        room.lastUpdated = new Date();
        executedAction = { type: 'seek', currentTime };
      } else if (targetRequest.type === 'change_video') {
        const videoId = targetRequest.payload?.videoId || extractYoutubeId(targetRequest.payload?.url);
        if (videoId) {
          room.currentVideoId = videoId;
          room.currentTime = 0;
          room.playbackState = 'playing';
          room.lastUpdated = new Date();
          executedAction = { type: 'change_video', videoId };
        }
      }

      await room.save();

      // Broadcast request approval
      io.to(roomId).emit('request_approved', {
        requestId,
        request: targetRequest,
        pendingRequests: room.pendingRequests,
        approvedBy: {
          userId: reviewer.userId,
          username: reviewer.username,
          role: reviewer.role,
        },
      });

      // Broadcast the executed playback/video change only after MongoDB confirms
      // the approved action. Seek gets its own command so every client performs
      // an explicit iframe seek, even when React's displayed time is unchanged.
      if (executedAction) {
        const updatedBy = {
          userId: reviewer.userId,
          username: `${targetRequest.username} (Approved by ${reviewer.username})`,
          role: reviewer.role,
        };

        if (executedAction.type === 'change_video') {
          io.to(roomId).emit('video_changed', {
            currentVideoId: room.currentVideoId,
            currentTime: 0,
            playbackState: room.playbackState,
            lastUpdated: room.lastUpdated,
            updatedBy,
          });
        } else if (executedAction.type === 'seek') {
          // A seek is an explicit player command, not just a timestamp update.
          // Broadcast one event so clients cannot process a generic sync first
          // and then overwrite the approved target with a stale iframe time.
          io.to(roomId).emit('seek_applied', {
            requestId,
            seekId: `${requestId}:${room.lastUpdated.getTime()}`,
            requestedByUserId: targetRequest.userId,
            currentVideoId: room.currentVideoId,
            currentTime: executedAction.currentTime,
            playbackState: room.playbackState,
            lastUpdated: room.lastUpdated,
            updatedBy,
          });
        } else {
          io.to(roomId).emit('playback_updated', {
            playbackState: room.playbackState,
            currentTime: room.currentTime,
            lastUpdated: room.lastUpdated,
            updatedBy,
          });
        }
      }

      if (typeof ack === 'function') {
        ack({
          success: true,
          data: {
            requestId,
            pendingRequests: room.pendingRequests,
          },
        });
      }

      console.log(`[Request] ${reviewer.username} approved request ${requestId} (${targetRequest.type}) in ${roomId}`);
    } catch (err) {
      console.error('[Socket] approve_request error:', err);
      const errPayload = { message: 'Failed to approve request', code: 'REQUEST_ERROR' };
      socket.emit('error', errPayload);
      if (typeof ack === 'function') ack({ success: false, ...errPayload });
    }
  });

  // Reject playback request
  socket.on('reject_request', async (data, ack = () => {}) => {
    try {
      const roomId = socket.data.roomId;
      const reviewerUserId = socket.data.userId;

      if (!roomId || !reviewerUserId) {
        const errPayload = {
          message: 'Unauthorized: You must join a room to reject requests',
          code: 'UNAUTHORIZED',
        };
        socket.emit('error', errPayload);
        if (typeof ack === 'function') ack({ success: false, ...errPayload });
        return;
      }

      const { requestId } = data || {};
      if (!requestId) {
        const errPayload = { message: 'Missing requestId', code: 'INVALID_PARAMS' };
        socket.emit('error', errPayload);
        if (typeof ack === 'function') ack({ success: false, ...errPayload });
        return;
      }

      const reviewer = await Participant.findOne({ roomId, userId: reviewerUserId });
      if (!reviewer || !canReviewRequests(reviewer.role)) {
        const errPayload = {
          message: 'Permission denied: Only Host and Moderator can reject requests',
          code: 'UNAUTHORIZED',
        };
        socket.emit('error', errPayload);
        if (typeof ack === 'function') ack({ success: false, ...errPayload });
        return;
      }

      const updatedRequests = await roomService.removeRoomRequest({ roomId, requestId });

      io.to(roomId).emit('request_rejected', {
        requestId,
        pendingRequests: updatedRequests,
        rejectedBy: {
          userId: reviewer.userId,
          username: reviewer.username,
          role: reviewer.role,
        },
      });

      if (typeof ack === 'function') {
        ack({
          success: true,
          data: {
            requestId,
            pendingRequests: updatedRequests,
          },
        });
      }

      console.log(`[Request] ${reviewer.username} rejected request ${requestId} in ${roomId}`);
    } catch (err) {
      console.error('[Socket] reject_request error:', err);
      const errPayload = { message: 'Failed to reject request', code: 'REQUEST_ERROR' };
      socket.emit('error', errPayload);
      if (typeof ack === 'function') ack({ success: false, ...errPayload });
    }
  });
};
