import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import roomRoutes from './routes/roomRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { authenticateUser, csrfProtection } from './middleware/authMiddleware.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Trust reverse proxy headers (required for Render/Heroku/Vercel to correctly identify HTTPS & client IP)
app.set('trust proxy', 1);

export const isAllowedOrigin = (origin) => {
  // Allow non-browser requests (e.g., mobile apps, curl, server-to-server)
  if (!origin) return true;

  const normalizedOrigin = origin.replace(/\/+$/, '');

  // Allow any localhost / 127.0.0.1 port in development (e.g., 5173, 5174, 5175, etc.)
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)) {
    return true;
  }

  // Check configured CLIENT_URL (supports comma-separated list, trailing slash normalization, and wildcard patterns)
  if (process.env.CLIENT_URL) {
    const configured = process.env.CLIENT_URL.split(',').map((url) => url.trim().replace(/\/+$/, ''));
    if (configured.includes('*') || configured.includes(normalizedOrigin)) {
      return true;
    }
    // Also support wildcard matching e.g. https://*.vercel.app
    for (const pattern of configured) {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        if (regex.test(normalizedOrigin)) {
          return true;
        }
      }
    }
  }

  return false;
};

// Explicit CORS headers and preflight handler to guarantee zero stale origin cache
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,X-CSRF-Token');
    res.setHeader('Access-Control-Max-Age', '0');
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  }

  if (req.method === 'OPTIONS') {
    return res.status(403).send('Origin not allowed by CORS');
  }

  next();
});

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, origin || true);
    }
    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  maxAge: 0,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
};

// Enable CORS for all routes and preflight requests
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(authenticateUser);
app.use(csrfProtection);

// Health Check and Root Service Check (useful for hosting platform ping/monitoring like Render)
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'WatchParty Backend Service', time: new Date() });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'WatchParty Backend', time: new Date() });
});

// Authentication Routes
app.use('/api/auth', authRoutes);

// Room Routes
app.use('/api/rooms', roomRoutes);

// Error Handler Middleware
app.use(errorHandler);

export default app;
