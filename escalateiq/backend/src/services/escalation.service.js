/**
 * Escalation Service
 * Core product flow: check_and_raise → safety → FAQ search → feed search → create
 */

import Escalation from '../models/Escalation.js';
import Vote from '../models/Vote.js';
import FAQEntry from '../models/FAQEntry.js';
import { checkText } from './safety.service.js';
import { embedText, searchFAQ, searchEscalations } from './semantic.service.js';
import { generateFAQAnswer } from './rag.service.js';
import { notifyUser } from './notification.service.js';
import { awardPoints } from './reputation.service.js';
import { embeddingQueue } from '../jobs/queue.js';
import { broadcast } from '../websocket/feed.ws.js';
import config from '../config/index.js';

/**
 * Core flow: check_and_raise
 * Returns one of three actions: 'faq_match', 'feed_match', 'created'
 *
 * @param {User} user - authenticated user
 * @param {{ title, body, tags }} data
 * @returns {Promise<{ action: string, payload: object }>}
 */
export async function checkAndRaise(user, { title, body, tags = [] }) {
  // ── Step 1: Safety check ────────────────────────────────────────
  const safetyResult = checkText(`${title} ${body}`);
  if (safetyResult.isBlocked) {
    const err = new Error('Content flagged as inappropriate and cannot be submitted');
    err.statusCode = 422;
    throw err;
  }
  // Auto-flag if needed (handled in escalation creation below)

  // ── Step 2: Embed the query & Semantic Search (Fail-safe) ──────────
  let queryEmbedding = null;
  let faqMatches = [];
  let feedMatches = [];

  try {
    queryEmbedding = await embedText(`${title} ${body}`);
    faqMatches = await searchFAQ(queryEmbedding, config.faqSimilarityThreshold);
    if (faqMatches.length === 0) {
      feedMatches = await searchEscalations(queryEmbedding, config.feedSimilarityThreshold);
    }
  } catch (err) {
    console.warn('[escalation_service] Semantic sidecar down. Skipping checks and directly raising escalation:', err.message);
  }

  // ── Step 3: FAQ Match ──────────────────────────────────────────
  if (faqMatches && faqMatches.length > 0) {
    const topEntries = faqMatches.slice(0, config.ragTopK).map((m) => m.entry);
    const generatedAnswer = await generateFAQAnswer(`${title} ${body}`, topEntries);
    return {
      action: 'faq_match',
      payload: {
        faqEntries: topEntries.map(sanitizeFAQ),
        generatedAnswer,
      },
    };
  }

  // ── Step 4: Open Escalations Match ─────────────────────────────
  if (feedMatches && feedMatches.length > 0) {
    const topEscalation = feedMatches[0].escalation;
    await _autoUpvote(user, topEscalation);
    await notifyUser(topEscalation.userId.toString(), 'auto_upvote', {
      escalationId: topEscalation._id.toString(),
      escalationTitle: topEscalation.title,
    });
    const updated = await Escalation.findById(topEscalation._id)
      .populate('userId', 'username reputation')
      .lean();
    return { action: 'feed_match', payload: sanitizeEscalation(updated, user._id) };
  }

  // ── Step 5: Create new escalation ───────────────────────────────
  const escalation = await Escalation.create({
    userId: user._id,
    title,
    body,
    tags: tags.slice(0, 5),
  });

  // Auto-flag if safety flagged
  if (safetyResult.isFlagged) {
    const { default: Flag } = await import('../models/Flag.js');
    await Flag.create({
      reporterId: null,
      targetId: escalation._id,
      targetType: 'escalation',
      reason: 'auto_safety',
    });
  }

  // Async embedding via Bull queue
  await embeddingQueue.add('embed-escalation', { escalationId: escalation._id.toString() });

  // Broadcast to WebSocket clients
  const populated = await Escalation.findById(escalation._id)
    .populate('userId', 'username reputation')
    .lean();
  broadcast('new_escalation', sanitizeEscalation(populated, user._id));

  return { action: 'created', payload: sanitizeEscalation(populated, user._id) };
}

/**
 * Force-create an escalation, bypassing semantic checks (but still safety-checked).
 * Used when user explicitly chooses to post after FAQ match.
 */
export async function forceRaise(user, { title, body, tags = [] }) {
  const safetyResult = checkText(`${title} ${body}`);
  if (safetyResult.isBlocked) {
    const err = new Error('Content flagged as inappropriate');
    err.statusCode = 422;
    throw err;
  }

  const escalation = await Escalation.create({
    userId: user._id,
    title,
    body,
    tags: tags.slice(0, 5),
  });

  if (safetyResult.isFlagged) {
    const { default: Flag } = await import('../models/Flag.js');
    await Flag.create({ reporterId: null, targetId: escalation._id, targetType: 'escalation', reason: 'auto_safety' });
  }

  await embeddingQueue.add('embed-escalation', { escalationId: escalation._id.toString() });

  const populated = await Escalation.findById(escalation._id)
    .populate('userId', 'username reputation')
    .lean();
  broadcast('new_escalation', sanitizeEscalation(populated, user._id));

  return { action: 'created', payload: sanitizeEscalation(populated, user._id) };
}

/**
 * Auto-upvote an escalation on behalf of a user (idempotent).
 */
async function _autoUpvote(user, escalation) {
  // Business Rule: cannot vote on own content
  if (escalation.userId.toString() === user._id.toString()) return;

  try {
    await Vote.create({
      userId: user._id,
      targetId: escalation._id,
      targetType: 'escalation',
    });
    await Escalation.findByIdAndUpdate(escalation._id, { $inc: { upvoteCount: 1 } });
    // Award +1 reputation to escalation author for receiving an auto-upvote
    await awardPoints(escalation.userId.toString(), 1, 'escalation_auto_upvoted', escalation._id.toString());
  } catch (err) {
    if (err.code === 11000) return; // Duplicate vote — skip silently (idempotent)
    throw err;
  }
}

/**
 * Manual upvote from the feed.
 */
export async function upvoteEscalation(user, escalationId) {
  const escalation = await Escalation.findById(escalationId);
  if (!escalation) {
    const err = new Error('Escalation not found');
    err.statusCode = 404;
    throw err;
  }
  if (escalation.userId.toString() === user._id.toString()) {
    const err = new Error('Cannot vote on your own content');
    err.statusCode = 400;
    throw err;
  }

  try {
    await Vote.create({ userId: user._id, targetId: escalationId, targetType: 'escalation' });
    const updated = await Escalation.findByIdAndUpdate(
      escalationId,
      { $inc: { upvoteCount: 1 } },
      { new: true }
    );
    await awardPoints(escalation.userId.toString(), 1, 'escalation_upvoted', escalationId);
    return { upvoteCount: updated.upvoteCount };
  } catch (err) {
    if (err.code === 11000) {
      const err2 = new Error('Already upvoted');
      err2.statusCode = 409;
      throw err2;
    }
    throw err;
  }
}

/**
 * List escalations (public feed).
 * @param {{ skip, limit, sortBy, tag }} options
 * @param {string|null} currentUserId
 */
export async function listEscalations({ skip = 0, limit = 20, sortBy = 'newest', tag } = {}, currentUserId = null) {
  const filter = { status: { $in: ['open', 'answered'] } };
  if (tag) filter.tags = tag;

  let sort = { createdAt: -1 };
  if (sortBy === 'most_upvoted') sort = { upvoteCount: -1, createdAt: -1 };
  if (sortBy === 'unanswered') filter.status = 'open';

  const [escalations, total] = await Promise.all([
    Escalation.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('userId', 'username reputation')
      .select('-embedding -__v')
      .lean(),
    Escalation.countDocuments(filter),
  ]);

  // Compute hasUserVoted if authenticated
  let votedIds = new Set();
  if (currentUserId) {
    const votes = await Vote.find({
      userId: currentUserId,
      targetId: { $in: escalations.map((e) => e._id) },
      targetType: 'escalation',
    }).lean();
    votedIds = new Set(votes.map((v) => v.targetId.toString()));
  }

  return {
    escalations: escalations.map((e) => ({
      ...e,
      authorUsername: e.userId?.username,
      authorReputation: e.userId?.reputation,
      hasUserVoted: votedIds.has(e._id.toString()),
      userId: e.userId?._id,
    })),
    total,
  };
}

/**
 * Get a single escalation (increments view count).
 */
export async function getEscalation(escalationId, currentUserId = null) {
  const escalation = await Escalation.findByIdAndUpdate(
    escalationId,
    { $inc: { viewCount: 1 } },
    { new: true }
  )
    .populate('userId', 'username reputation')
    .select('-embedding -__v')
    .lean();

  if (!escalation || escalation.status === 'removed') {
    const err = new Error('Escalation not found');
    err.statusCode = 404;
    throw err;
  }

  let hasUserVoted = false;
  if (currentUserId) {
    const vote = await Vote.findOne({ userId: currentUserId, targetId: escalationId, targetType: 'escalation' });
    hasUserVoted = !!vote;
  }

  return {
    ...escalation,
    authorUsername: escalation.userId?.username,
    hasUserVoted,
    userId: escalation.userId?._id,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function sanitizeEscalation(escalation, currentUserId) {
  const obj = { ...escalation };
  delete obj.embedding;
  delete obj.__v;
  obj.authorUsername = escalation.userId?.username || escalation.userId;
  obj.userId = escalation.userId?._id || escalation.userId;
  return obj;
}

function sanitizeFAQ(entry) {
  const obj = { ...entry };
  delete obj.embedding;
  delete obj.__v;
  return obj;
}
