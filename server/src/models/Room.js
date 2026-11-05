import mongoose from 'mongoose';
import crypto from 'crypto';

const PendingRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['play', 'pause', 'seek', 'change_video'],
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const VideoQueueItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true },
    videoId: { type: String, required: true },
    addedByUserId: { type: String, required: true },
    addedByUsername: { type: String, required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const PendingVideoRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true },
    videoId: { type: String, required: true },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RoomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    roomName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    hostId: {
      type: String,
      required: true,
      index: true,
    },
    hostTokenHash: {
      type: String,
      required: true,
      select: false, // Hidden by default in queries
    },
    bannedUserIds: {
      type: [String],
      default: [],
    },
    currentVideoId: {
      type: String,
      default: null,
      trim: true,
    },
    playbackState: {
      type: String,
      enum: ['playing', 'paused'],
      default: 'paused',
    },
    currentTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    pendingRequests: {
      type: [PendingRequestSchema],
      default: [],
    },
    // Persistent watch queue. Items are removed only when played or removed by
    // a Host/Moderator, so the order survives refreshes and reconnects.
    videoQueue: {
      type: [VideoQueueItemSchema],
      default: [],
    },
    pendingVideoRequests: {
      type: [PendingVideoRequestSchema],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Method to calculate the exact current playback time taking elapsed wall-clock time into account
RoomSchema.methods.getCalculatedCurrentTime = function () {
  if (this.playbackState === 'playing') {
    const elapsedSeconds = (Date.now() - new Date(this.lastUpdated).getTime()) / 1000;
    return Math.max(0, this.currentTime + Math.max(0, elapsedSeconds));
  }
  return this.currentTime;
};

// Method to verify if a candidate host token matches the stored hostTokenHash
RoomSchema.methods.verifyHostToken = function (candidateToken) {
  if (!candidateToken || !this.hostTokenHash) return false;
  const hash = crypto.createHash('sha256').update(candidateToken).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(this.hostTokenHash));
  } catch (e) {
    return false;
  }
};

export const Room = mongoose.model('Room', RoomSchema);
