/**
 * EscalateIQ — Configuration
 * All environment variables are loaded and validated here.
 * Import pattern everywhere: import config from '../config/index.js'
 */

import 'dotenv/config';

const required = (key) => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
};

const optional = (key, defaultValue) => process.env[key] ?? defaultValue;

const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '5000'), 10),

  // JWT
  secretKey: optional('SECRET_KEY', 'dev-secret-key-change-in-production-min-32'),
  accessTokenExpireMinutes: parseInt(optional('ACCESS_TOKEN_EXPIRE_MINUTES', '30'), 10),
  refreshTokenExpireDays: parseInt(optional('REFRESH_TOKEN_EXPIRE_DAYS', '7'), 10),

  // MongoDB
  mongodbUri: optional('MONGODB_URI', 'mongodb://localhost:27017/escalateiq'),

  // Redis
  redisUrl: optional('REDIS_URL', 'redis://localhost:6379'),

  // Python embedding service
  embeddingServiceUrl: optional('EMBEDDING_SERVICE_URL', 'http://localhost:8001'),

  // Semantic thresholds
  faqSimilarityThreshold: parseFloat(optional('FAQ_SIMILARITY_THRESHOLD', '0.85')),
  feedSimilarityThreshold: parseFloat(optional('FEED_SIMILARITY_THRESHOLD', '0.75')),
  ragTopK: parseInt(optional('RAG_TOP_K', '5'), 10),

  // Safety
  safetyBlockThreshold: parseFloat(optional('SAFETY_BLOCK_THRESHOLD', '0.85')),
  safetyFlagThreshold: parseFloat(optional('SAFETY_FLAG_THRESHOLD', '0.60')),

  // LLM
  llmProvider: optional('LLM_PROVIDER', 'gemini'),
  geminiApiKey: optional('GEMINI_API_KEY', ''),
  openaiApiKey: optional('OPENAI_API_KEY', ''),

  // Business rules
  adminAnswerTimeoutDays: parseInt(optional('ADMIN_ANSWER_TIMEOUT_DAYS', '7'), 10),
  flagMinReputation: parseInt(optional('FLAG_MIN_REPUTATION', '50'), 10),

  isDev: () => config.env === 'development',
  isProd: () => config.env === 'production',
};

export default config;
