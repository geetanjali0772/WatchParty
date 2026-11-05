import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    role: {
      type: String,
      enum: ['Host', 'Moderator', 'Participant'],
      default: 'Participant',
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index to efficiently query messages by room ordered by time
MessageSchema.index({ roomId: 1, createdAt: 1 });

export const Message = mongoose.model('Message', MessageSchema);

