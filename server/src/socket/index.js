import { registerRoomHandlers } from './roomHandler.js';
import { registerPlaybackHandlers } from './playbackHandler.js';
import { registerRoleHandlers } from './roleHandler.js';
import { registerRequestHandlers } from './requestHandler.js';
import { registerChatHandlers } from './chatHandler.js';
import { registerReactionHandlers } from './reactionHandler.js';
import { socketAuthMiddleware } from '../middleware/authMiddleware.js';
import { Room } from '../models/Room.js';

export const initSocket = (io) => {
  // Handshake authentication middleware
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    socket.data = {
      roomId: null,
      userId: socket.user?.userId || null,
      username: socket.user?.username || null,
    };

    // Register modular event handlers
    registerRoomHandlers(io, socket);
    registerPlaybackHandlers(io, socket);
    registerRoleHandlers(io, socket);
    registerRequestHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerReactionHandlers(io, socket);
  });

  // Periodic drift check & sync broadcast for active rooms (every 8 seconds)
  const driftInterval = setInterval(async () => {
    try {
      // Find rooms where playback is playing
      const activeRooms = await Room.find({ playbackState: 'playing' });
      for (const room of activeRooms) {
        // Only broadcast if room has connected sockets
        const socketsInRoom = await io.in(room.roomId).fetchSockets();
        if (socketsInRoom.length > 0) {
          const calculatedTime = room.getCalculatedCurrentTime();
          io.to(room.roomId).emit('periodic_sync', {
            roomId: room.roomId,
            currentTime: calculatedTime,
            playbackState: room.playbackState,
            currentVideoId: room.currentVideoId,
            serverTimestamp: Date.now(),
          });
        }
      }
    } catch (err) {
      // Silently catch periodic drift check errors
    }
  }, 8000);

  // Unref interval so it does not block node process shutdown or tests
  if (driftInterval.unref) {
    driftInterval.unref();
  }

  // Return cleanup hook if needed
  return () => clearInterval(driftInterval);
};
