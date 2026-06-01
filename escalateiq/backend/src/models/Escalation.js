import mongoose from 'mongoose';

const escalationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      minlength: 5,
      maxlength: 300,
    },
    body: {
      type: String,
      required: true,
      minlength: 20,
    },
    status: {
      type: String,
      enum: ['open', 'answered', 'resolved', 'removed'],
      default: 'open',
    },
    upvoteCount: {
      type: Number,
      default: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 5,
        message: 'Maximum 5 tags allowed',
      },
    },
    // 384-dimensional embedding vector from all-MiniLM-L6-v2
    // Stored as a flat array. Similarity search done via semantic service.
    embedding: {
      type: [Number],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast feed queries
escalationSchema.index({ status: 1, createdAt: -1 });
escalationSchema.index({ status: 1, upvoteCount: -1 });
escalationSchema.index({ tags: 1 });

const Escalation = mongoose.model('Escalation', escalationSchema);
export default Escalation;
