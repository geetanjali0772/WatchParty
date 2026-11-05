import { verifyToken } from '../utils/jwt.js';

/**
 * Express middleware to extract and verify user identity from cookie or Authorization header
 */
export const authenticateUser = (req, res, next) => {
  let token = null;

  // 1. Check HttpOnly cookie
  if (req.cookies && req.cookies.wp_token) {
    token = req.cookies.wp_token;
  }
  // 2. Check Authorization header (Bearer <token>)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    const decoded = verifyToken(token);
    if (decoded && decoded.userId) {
      req.user = decoded;
    }
  }

  next();
};

/**
 * Express middleware to strictly require an authenticated user
 */
export const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please provide a valid session token.',
      code: 'UNAUTHORIZED',
    });
  }
  next();
};

/**
 * Express middleware for Anti-CSRF defense on cookie-authenticated state-changing requests.
 * Requests using ambient browser credentials (cookies) must provide a custom header
 * ('X-Requested-With' or 'X-CSRF-Token') which cannot be forged across origins by simple requests.
 */
export const csrfProtection = (req, res, next) => {
  // Safe idempotent HTTP methods do not modify server state
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Enforce CSRF protection when the request relies on ambient cookie authentication
  const hasCookieAuth = Boolean(req.cookies && req.cookies.wp_token);
  if (hasCookieAuth) {
    const xRequestedWith = req.headers['x-requested-with'];
    const csrfToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];

    if (!xRequestedWith && !csrfToken) {
      return res.status(403).json({
        success: false,
        message: 'CSRF validation failed: Missing required security header (X-Requested-With or X-CSRF-Token).',
        code: 'CSRF_REJECTED',
      });
    }
  }

  next();
};

/**
 * Socket.IO handshake middleware for authenticating socket connections.
 * Strictly rejects unauthenticated sockets or invalid/expired tokens.
 */
export const socketAuthMiddleware = (socket, next) => {
  try {
    let token = null;

    // 1. Check HttpOnly cookie header first
    if (socket.handshake.headers?.cookie) {
      const cookies = socket.handshake.headers.cookie.split(';');
      for (const cookie of cookies) {
        const [name, ...valParts] = cookie.trim().split('=');
        if (name === 'wp_token') {
          token = decodeURIComponent(valParts.join('='));
          break;
        }
      }
    }

    // 2. Check auth.token (passed explicitly in tests or mobile clients)
    if (!token && socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    }

    // 3. Check authorization header (Bearer <token>)
    if (!token && socket.handshake.headers?.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return next(new Error('Authentication error: No authentication token provided'));
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }

    // Attach verified identity exclusively from JWT claims
    socket.user = {
      userId: decoded.userId,
      username: decoded.username || 'Anonymous',
    };

    next();
  } catch (err) {
    next(new Error('Authentication error: Handshake verification failed'));
  }
};
