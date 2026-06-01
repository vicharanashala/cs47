/**
 * Reputation Service
 * All reputation changes go through this service.
 * Business Rule: Reputation is append-only via ReputationEvent records.
 * Never SET reputation = X directly — always use awardPoints() or penalize().
 */

import ReputationEvent from '../models/ReputationEvent.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

/**
 * Award points to a user.
 * @param {string} userId
 * @param {number} delta - positive integer
 * @param {string} reason
 * @param {string|null} refId - escalation/answer/flag objectId that triggered this
 */
export async function awardPoints(userId, delta, reason, refId = null) {
  if (delta <= 0) throw new Error('awardPoints: delta must be positive. Use penalize() for deductions.');

  await ReputationEvent.create({ userId, delta, reason, refId });
  await User.findByIdAndUpdate(userId, { $inc: { reputation: delta } });
}

/**
 * Deduct points from a user (penalty).
 * @param {string} userId
 * @param {number} delta - positive integer (will be negated internally)
 * @param {string} reason
 * @param {string|null} refId
 */
export async function penalize(userId, delta, reason, refId = null) {
  const negativeDelta = -Math.abs(delta);

  await ReputationEvent.create({ userId, delta: negativeDelta, reason, refId });
  await User.findByIdAndUpdate(userId, { $inc: { reputation: negativeDelta } });

  // Check for repeat offenders: 3+ violations in last 30 days → temp ban
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const violationCount = await ReputationEvent.countDocuments({
    userId,
    delta: { $lt: 0 },
    createdAt: { $gte: thirtyDaysAgo },
  });

  if (violationCount >= 3) {
    const banExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await User.findByIdAndUpdate(userId, { banExpiresAt });
    console.log(`[reputation] User ${userId} temp-banned until ${banExpiresAt.toISOString()}`);
  }
}

/**
 * Get reputation history for a user.
 * @param {string} userId
 * @param {number} skip
 * @param {number} limit
 */
export async function getReputationHistory(userId, skip = 0, limit = 20) {
  return ReputationEvent.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

/**
 * Get leaderboard.
 * @param {'all_time'|'weekly'} period
 * @returns {Promise<Array>}
 */
export async function getLeaderboard(period = 'all_time') {
  if (period === 'weekly') {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return ReputationEvent.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo }, delta: { $gt: 0 } } },
      { $group: { _id: '$userId', weeklyPoints: { $sum: '$delta' } } },
      { $sort: { weeklyPoints: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          userId: '$_id',
          username: '$user.username',
          reputation: '$user.reputation',
          weeklyPoints: 1,
        },
      },
    ]);
  }

  // All-time: just sort users by reputation
  return User.find({ isBanned: false })
    .sort({ reputation: -1 })
    .limit(20)
    .select('username reputation createdAt')
    .lean();
}
