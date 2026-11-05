import * as roomService from '../services/roomService.js';
import { Participant } from '../models/Participant.js';

export const createRoom = async (req, res, next) => {
  try {
    // Security: Derive creator identity strictly from verified JWT authentication
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required: You must be logged in to create a room',
        code: 'UNAUTHORIZED',
      });
    }

    const hostId = req.user.userId;
    const hostUsername = req.user.username || 'Host';
    const { roomName } = req.body || {};

    if (!roomName || !roomName.trim()) {
      return res.status(400).json({ success: false, message: 'Room name is required' });
    }

    const { room, hostParticipant, hostToken } = await roomService.createRoom({
      roomName,
      hostId,
      hostUsername,
    });

    res.status(201).json({
      success: true,
      data: {
        room: {
          roomId: room.roomId,
          roomName: room.roomName,
          hostId: room.hostId,
          currentVideoId: room.currentVideoId,
          playbackState: room.playbackState,
          currentTime: room.currentTime,
          createdAt: room.createdAt,
        },
        participant: hostParticipant,
        hostToken, // Returned ONLY to the original room creator
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getRoom = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const room = await roomService.getRoomByCode(roomId);

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        roomId: room.roomId,
        roomName: room.roomName,
        hostId: room.hostId,
        currentVideoId: room.currentVideoId,
        playbackState: room.playbackState,
        currentTime: room.getCalculatedCurrentTime(),
        lastUpdated: room.lastUpdated,
        pendingRequests: room.pendingRequests,
        createdAt: room.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const joinRoom = async (req, res, next) => {
  try {
    // Security: Derive joining identity strictly from verified JWT authentication
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required: You must be authenticated to join a room',
        code: 'UNAUTHORIZED',
      });
    }

    const { roomId } = req.params;
    const userId = req.user.userId;
    const username = req.user.username || 'Anonymous';
    const { hostToken } = req.body || {};

    const { room, participant } = await roomService.joinRoom({
      roomId,
      userId,
      username,
      hostToken,
    });

    res.status(200).json({
      success: true,
      data: {
        room: {
          roomId: room.roomId,
          roomName: room.roomName,
          hostId: room.hostId,
          currentVideoId: room.currentVideoId,
          playbackState: room.playbackState,
          currentTime: room.getCalculatedCurrentTime(),
          createdAt: room.createdAt,
        },
        participant,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getParticipants = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const room = await roomService.getRoomByCode(roomId);

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const participants = await roomService.getRoomParticipants(roomId);

    res.status(200).json({
      success: true,
      data: participants,
    });
  } catch (error) {
    next(error);
  }
};

export const getRoomMessages = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const cleanRoomId = (roomId || '').toUpperCase().trim();
    const room = await roomService.getRoomByCode(cleanRoomId);

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    // Security: Require authentication to view chat messages
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to view room chat history',
        code: 'UNAUTHORIZED',
      });
    }

    // Security: Verify that requesting user is an active participant in this room
    const isMember = await Participant.findOne({ roomId: cleanRoomId, userId: req.user.userId });
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You must be a member of this room to view chat messages',
        code: 'FORBIDDEN',
      });
    }

    if (room.bannedUserIds && room.bannedUserIds.includes(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You have been removed from this room',
        code: 'FORBIDDEN',
      });
    }

    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    const messages = await roomService.getRoomMessages(cleanRoomId, limit);

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

export const updateRoomTitle = async (req, res, next) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required: You must be logged in to update room details',
        code: 'UNAUTHORIZED',
      });
    }

    const { roomId } = req.params;
    const { roomName } = req.body || {};

    const room = await roomService.updateRoomTitle({
      roomId,
      userId: req.user.userId,
      roomName,
    });

    // Broadcast room_updated event to all connected sockets in this room
    const io = req.app.get('io');
    if (io) {
      io.to(room.roomId).emit('room_updated', {
        roomId: room.roomId,
        roomName: room.roomName,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        roomId: room.roomId,
        roomName: room.roomName,
      },
    });
  } catch (error) {
    next(error);
  }
};
