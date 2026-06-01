/**
 * Auth Middleware
 * Verifies JWT access token and loads the current user.
 * Also handles ban checking.
 */

import { decodeToken } from '../utils/jwt.utils.js';
import User from '../models/User.js';

/**
 * Require a valid JWT. Attaches req.user.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.slice(7);
    const payload = decodeToken(token);

    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    // Check ban status
    if (user.isBanned) {
      return res.status(403).json({ error: 'Account permanently banned' });
    }
    if (user.banExpiresAt && user.banExpiresAt > new Date()) {
      return res.status(403).json({ error: `Account suspended until ${user.banExpiresAt.toISOString()}` });
    }
    // If temp ban expired, clear it
    if (user.banExpiresAt && user.banExpiresAt <= new Date()) {
      user.banExpiresAt = null;
      await user.save();
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(err.statusCode || 401).json({ error: err.message });
  }
}

/**
 * Optional auth — attaches req.user if token present, but doesn't fail if absent.
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  try {
    const token = authHeader.slice(7);
    const payload = decodeToken(token);
    const user = await User.findById(payload.userId);
    req.user = user || null;
  } catch {
    req.user = null;
  }
  next();
}

/**
 * Require admin role.
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Require minimum reputation.
 * @param {number} minPoints
 */
export function requireReputation(minPoints) {
  return (req, res, next) => {
    if (!req.user || req.user.reputation < minPoints) {
      return res.status(403).json({ error: `Requires at least ${minPoints} reputation` });
    }
    next();
  };
}
