/**
 * FAQ Service
 * CRUD for FAQ entries + auto-promotion from verified answers.
 */

import FAQEntry from '../models/FAQEntry.js';
import Escalation from '../models/Escalation.js';
import { embeddingQueue } from '../jobs/queue.js';
import { embedText, searchFAQ } from './semantic.service.js';

/**
 * Get paginated FAQ list.
 */
export async function getFAQList(skip = 0, limit = 20) {
  const [entries, total] = await Promise.all([
    FAQEntry.find({ isPublished: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-embedding -__v')
      .lean(),
    FAQEntry.countDocuments({ isPublished: true }),
  ]);
  return { entries, total };
}

/**
 * Get a single FAQ entry by ID.
 */
export async function getFAQById(faqId) {
  const entry = await FAQEntry.findOne({ _id: faqId, isPublished: true })
    .select('-embedding -__v')
    .lean();
  if (!entry) {
    const err = new Error('FAQ entry not found');
    err.statusCode = 404;
    throw err;
  }
  return entry;
}

/**
 * Full-text search on FAQ question and answer.
 * @param {string} query
 */
export async function searchFAQText(query) {
  try {
    const queryEmbedding = await embedText(query);
    // Use low threshold (0.50) to make sure search results find relevant matches
    const results = await searchFAQ(queryEmbedding, 0.50, 20);
    if (results.length > 0) {
      return results.map((r) => r.entry);
    }
  } catch (err) {
    console.warn('[faq_service] Semantic search failed, falling back to standard text index:', err.message);
  }

  return FAQEntry.find(
    { $text: { $search: query }, isPublished: true },
    { score: { $meta: 'textScore' }, embedding: 0 }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(20)
    .lean();
}

/**
 * Create a FAQ entry manually (admin).
 */
export async function createFAQEntry({ question, answer, tags }, adminId) {
  const entry = await FAQEntry.create({ question, answer, tags: tags || [], createdBy: adminId });
  // Dispatch async embedding
  await embeddingQueue.add('embed-faq', { faqId: entry._id.toString() });
  return entry;
}

/**
 * Update a FAQ entry (admin).
 */
export async function updateFAQEntry(faqId, updates) {
  const entry = await FAQEntry.findByIdAndUpdate(
    faqId,
    { ...updates, updatedAt: new Date() },
    { new: true, runValidators: true }
  ).select('-embedding -__v');
  if (!entry) {
    const err = new Error('FAQ entry not found');
    err.statusCode = 404;
    throw err;
  }
  // Re-embed if question or answer changed
  if (updates.question || updates.answer) {
    await embeddingQueue.add('embed-faq', { faqId: entry._id.toString() });
  }
  return entry;
}

/**
 * Soft-delete a FAQ entry (admin).
 */
export async function deleteFAQEntry(faqId) {
  await FAQEntry.findByIdAndUpdate(faqId, { isPublished: false });
}

/**
 * Auto-promote a verified answer to a FAQ entry.
 * Called exclusively from answer_service.verifyAnswer().
 * Business Rule: Only one FAQ entry per source escalation.
 *
 * @param {Answer} answer - fully populated answer document
 * @param {Escalation} escalation - parent escalation document
 */
export async function promoteToFAQ(answer, escalation) {
  // Idempotency check: skip if FAQ already exists for this escalation
  const existing = await FAQEntry.findOne({ sourceEscalation: escalation._id });
  if (existing) return existing;

  const entry = await FAQEntry.create({
    question: escalation.title,
    answer: answer.body,
    sourceEscalation: escalation._id,
    sourceAnswer: answer._id,
    tags: escalation.tags,
    isPublished: true,
  });

  // Dispatch async embedding
  await embeddingQueue.add('embed-faq', { faqId: entry._id.toString() });

  // Mark escalation as resolved — it will fall off the feed automatically
  await Escalation.findByIdAndUpdate(escalation._id, { status: 'resolved' });

  return entry;
}
