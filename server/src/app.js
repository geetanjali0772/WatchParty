import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import roomRoutes from './routes/roomRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { authenticateUser, csrfProtection } from './middleware/authMiddleware.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

export const isAllowedOrigin = (origin) => {
  // Allow non-browser requests (e.g., mobile apps, curl, server-to-server)
  if (!origin) return true;

  // Allow any localhost / 127.0.0.1 port in development (e.g., 5173, 5174, 5175, etc.)
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }

  // Check configured CLIENT_URL (supports comma-separated list or '*')
  if (process.env.CLIENT_URL) {
    const configured = process.env.CLIENT_URL.split(',').map((url) => url.trim());
    if (configured.includes('*') || configured.includes(origin)) {
      return true;
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

// Health Check
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
