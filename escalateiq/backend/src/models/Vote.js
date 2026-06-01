import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    targetType: {
      type: String,
      enum: ['escalation', 'answer'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce uniqueness: one vote per user per target
voteSchema.index({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });

const Vote = mongoose.model('Vote', voteSchema);
export default Vote;
