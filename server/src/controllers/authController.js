import crypto from 'crypto';
import { generateToken } from '../utils/jwt.js';

export const createSession = async (req, res, next) => {
  try {
    const { username } = req.body || {};

    const cleanUsername = (username || '').trim();
    if (!cleanUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username is required to establish a session',
      });
    }

    if (cleanUsername.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Username must not exceed 30 characters',
      });
    }

    // Security: NEVER accept a client-supplied userId.
    // The server is authoritative for generating and signing user identities.
    // If the caller already has a valid verified session (via HttpOnly cookie or auth header),
    // preserve their stable userId so returning participants maintain their identity.
    const serverGeneratedUserId = (req.user && req.user.userId)
      ? req.user.userId
      : `user_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;

    const token = generateToken({
      userId: serverGeneratedUserId,
      username: cleanUsername,
    });

    // Set secure HttpOnly cookie
    // In production (cross-domain like vercel.app to onrender.com), sameSite must be 'none' and secure must be true
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieSameSite = process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax');
    const cookieSecure = isProduction || process.env.COOKIE_SECURE === 'true' || cookieSameSite === 'none';

    res.cookie('wp_token', token, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      data: {
        user: {
          userId: serverGeneratedUserId,
          username: cleanUsername,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (req, res, next) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'No active authenticated session',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          userId: req.user.userId,
          username: req.user.username,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieSameSite = process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax');
    const cookieSecure = isProduction || process.env.COOKIE_SECURE === 'true' || cookieSameSite === 'none';

    res.clearCookie('wp_token', {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      path: '/',
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};
