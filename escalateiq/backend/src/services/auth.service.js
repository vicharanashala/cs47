/**
 * Auth Service
 * Handles user registration, login, and token refresh.
 */

import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { createAccessToken, createRefreshToken, decodeToken } from '../utils/jwt.utils.js';
import config from '../config/index.js';

/**
 * Register a new user.
 * @param {{ username, email, password }} data
 * @returns {Promise<User>}
 */
export async function registerUser({ username, email, password }) {
  // Check uniqueness
  const existingEmail = await User.findOne({ email: email.toLowerCase() });
  if (existingEmail) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }
  const existingUsername = await User.findOne({ username });
  if (existingUsername) {
    const err = new Error('Username already taken');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ username, email: email.toLowerCase(), passwordHash });
  return user;
}

/**
 * Login user — returns access + refresh tokens.
 * @param {{ email, password }} data
 * @returns {Promise<{ accessToken, refreshToken, user }>}
 */
export async function loginUser({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  if (user.isCurrentlyBanned()) {
    const err = new Error(
      user.isBanned
        ? 'Account permanently banned'
        : `Account suspended until ${user.banExpiresAt.toISOString()}`
    );
    err.statusCode = 403;
    throw err;
  }

  const accessToken = createAccessToken({ userId: user._id.toString(), role: user.role });
  const refreshToken = createRefreshToken({ userId: user._id.toString() });

  // Store hashed refresh token
  const tokenHash = await bcrypt.hash(refreshToken, 10);
  const expiresAt = new Date(
    Date.now() + config.refreshTokenExpireDays * 24 * 60 * 60 * 1000
  );
  await RefreshToken.create({ userId: user._id, tokenHash, expiresAt });

  return { accessToken, refreshToken, user };
}

/**
 * Refresh access token using a valid refresh token.
 * @param {string} refreshToken
 * @returns {Promise<{ accessToken, refreshToken }>}
 */
export async function refreshAccessToken(refreshToken) {
  const payload = decodeToken(refreshToken);
  const userId = payload.userId;

  // Find stored token records for this user
  const storedTokens = await RefreshToken.find({ userId, expiresAt: { $gt: new Date() } });
  
  // Verify token hash against one of the stored tokens
  let matched = null;
  for (const stored of storedTokens) {
    const ok = await bcrypt.compare(refreshToken, stored.tokenHash);
    if (ok) { matched = stored; break; }
  }
  
  if (!matched) {
    const err = new Error('Invalid refresh token');
    err.statusCode = 401;
    throw err;
  }

  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 401;
    throw err;
  }

  // Rotate: delete old, issue new
  await RefreshToken.findByIdAndDelete(matched._id);
  const newAccessToken = createAccessToken({ userId: user._id.toString(), role: user.role });
  const newRefreshToken = createRefreshToken({ userId: user._id.toString() });
  const tokenHash = await bcrypt.hash(newRefreshToken, 10);
  const expiresAt = new Date(Date.now() + config.refreshTokenExpireDays * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ userId: user._id, tokenHash, expiresAt });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

/**
 * Invalidate a refresh token (logout).
 * @param {string} refreshToken
 */
export async function logout(refreshToken) {
  try {
    const payload = decodeToken(refreshToken);
    const storedTokens = await RefreshToken.find({ userId: payload.userId });
    for (const stored of storedTokens) {
      const ok = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (ok) {
        await RefreshToken.findByIdAndDelete(stored._id);
        break;
      }
    }
  } catch {
    // Ignore decode errors on logout
  }
}
