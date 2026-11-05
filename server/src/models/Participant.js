import mongoose from 'mongoose';

const ParticipantSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    roomId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['Host', 'Moderator', 'Participant'],
      default: 'Participant',
      required: true,
    },
    socketId: {
      type: String,
      default: null,
    },
    isOnline: {
      type: Boolean,
      default: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for uniqueness of userId within a room
ParticipantSchema.index({ roomId: 1, userId: 1 }, { unique: true });

export const Participant = mongoose.model('Participant', ParticipantSchema);

