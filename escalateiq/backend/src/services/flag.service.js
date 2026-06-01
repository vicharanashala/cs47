/**
 * Flag Service
 * User-submitted and system-generated flags for admin review.
 */

import Flag from '../models/Flag.js';
import Escalation from '../models/Escalation.js';
import Answer from '../models/Answer.js';
import { penalize } from './reputation.service.js';
import { notifyUser } from './notification.service.js';
import config from '../config/index.js';

const VALID_REASONS = ['spam', 'abuse', 'duplicate', 'off_topic', 'pii'];

/**
 * Submit a flag. Requires 50 reputation minimum.
 */
export async function submitFlag(reporter, { targetId, targetType, reason }) {
  // Gate: 50 pts minimum (enforced in service, not router)
  if (reporter.reputation < config.flagMinReputation) {
    const err = new Error(`You need at least ${config.flagMinReputation} reputation to flag content`);
    err.statusCode = 403;
    throw err;
  }

  if (!VALID_REASONS.includes(reason)) {
    const err = new Error(`Invalid reason. Must be one of: ${VALID_REASONS.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  // Check for duplicate flag from same user on same target
  const existing = await Flag.findOne({ reporterId: reporter._id, targetId, status: 'pending' });
  if (existing) {
    const err = new Error('You have already flagged this content');
    err.statusCode = 409;
    throw err;
  }

  return Flag.create({ reporterId: reporter._id, targetId, targetType, reason });
}

/**
 * Resolve a flag (admin only).
 * action: 'remove_content' | 'dismiss'
 */
export async function resolveFlag(admin, flagId, action) {
  const flag = await Flag.findById(flagId);
  if (!flag || flag.status !== 'pending') {
    const err = new Error('Flag not found or already resolved');
    err.statusCode = 404;
    throw err;
  }

  if (action === 'remove_content') {
    // Remove the target
    if (flag.targetType === 'escalation') {
      const esc = await Escalation.findByIdAndUpdate(flag.targetId, { status: 'removed' }, { new: true });
      if (esc) {
        await penalize(esc.userId.toString(), 10, 'content_removed_after_flags', flag._id.toString());
        await notifyUser(esc.userId.toString(), 'content_removed', { escalationId: esc._id.toString() });
      }
    } else if (flag.targetType === 'answer') {
      const ans = await Answer.findByIdAndUpdate(flag.targetId, { status: 'rejected', rejectionReason: 'Removed after flag review' }, { new: true });
      if (ans) {
        await penalize(ans.userId.toString(), 10, 'content_removed_after_flags', flag._id.toString());
        await notifyUser(ans.userId.toString(), 'content_removed', { answerId: ans._id.toString() });
      }
    }

    flag.status = 'resolved';
  } else if (action === 'dismiss') {
    flag.status = 'dismissed';
  } else {
    const err = new Error('Invalid action. Must be remove_content or dismiss');
    err.statusCode = 400;
    throw err;
  }

  flag.reviewedBy = admin._id;
  await flag.save();
  return flag;
}

export async function getPendingFlags(skip = 0, limit = 20) {
  const [flags, total] = await Promise.all([
    Flag.find({ status: 'pending' })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('reporterId', 'username reputation')
      .lean(),
    Flag.countDocuments({ status: 'pending' }),
  ]);

  const populatedFlags = await Promise.all(
    flags.map(async (flag) => {
      let target = null;
      if (flag.targetType === 'escalation') {
        target = await Escalation.findById(flag.targetId)
          .select('title body userId')
          .populate('userId', 'username')
          .lean();
      } else if (flag.targetType === 'answer') {
        target = await Answer.findById(flag.targetId)
          .select('body userId escalationId')
          .populate('userId', 'username')
          .populate('escalationId', 'title')
          .lean();
      }
      return { ...flag, target };
    })
  );

  return { flags: populatedFlags, total };
}
