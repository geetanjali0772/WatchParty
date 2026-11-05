import { Participant } from '../models/Participant.js';
import { Room } from '../models/Room.js';
import * as roomService from '../services/roomService.js';
import { canManageRoles, canRemoveParticipant, ROLES } from '../services/permissionService.js';

export const registerRoleHandlers = (io, socket) => {
  // Assign Role (Promote / Demote)
  socket.on('assign_role', async (data, ack = () => {}) => {
    const fail = (message, code) => {
      const payload = { success: false, message, code };
      socket.emit('error', { message, code });
      if (typeof ack === 'function') ack(payload);
    };

    try {
      const roomId = socket.data.roomId;
      const requesterUserId = socket.data.userId;
      if (!roomId || !requesterUserId) {
        return fail('Unauthorized: You must be in a room to assign roles', 'UNAUTHORIZED');
      }

      const { targetUserId, newRole } = data || {};
      if (!targetUserId || !newRole) {
        return fail('Missing targetUserId or newRole', 'INVALID_PARAMS');
      }
      if (![ROLES.MODERATOR, ROLES.PARTICIPANT].includes(newRole)) {
        return fail('Invalid target role. Allowed: Moderator or Participant', 'INVALID_ROLE');
      }

      const requester = await Participant.findOne({ roomId, userId: requesterUserId });
      if (!requester || !canManageRoles(requester.role)) {
        return fail('Permission denied: Only the Host can assign or change roles', 'UNAUTHORIZED');
      }

      const targetParticipant = await Participant.findOne({ roomId, userId: targetUserId });
      if (!targetParticipant) {
        return fail('Target participant not found in this room', 'USER_NOT_FOUND');
      }
      if (targetParticipant.role === ROLES.HOST) {
        return fail('Cannot change the role of the Host', 'FORBIDDEN');
      }

      targetParticipant.role = newRole;
      await targetParticipant.save();
      const participants = await roomService.getRoomParticipants(roomId);

      // A single authoritative event updates every currently joined client.
      io.to(roomId).emit('role_assigned', {
        targetUserId,
        targetUsername: targetParticipant.username,
        newRole,
        participants,
      });

      if (typeof ack === 'function') ack({ success: true, data: { targetUserId, newRole, participants } });
      console.log(`[Role] ${requester.username} assigned role ${newRole} to ${targetParticipant.username} in ${roomId}`);
    } catch (err) {
      console.error('[Socket] assign_role error:', err);
      fail('Failed to assign role', 'ROLE_ERROR');
    }
  });

  // Remove Participant (Kick & Ban)
  socket.on('remove_participant', async (data) => {
    try {
      const roomId = socket.data.roomId;
      const requesterUserId = socket.data.userId;

      if (!roomId || !requesterUserId) {
        return socket.emit('error', {
          message: 'Unauthorized: You must be in a room to remove participants',
          code: 'UNAUTHORIZED',
        });
      }

      const { targetUserId } = data || {};
      if (!targetUserId) {
        return socket.emit('error', { message: 'Missing targetUserId', code: 'INVALID_PARAMS' });
      }

      const requester = await Participant.findOne({ roomId, userId: requesterUserId });
      if (!requester) {
        return socket.emit('error', { message: 'Requester not found', code: 'UNAUTHORIZED' });
      }

      const target = await Participant.findOne({ roomId, userId: targetUserId });
      if (!target) {
        return socket.emit('error', { message: 'Target participant not found', code: 'USER_NOT_FOUND' });
      }

      if (!canRemoveParticipant(requester.role, target.role)) {
        return socket.emit('error', {
          message: 'Permission denied: Only the Host can remove participants, and the Host cannot be removed',
          code: 'UNAUTHORIZED',
        });
      }

      // Ban participant at room level and delete participant document
      await roomService.banAndRemoveParticipant({ roomId, targetUserId });

      // Disconnect all sockets belonging to target user from room channel
      const sockets = await io.in(roomId).fetchSockets();
      for (const s of sockets) {
        if (s.data.userId === targetUserId) {
          s.emit('participant_removed', {
            targetUserId,
            reason: 'You have been removed from the room by the Host.',
            isTarget: true,
          });
          s.data.roomId = null;
          s.leave(roomId);
        }
      }

      const updatedParticipants = await roomService.getRoomParticipants(roomId);
      const remainingSockets = await io.in(roomId).fetchSockets();
      const onlineUserIds = new Set(remainingSockets.map((s) => s.data.userId).filter(Boolean));

      // Broadcast removal to remaining participants in the room
      io.to(roomId).emit('participant_removed', {
        targetUserId,
        targetUsername: target.username,
        participants: updatedParticipants,
        onlineCount: onlineUserIds.size,
      });

      console.log(`[Role] Host ${requester.username} removed and banned ${target.username} from ${roomId}`);
    } catch (err) {
      console.error('[Socket] remove_participant error:', err);
      socket.emit('error', { message: 'Failed to remove participant', code: 'REMOVE_ERROR' });
    }
  });

  // Transfer Host Ownership
  socket.on('transfer_host', async (data, ack = () => {}) => {
    const fail = (message, code = 'TRANSFER_ERROR') => {
      socket.emit('error', { message, code });
      if (typeof ack === 'function') ack({ success: false, message, code });
    };
    try {
      const roomId = socket.data.roomId;
      const requesterUserId = socket.data.userId;

      if (!roomId || !requesterUserId) {
        return fail('Unauthorized: You must be in a room to transfer host ownership', 'UNAUTHORIZED');
      }

      const { targetUserId } = data || {};
      if (!targetUserId) {
        return fail('Missing targetUserId', 'INVALID_PARAMS');
      }

      const result = await roomService.transferRoomHost({
        roomId,
        currentHostUserId: requesterUserId,
        targetUserId,
      });

      // Broadcast host transfer to all room participants
      io.to(roomId).emit('host_transferred', {
        previousHostId: result.previousHostId,
        newHostId: result.newHostId,
        newHostUsername: result.newHostUsername,
        participants: result.participants,
      });

      // Securely deliver new hostToken to all sockets belonging to new Host
      const sockets = await io.in(roomId).fetchSockets();
      for (const s of sockets) {
        if (s.data.userId === result.newHostId) {
          s.emit('host_promoted', { roomId, hostToken: result.newHostToken });
        }
      }

      if (typeof ack === 'function') {
        ack({ success: true, data: { previousHostId: result.previousHostId, newHostId: result.newHostId, newHostUsername: result.newHostUsername, participants: result.participants } });
      }
      console.log(`[Role] Host transferred from ${requesterUserId} to ${result.newHostUsername} (${result.newHostId}) in ${roomId}`);
    } catch (err) {
      console.error('[Socket] transfer_host error:', err);
      fail(err.message || 'Failed to transfer host', err.code || 'TRANSFER_ERROR');
    }
  });
};
