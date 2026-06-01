import mongoose from 'mongoose';

const faqEntrySchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      required: true,
    },
    sourceEscalation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Escalation',
      default: null,
    },
    sourceAnswer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Answer',
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    // 384-dimensional embedding
    embedding: {
      type: [Number],
      default: null,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Text search index for full-text FAQ search
faqEntrySchema.index({ question: 'text', answer: 'text', tags: 'text' });
faqEntrySchema.index({ isPublished: 1, createdAt: -1 });
faqEntrySchema.index({ sourceEscalation: 1 });

const FAQEntry = mongoose.model('FAQEntry', faqEntrySchema);
export default FAQEntry;
