import express from 'express';
import { createSession, getCurrentUser, logout } from '../controllers/authController.js';
import { authenticateUser, requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/session', authenticateUser, createSession);
router.get('/me', authenticateUser, requireAuth, getCurrentUser);
router.post('/logout', logout);

export default router;

