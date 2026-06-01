import mongoose from 'mongoose';

const flagSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null = system-generated (auto_safety)
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
    reason: {
      type: String,
      enum: ['spam', 'abuse', 'duplicate', 'off_topic', 'pii', 'auto_safety'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'resolved', 'dismissed'],
      default: 'pending',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

flagSchema.index({ status: 1, createdAt: 1 });
flagSchema.index({ targetId: 1, targetType: 1 });

const Flag = mongoose.model('Flag', flagSchema);
export default Flag;
