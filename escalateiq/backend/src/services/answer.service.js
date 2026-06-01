/**
 * Answer Service
 * Handles answer submission, upvoting, and admin verification/rejection.
 */

import Answer from '../models/Answer.js';
import Escalation from '../models/Escalation.js';
import Vote from '../models/Vote.js';
import { checkText } from './safety.service.js';
import { notifyUser } from './notification.service.js';
import { awardPoints, penalize } from './reputation.service.js';
import { promoteToFAQ } from './faq.service.js';
import { broadcast } from '../websocket/feed.ws.js';

/**
 * Submit an answer to an escalation.
 */
export async function submitAnswer(user, escalationId, { body }) {
  // Safety check
  const safety = checkText(body);
  if (safety.isBlocked) {
    const err = new Error('Answer content flagged as inappropriate');
    err.statusCode = 422;
    throw err;
  }

  const escalation = await Escalation.findById(escalationId);
  if (!escalation || !['open', 'answered'].includes(escalation.status)) {
    const err = new Error('Escalation not found or not accepting answers');
    err.statusCode = 404;
    throw err;
  }

  const answer = await Answer.create({ escalationId, userId: user._id, body });

  // Auto-flag if needed
  if (safety.isFlagged) {
    const { default: Flag } = await import('../models/Flag.js');
    await Flag.create({ reporterId: null, targetId: answer._id, targetType: 'answer', reason: 'auto_safety' });
  }

  // Update escalation status
  if (escalation.status === 'open') {
    await Escalation.findByIdAndUpdate(escalationId, { status: 'answered' });
  }

  // Award +1 to escalation author for receiving an answer
  if (escalation.userId.toString() !== user._id.toString()) {
    await awardPoints(escalation.userId.toString(), 1, 'escalation_received_answer', answer._id.toString());
  }

  // Notify escalation author
  await notifyUser(escalation.userId.toString(), 'answer_received', {
    escalationId: escalationId,
    escalationTitle: escalation.title,
    answerId: answer._id.toString(),
  });

  return answer;
}

/**
 * Upvote an answer.
 */
export async function upvoteAnswer(user, answerId) {
  const answer = await Answer.findById(answerId);
  if (!answer) {
    const err = new Error('Answer not found');
    err.statusCode = 404;
    throw err;
  }
  if (answer.userId.toString() === user._id.toString()) {
    const err = new Error('Cannot vote on your own content');
    err.statusCode = 400;
    throw err;
  }

  try {
    await Vote.create({ userId: user._id, targetId: answerId, targetType: 'answer' });
    const updated = await Answer.findByIdAndUpdate(answerId, { $inc: { upvoteCount: 1 } }, { new: true });
    await awardPoints(answer.userId.toString(), 2, 'answer_upvoted', answerId);
    return { upvoteCount: updated.upvoteCount };
  } catch (err) {
    if (err.code === 11000) {
      const e = new Error('Already upvoted');
      e.statusCode = 409;
      throw e;
    }
    throw err;
  }
}

/**
 * List answers for an escalation.
 * Order: verified first, then by upvoteCount desc.
 */
export async function listAnswers(escalationId, currentUserId = null) {
  const answers = await Answer.find({ escalationId, status: { $ne: 'rejected' } })
    .populate('userId', 'username reputation')
    .sort({ status: -1, upvoteCount: -1 }) // 'verified' sorts before 'unverified' alphabetically
    .lean();

  let votedIds = new Set();
  if (currentUserId) {
    const votes = await Vote.find({
      userId: currentUserId,
      targetId: { $in: answers.map((a) => a._id) },
      targetType: 'answer',
    }).lean();
    votedIds = new Set(votes.map((v) => v.targetId.toString()));
  }

  return answers.map((a) => ({
    ...a,
    authorUsername: a.userId?.username,
    authorReputation: a.userId?.reputation,
    hasUserVoted: votedIds.has(a._id.toString()),
    isAuthor: currentUserId ? a.userId?._id?.toString() === currentUserId.toString() : false,
    userId: a.userId?._id,
  }));
}

/**
 * Verify an answer (admin only).
 * Triggers: +10 points, FAQ promotion, WebSocket broadcast.
 */
export async function verifyAnswer(admin, answerId) {
  const answer = await Answer.findById(answerId);
  if (!answer || answer.status !== 'unverified') {
    const err = new Error('Answer not found or already processed');
    err.statusCode = 404;
    throw err;
  }

  answer.status = 'verified';
  answer.verifiedBy = admin._id;
  answer.verifiedAt = new Date();
  await answer.save();

  const escalation = await Escalation.findById(answer.escalationId);

  // Award +10 to answer author
  await awardPoints(answer.userId.toString(), 10, 'answer_verified', answer._id.toString());

  // Award +5 to escalation author for FAQ promotion
  if (escalation && escalation.userId.toString() !== answer.userId.toString()) {
    await awardPoints(escalation.userId.toString(), 5, 'escalation_promoted_to_faq', escalation._id.toString());
  }

  // Auto-promote to FAQ
  if (escalation) {
    await promoteToFAQ(answer, escalation);
  }

  // Notify answer author
  await notifyUser(answer.userId.toString(), 'answer_verified', {
    answerId: answer._id.toString(),
    escalationId: answer.escalationId.toString(),
  });

  // WebSocket broadcast
  broadcast('escalation_answered', { escalationId: answer.escalationId.toString() });

  return answer;
}

/**
 * Reject an answer (admin only).
 * Triggers: -5 points.
 */
export async function rejectAnswer(admin, answerId, reason) {
  const answer = await Answer.findById(answerId);
  if (!answer || answer.status !== 'unverified') {
    const err = new Error('Answer not found or already processed');
    err.statusCode = 404;
    throw err;
  }

  answer.status = 'rejected';
  answer.rejectionReason = reason;
  await answer.save();

  // Penalize -5
  await penalize(answer.userId.toString(), 5, 'answer_rejected', answer._id.toString());

  // Notify author
  await notifyUser(answer.userId.toString(), 'answer_rejected', {
    answerId: answer._id.toString(),
    reason,
  });

  return answer;
}
