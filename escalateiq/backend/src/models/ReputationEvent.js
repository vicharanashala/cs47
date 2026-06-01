import mongoose from 'mongoose';

const reputationEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    delta: {
      type: Number,
      required: true, // positive = award, negative = penalty
    },
    reason: {
      type: String,
      required: true,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null, // escalation/answer/flag that triggered this event
    },
  },
  {
    timestamps: true,
  }
);

reputationEventSchema.index({ userId: 1, createdAt: -1 });
// For violation counting (penalty system)
reputationEventSchema.index({ userId: 1, delta: 1, createdAt: -1 });

const ReputationEvent = mongoose.model('ReputationEvent', reputationEventSchema);
export default ReputationEvent;
