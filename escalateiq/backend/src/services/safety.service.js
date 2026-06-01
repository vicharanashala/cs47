/**
 * Safety Service
 * Checks user-submitted text for toxicity and PII.
 * Uses a simple regex-based PII detector and a word-list toxicity classifier
 * (no Python required). For production, upgrade to a proper ML model.
 *
 * Returns: { isBlocked, isFlagged, scores }
 *   isBlocked = true → reject the content (HTTP 422)
 *   isFlagged = true → allow but auto-create a system Flag record
 */

import config from '../config/index.js';

// ─── Toxicity word list (simplified) ─────────────────────────────────
// In production, replace with @tensorflow-models/toxicity inference
const SEVERE_TOXICITY_PATTERNS = [
  /\b(kill|murder|rape|bomb|terrorist)\b/i,
];
const MILD_TOXICITY_PATTERNS = [
  /\b(hate|stupid|idiot|dumb|loser)\b/i,
];

// ─── PII patterns ─────────────────────────────────────────────────────
const PII_PATTERNS = [
  // Email address
  /[\w.+-]+@[\w-]+\.[a-z]{2,}/i,
  // Phone number (10+ digits with optional separators)
  /\+?[\d\s\-().]{10,}/,
  // SSN pattern (US)
  /\b\d{3}-\d{2}-\d{4}\b/,
  // Credit card (16 digits)
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
];

/**
 * Check text for safety issues.
 * @param {string} text
 * @returns {{ isBlocked: boolean, isFlagged: boolean, scores: object }}
 */
export function checkText(text) {
  const scores = {};
  let isBlocked = false;
  let isFlagged = false;

  // Check severe toxicity
  const hasSevereToxicity = SEVERE_TOXICITY_PATTERNS.some((re) => re.test(text));
  if (hasSevereToxicity) {
    scores.toxicity = 0.95;
    isBlocked = true;
  }

  // Check mild toxicity
  if (!isBlocked) {
    const hasMildToxicity = MILD_TOXICITY_PATTERNS.some((re) => re.test(text));
    if (hasMildToxicity) {
      scores.toxicity = 0.70;
      if (scores.toxicity >= config.safetyBlockThreshold) {
        isBlocked = true;
      } else if (scores.toxicity >= config.safetyFlagThreshold) {
        isFlagged = true;
      }
    } else {
      scores.toxicity = 0.0;
    }
  }

  // Check PII
  const hasPII = PII_PATTERNS.some((re) => re.test(text));
  if (hasPII) {
    scores.pii = true;
    isFlagged = true;
  }

  return { isBlocked, isFlagged, scores };
}
