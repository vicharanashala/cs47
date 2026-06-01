/**
 * JWT Utilities
 * Creates and decodes access + refresh tokens.
 */

import jwt from 'jsonwebtoken';
import config from '../config/index.js';

/**
 * Create a short-lived access token
 * @param {object} payload - { userId, role }
 */
export function createAccessToken(payload) {
  return jwt.sign(payload, config.secretKey, {
    expiresIn: `${config.accessTokenExpireMinutes}m`,
  });
}

/**
 * Create a long-lived refresh token
 * @param {object} payload - { userId }
 */
export function createRefreshToken(payload) {
  return jwt.sign(payload, config.secretKey, {
    expiresIn: `${config.refreshTokenExpireDays}d`,
  });
}

/**
 * Decode and verify a token. Throws 401 on failure.
 * @param {string} token
 * @returns {object} decoded payload
 */
export function decodeToken(token) {
  try {
    return jwt.verify(token, config.secretKey);
  } catch (err) {
    const error = new Error('Invalid or expired token');
    error.statusCode = 401;
    throw error;
  }
}
