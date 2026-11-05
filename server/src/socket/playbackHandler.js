import { Room } from '../models/Room.js';
import { Participant } from '../models/Participant.js';
import { canControlPlayback } from '../services/permissionService.js';
import { extractYoutubeId } from '../utils/extractYoutubeId.js';

export const registerPlaybackHandlers = (io, socket) => {
  // Helper to verify caller has authenticated membership and playback permissions
  const verifyPlaybackPermission = async () => {
    const roomId = socket.data.roomId;
    const userId = socket.data.userId;

    if (!roomId || !userId) {
      return {
        authorized: false,
        message: 'Unauthorized: You must join a room before controlling playback',
        code: 'UNAUTHORIZED',
      };
    }

    // Check room existence and ban status
    const room = await Room.findOne({ roomId });
    if (!room) {
      return { authorized: false, message: 'Room not found', code: 'ROOM_NOT_FOUND' };
    }
    if (room.bannedUserIds && room.bannedUserIds.includes(userId)) {
      return {
        authorized: false,
        message: 'Unauthorized: You have been removed from this room',
        code: 'USER_REMOVED',
      };
    }

    const participant = await Participant.findOne({ roomId, userId });
    if (!participant) {
      return {
        authorized: false,
        message: 'Unauthorized: Participant record not found for this room',
        code: 'UNAUTHORIZED',
      };
    }

    if (!canControlPlayback(participant.role)) {
      return {
        authorized: false,
        message: 'Permission denied: Only Host and Moderator can control playback directly',
        code: 'UNAUTHORIZED',
      };
    }

    return { authorized: true, participant, room, roomId, userId };
  };

  // Play
  socket.on('play', async (data) => {
    try {
      const perm = await verifyPlaybackPermission();
      if (!perm.authorized) {
        return socket.emit('error', { message: perm.message, code: perm.code });
      }

      const { currentTime = 0 } = data || {};
      const validTime = Math.max(0, parseFloat(currentTime) || 0);

      const room = await Room.findOneAndUpdate(
        { roomId: perm.roomId },
        {
          $set: {
            playbackState: 'playing',
            currentTime: validTime,
            lastUpdated: new Date(),
          },
        },
        { new: true }
      );

      io.to(perm.roomId).emit('playback_updated', {
        playbackState: 'playing',
        currentTime: validTime,
        lastUpdated: room.lastUpdated,
        updatedBy: {
          userId: perm.userId,
          username: perm.participant.username,
          role: perm.participant.role,
        },
      });

      console.log(`[Playback] ${perm.participant.username} played video in ${perm.roomId} at ${validTime}s`);
    } catch (err) {
      console.error('[Socket] Play error:', err);
      socket.emit('error', { message: 'Failed to synchronize play', code: 'PLAYBACK_ERROR' });
    }
  });

  // Pause
  socket.on('pause', async (data) => {
    try {
      const perm = await verifyPlaybackPermission();
      if (!perm.authorized) {
        return socket.emit('error', { message: perm.message, code: perm.code });
      }

      const { currentTime = 0 } = data || {};
      const validTime = Math.max(0, parseFloat(currentTime) || 0);

      const room = await Room.findOneAndUpdate(
        { roomId: perm.roomId },
        {
          $set: {
            playbackState: 'paused',
            currentTime: validTime,
            lastUpdated: new Date(),
          },
        },
        { new: true }
      );

      io.to(perm.roomId).emit('playback_updated', {
        playbackState: 'paused',
        currentTime: validTime,
        lastUpdated: room.lastUpdated,
        updatedBy: {
          userId: perm.userId,
          username: perm.participant.username,
          role: perm.participant.role,
        },
      });

      console.log(`[Playback] ${perm.participant.username} paused video in ${perm.roomId} at ${validTime}s`);
    } catch (err) {
      console.error('[Socket] Pause error:', err);
      socket.emit('error', { message: 'Failed to synchronize pause', code: 'PLAYBACK_ERROR' });
    }
  });

  // Seek
  socket.on('seek', async (data) => {
    try {
      const perm = await verifyPlaybackPermission();
      if (!perm.authorized) {
        return socket.emit('error', { message: perm.message, code: perm.code });
      }

      const rawTime = parseFloat(data?.currentTime);
      if (isNaN(rawTime) || !Number.isFinite(rawTime)) {
        return socket.emit('error', {
          message: 'Invalid seek timestamp: Time must be a finite number.',
          code: 'INVALID_TIMESTAMP',
        });
      }

      // Safely clamp negative timestamps to 0
      const validTime = Math.max(0, rawTime);

      const updatedRoom = await Room.findOneAndUpdate(
        { roomId: perm.roomId },
        {
          $set: {
            currentTime: validTime,
            lastUpdated: new Date(),
          },
        },
        { new: true }
      );

      io.to(perm.roomId).emit('playback_updated', {
        playbackState: updatedRoom.playbackState,
        currentTime: validTime,
        lastUpdated: updatedRoom.lastUpdated,
        updatedBy: {
          userId: perm.userId,
          username: perm.participant.username,
          role: perm.participant.role,
        },
      });

      console.log(`[Playback] ${perm.participant.username} seeked video in ${perm.roomId} to ${validTime}s`);
    } catch (err) {
      console.error('[Socket] Seek error:', err);
      socket.emit('error', { message: 'Failed to synchronize seek', code: 'PLAYBACK_ERROR' });
    }
  });

  // Change Video
  socket.on('change_video', async (data) => {
    try {
      const perm = await verifyPlaybackPermission();
      if (!perm.authorized) {
        return socket.emit('error', { message: perm.message, code: perm.code });
      }

      const { url, videoId: directVideoId } = data || {};
      const input = url || directVideoId;
      const videoId = extractYoutubeId(input);

      if (!videoId) {
        return socket.emit('error', {
          message: 'Invalid YouTube link or video ID. Please enter a valid YouTube URL.',
          code: 'INVALID_VIDEO_URL',
        });
      }

      const room = await Room.findOneAndUpdate(
        { roomId: perm.roomId },
        {
          $set: {
            currentVideoId: videoId,
            currentTime: 0,
            playbackState: 'playing',
            lastUpdated: new Date(),
          },
        },
        { new: true }
      );

      io.to(perm.roomId).emit('video_changed', {
        currentVideoId: videoId,
        currentTime: 0,
        playbackState: 'playing',
        lastUpdated: room.lastUpdated,
        updatedBy: {
          userId: perm.userId,
          username: perm.participant.username,
          role: perm.participant.role,
        },
      });

      console.log(`[Playback] ${perm.participant.username} changed video to ${videoId} in ${perm.roomId}`);
    } catch (err) {
      console.error('[Socket] Change video error:', err);
      socket.emit('error', { message: 'Failed to change video', code: 'PLAYBACK_ERROR' });
    }
  });

  // Client request to get sync timestamp to correct minor drift
  socket.on('request_sync', async () => {
    try {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;
      if (!roomId || !userId) return;

      const room = await Room.findOne({ roomId });
      if (!room) return;

      socket.emit('playback_updated', {
        playbackState: room.playbackState,
        currentTime: room.getCalculatedCurrentTime(),
        lastUpdated: room.lastUpdated,
      });
    } catch (err) {
      console.error('[Socket] request_sync error:', err);
    }
  });
};
