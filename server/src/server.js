import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import app, { isAllowedOrigin } from './app.js';
import { connectDB } from './config/db.js';
import { initSocket } from './socket/index.js';
import { getJwtSecret } from './utils/jwt.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Validate JWT Secret security configuration on startup
  getJwtSecret();

  // Connect to MongoDB
  await connectDB();

  const server = http.createServer(app);

  // Setup Socket.IO with permissive localhost CORS
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Origin not allowed by CORS'), false);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Attach io to Express app for REST controller broadcasts
  app.set('io', io);

  // Attach socket handlers
  initSocket(io);

  server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 WatchParty Server running on port ${PORT}`);
    console.log(`📡 Real-time Socket.IO initialized`);
    console.log(`===============================================`);
  });
};

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
