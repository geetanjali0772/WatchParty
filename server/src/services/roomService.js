import crypto from 'crypto';
import { Room } from '../models/Room.js';
import { Participant } from '../models/Participant.js';
import { Message } from '../models/Message.js';
import { generateRoomCode } from '../utils/generateRoomCode.js';
import { ROLES } from './permissionService.js';

export const createRoom = async ({ roomName, hostId, hostUsername }) => {
  if (!roomName || !roomName.trim()) {
    throw new Error('Room name is required');
  }
  if (!hostId || !hostUsername) {
    throw new Error('Host user information is required');
  }

  // Generate a unique room code
  let roomId = generateRoomCode();
  let existingRoom = await Room.findOne({ roomId });
  let attempts = 0;
  while (existingRoom && attempts < 10) {
    roomId = generateRoomCode();
    existingRoom = await Room.findOne({ roomId });
    attempts++;
  }

  // Generate secure host token and hash
  const hostToken = crypto.randomBytes(32).toString('hex');
  const hostTokenHash = crypto.createHash('sha256').update(hostToken).digest('hex');

  const room = await Room.create({
    roomId,
    roomName: roomName.trim(),
    hostId,
    hostTokenHash,
    bannedUserIds: [],
    currentVideoId: null,
    playbackState: 'paused',
    currentTime: 0,
    lastUpdated: new Date(),
  });

  // Create host participant record
  const hostParticipant = await Participant.create({
    userId: hostId,
    username: hostUsername.trim(),
    roomId,
    role: ROLES.HOST,
    isOnline: true,
  });

  return { room, hostParticipant, hostToken };
};

export const getRoomByCode = async (roomId) => {
  if (!roomId) return null;
  return await Room.findOne({ roomId: roomId.toUpperCase().trim() });
};

export const joinRoom = async ({ roomId, userId, username, hostToken }) => {
  const cleanRoomId = roomId.toUpperCase().trim();
  const room = await Room.findOne({ roomId: cleanRoomId }).select('+hostTokenHash');
  if (!room) {
    const error = new Error('Room not found');
    error.statusCode = 404;
    throw error;
  }

  if (!userId || !username) {
    const error = new Error('User ID and username are required');
    error.statusCode = 400;
    throw error;
  }

  // Check if user has been banned/removed from this room
  if (room.bannedUserIds && room.bannedUserIds.includes(userId)) {
    const error = new Error('You have been removed from this room and cannot rejoin.');
    error.statusCode = 403;
    error.code = 'USER_REMOVED';
    throw error;
  }

  const cleanUsername = username.trim();

  // Check if participant already exists in room
  let participant = await Participant.findOne({ roomId: cleanRoomId, userId });

  // If user claims to be the Host or already has Host role, validate host token
  const isClaimingHost = userId === room.hostId || (participant && participant.role === ROLES.HOST);
  if (isClaimingHost) {
    const isAuthorized = room.verifyHostToken(hostToken);
    if (!isAuthorized) {
      const error = new Error('Host authorization failed: A valid host token is required to join as Host.');
      error.statusCode = 403;
      error.code = 'INVALID_HOST_TOKEN';
      throw error;
    }
  }

  if (participant) {
    // If existing participant is updating their username, check for conflicts with other users in this room
    if (cleanUsername.toLowerCase() !== participant.username.toLowerCase()) {
      const existingNameUser = await Participant.findOne({
        roomId: cleanRoomId,
        username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') },
        userId: { $ne: userId },
      });

      if (existingNameUser) {
        const error = new Error('Username already taken in this room. Please choose another.');
        error.statusCode = 409;
        throw error;
      }
      participant.username = cleanUsername;
    }

    participant.isOnline = true;
    await participant.save();
  } else {
    // Check if another user in this room already has this username
    const existingNameUser = await Participant.findOne({
      roomId: cleanRoomId,
      username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') },
      userId: { $ne: userId },
    });

    if (existingNameUser) {
      const error = new Error('Username already taken in this room. Please choose another.');
      error.statusCode = 409;
      throw error;
    }

    // Role is Host only if userId === room.hostId AND valid hostToken was verified
    const role = (userId === room.hostId && room.verifyHostToken(hostToken)) ? ROLES.HOST : ROLES.PARTICIPANT;

    participant = await Participant.create({
      userId,
      username: cleanUsername,
      roomId: cleanRoomId,
      role,
      isOnline: true,
    });
  }

  return { room, participant };
};

export const banAndRemoveParticipant = async ({ roomId, targetUserId }) => {
  const cleanRoomId = roomId.toUpperCase().trim();

  // Add to bannedUserIds in Room and remove from Participant records
  await Room.updateOne(
    { roomId: cleanRoomId },
    { $addToSet: { bannedUserIds: targetUserId } }
  );

  await Participant.deleteOne({ roomId: cleanRoomId, userId: targetUserId });

  return await getRoomParticipants(cleanRoomId);
};

export const getRoomParticipants = async (roomId) => {
  const cleanRoomId = roomId.toUpperCase().trim();
  // This is the active participant roster, not the room's historical membership.
  // Keep offline Participant documents in MongoDB to preserve their role when
  // they rejoin, but never include them in the live Participants panel/count.
  const participants = await Participant.find({ roomId: cleanRoomId, isOnline: true });

  // Custom sort: Host first, then Moderator, then Participant, then alphabetical
  const rolePriority = { [ROLES.HOST]: 1, [ROLES.MODERATOR]: 2, [ROLES.PARTICIPANT]: 3 };
  return participants.sort((a, b) => {
    const diff = (rolePriority[a.role] || 4) - (rolePriority[b.role] || 4);
    if (diff !== 0) return diff;
    return a.username.localeCompare(b.username);
  });
};

export const updatePlaybackState = async ({ roomId, playbackState, currentTime }) => {
  const cleanRoomId = roomId.toUpperCase().trim();
  const updateData = {
    lastUpdated: new Date(),
  };

  if (playbackState) {
    updateData.playbackState = playbackState;
  }
  if (typeof currentTime === 'number' && !isNaN(currentTime)) {
    updateData.currentTime = Math.max(0, currentTime);
  }

  return await Room.findOneAndUpdate(
    { roomId: cleanRoomId },
    { $set: updateData },
    { new: true }
  );
};

export const updateRoomVideo = async ({ roomId, videoId }) => {
  const cleanRoomId = roomId.toUpperCase().trim();
  return await Room.findOneAndUpdate(
    { roomId: cleanRoomId },
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
};

export const addRoomRequest = async ({ roomId, userId, username, type, payload }) => {
  const cleanRoomId = roomId.toUpperCase().trim();
  const requestId = crypto.randomUUID();
  const newRequest = {
    requestId,
    userId,
    username,
    type,
    payload,
    createdAt: new Date(),
  };

  const updatedRoom = await Room.findOneAndUpdate(
    { roomId: cleanRoomId },
    { $push: { pendingRequests: newRequest } },
    { new: true }
  );

  return { request: newRequest, pendingRequests: updatedRoom ? updatedRoom.pendingRequests : [] };
};

export const removeRoomRequest = async ({ roomId, requestId }) => {
  const cleanRoomId = roomId.toUpperCase().trim();
  const updatedRoom = await Room.findOneAndUpdate(
    { roomId: cleanRoomId },
    { $pull: { pendingRequests: { requestId } } },
    { new: true }
  );
  return updatedRoom ? updatedRoom.pendingRequests : [];
};

export const transferRoomHost = async ({ roomId, currentHostUserId, targetUserId }) => {
  const cleanRoomId = roomId.toUpperCase().trim();

  const room = await Room.findOne({ roomId: cleanRoomId }).select('+hostTokenHash');
  if (!room) {
    const error = new Error('Room not found');
    error.statusCode = 404;
    throw error;
  }

  // Security: Ensure only the authenticated current Host can transfer ownership
  if (room.hostId !== currentHostUserId) {
    const error = new Error('Permission denied: Only the current Host can transfer room ownership');
    error.statusCode = 403;
    throw error;
  }

  if (targetUserId === currentHostUserId) {
    const error = new Error('Cannot transfer host to yourself');
    error.statusCode = 400;
    throw error;
  }

  const targetParticipant = await Participant.findOne({ roomId: cleanRoomId, userId: targetUserId });
  if (!targetParticipant) {
    const error = new Error('Target participant not found in this room');
    error.statusCode = 404;
    throw error;
  }

  // Verification: Target participant must be actively online
  if (!targetParticipant.isOnline) {
    const error = new Error('Cannot transfer host ownership to an offline participant');
    error.statusCode = 400;
    throw error;
  }

  const previousHostParticipant = await Participant.findOne({ roomId: cleanRoomId, userId: currentHostUserId });
  if (!previousHostParticipant) {
    const error = new Error('Current host participant record not found');
    error.statusCode = 404;
    throw error;
  }

  // Generate a fresh secure host token for the new host
  const newHostToken = crypto.randomBytes(32).toString('hex');
  const newHostTokenHash = crypto.createHash('sha256').update(newHostToken).digest('hex');

  // Capture original state for rollback compensation
  const originalRoomHostId = room.hostId;
  const originalHostTokenHash = room.hostTokenHash;
  const originalPrevHostRole = previousHostParticipant.role;
  const originalTargetRole = targetParticipant.role;

  /**
   * MONGODB TRANSACTIONS FOR HOST TRANSFERS:
   * Production MongoDB deployments MUST support multi-document ACID transactions
   * (MongoDB Replica Set or Sharded cluster). Non-transactional fallback compensation is NOT
   * an equivalent substitute for true atomic transactions. In production environments, attempting
   * a host transfer without replica set transaction support will fail safely with an explicit error.
   */
  const client = Room.db.client;
  const topologyType = client?.topology?.description?.type;
  const supportsTransactions =
    topologyType === 'ReplicaSetWithPrimary' ||
    topologyType === 'Sharded' ||
    Boolean(client?.topology?.description?.setName);

  if (supportsTransactions) {
    const session = await Room.db.startSession();
    try {
      session.startTransaction();

      // 1. Update Room host & token hash
      await Room.updateOne(
        { roomId: cleanRoomId },
        { $set: { hostId: targetUserId, hostTokenHash: newHostTokenHash } },
        { session }
      );

      // 2. Demote previous host
      await Participant.updateOne(
        { roomId: cleanRoomId, userId: currentHostUserId },
        { $set: { role: ROLES.PARTICIPANT } },
        { session }
      );

      // 3. Promote target participant to Host
      await Participant.updateOne(
        { roomId: cleanRoomId, userId: targetUserId },
        { $set: { role: ROLES.HOST } },
        { session }
      );

      // 4. Invariant check: Exactly one Host per room
      const hostCount = await Participant.countDocuments(
        { roomId: cleanRoomId, role: ROLES.HOST },
        { session }
      );
      if (hostCount !== 1) {
        throw new Error('Host transfer invariant check failed: exactly one Host must exist in the room');
      }

      await session.commitTransaction();
    } catch (txError) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        console.error('Failed to abort transaction:', abortErr);
      }
      throw txError;
    } finally {
      await session.endSession();
    }
  } else {
    // In production environments, non-transactional execution is strictly disallowed
    if (process.env.NODE_ENV === 'production') {
      const error = new Error(
        'Transaction Error: Production MongoDB must be configured as a replica set with transaction support for atomic host ownership transfers.'
      );
      error.statusCode = 500;
      throw error;
    }

    console.warn(
      '[DATABASE CONSISTENCY WARNING] Standalone MongoDB detected: executing host transfer using manual compensation. Production environments must run a MongoDB Replica Set supporting native ACID transactions.'
    );

    // Non-transactional fallback with manual rollback compensation
    try {
      room.hostId = targetUserId;
      room.hostTokenHash = newHostTokenHash;
      await room.save();

      await Participant.updateOne(
        { roomId: cleanRoomId, userId: currentHostUserId },
        { $set: { role: ROLES.PARTICIPANT } }
      );

      await Participant.updateOne(
        { roomId: cleanRoomId, userId: targetUserId },
        { $set: { role: ROLES.HOST } }
      );

      // Invariant check: Exactly one Host per room
      const hostCount = await Participant.countDocuments({ roomId: cleanRoomId, role: ROLES.HOST });
      if (hostCount !== 1) {
        throw new Error('Host transfer invariant check failed: exactly one Host must exist in the room');
      }
    } catch (opError) {
      // Roll back changes to restore original state
      try {
        await Room.updateOne(
          { roomId: cleanRoomId },
          { $set: { hostId: originalRoomHostId, hostTokenHash: originalHostTokenHash } }
        );
        await Participant.updateOne(
          { roomId: cleanRoomId, userId: currentHostUserId },
          { $set: { role: originalPrevHostRole } }
        );
        await Participant.updateOne(
          { roomId: cleanRoomId, userId: targetUserId },
          { $set: { role: originalTargetRole } }
        );
      } catch (rollbackErr) {
        console.error('Failed to roll back host transfer compensation:', rollbackErr);
      }
      throw opError;
    }
  }

  // Update in-memory room object to reflect new state
  room.hostId = targetUserId;
  room.hostTokenHash = newHostTokenHash;

  const updatedParticipants = await getRoomParticipants(cleanRoomId);

  return {
    room,
    previousHostId: currentHostUserId,
    newHostId: targetUserId,
    newHostUsername: targetParticipant.username,
    newHostToken,
    participants: updatedParticipants,
  };
};

export const getRoomMessages = async (roomId, limit = 50) => {
  const cleanRoomId = roomId.toUpperCase().trim();
  return await Message.find({ roomId: cleanRoomId })
    .sort({ createdAt: 1 })
    .limit(limit);
};

export const updateRoomTitle = async ({ roomId, userId, roomName }) => {
  const cleanRoomId = (roomId || '').toUpperCase().trim();
  const room = await getRoomByCode(cleanRoomId);

  if (!room) {
    const error = new Error('Room not found');
    error.statusCode = 404;
    throw error;
  }

  // Authoritative authorization: only the current Host can rename the room
  if (room.hostId !== userId) {
    const error = new Error('Permission denied: Only the room Host can update the room title');
    error.statusCode = 403;
    throw error;
  }

  const cleanTitle = (roomName || '').trim();
  if (!cleanTitle || cleanTitle.length < 1 || cleanTitle.length > 100) {
    const error = new Error('Room title must be between 1 and 100 characters');
    error.statusCode = 400;
    throw error;
  }

  room.roomName = cleanTitle;
  await room.save();

  return room;
};
