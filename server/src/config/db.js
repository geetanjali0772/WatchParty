import mongoose from 'mongoose';

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_uri;
  if (!uri) {
    console.error('[MongoDB] Error: MONGODB_URI is not set in server/.env');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`[MongoDB] Connected to database: ${conn.connection.name} @ ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    process.exit(1);
  }
};


