import express from 'express';
import {
  createRoom,
  getRoom,
  joinRoom,
  getParticipants,
  getRoomMessages,
  updateRoomTitle,
} from '../controllers/roomController.js';
import { authenticateUser, requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public room discovery
router.get('/:roomId', getRoom);
router.get('/:roomId/participants', getParticipants);

// Protected room operations (derive identity from verified JWT)
router.post('/', authenticateUser, requireAuth, createRoom);
router.patch('/:roomId', authenticateUser, requireAuth, updateRoomTitle);
router.post('/:roomId/join', authenticateUser, requireAuth, joinRoom);
router.get('/:roomId/messages', authenticateUser, requireAuth, getRoomMessages);

export default router;
