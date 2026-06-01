import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema(
  {
    escalationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Escalation',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    body: {
      type: String,
      required: true,
      minlength: 30,
    },
    status: {
      type: String,
      enum: ['unverified', 'verified', 'rejected'],
      default: 'unverified',
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    upvoteCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Admin verification queue index
answerSchema.index({ status: 1, createdAt: 1 });
answerSchema.index({ escalationId: 1, status: 1, upvoteCount: -1 });

const Answer = mongoose.model('Answer', answerSchema);
export default Answer;
