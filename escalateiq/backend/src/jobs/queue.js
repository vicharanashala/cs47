/**
 * Bull Queue Setup
 * Redis-backed job queues for async operations.
 * Falls back to a no-op when Redis is not available (dev convenience).
 */

import config from '../config/index.js';

// ── No-op queue (when Redis is unavailable) ──────────────────────────
const noOpQueue = {
  add: async (jobName, data) => {
    console.log(`[queue:noop] Would queue ${jobName}:`, JSON.stringify(data));
  },
  process: () => {},
  on: () => {},
};

// ── Try to create a real Bull queue, fall back to no-op ──────────────
async function tryCreateBullQueue(name) {
  try {
    const { default: Bull } = await import('bull');
    const { default: IORedis } = await import('ioredis');

    // Test Redis connectivity with a 2s timeout
    const testClient = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    });
    testClient.on('error', () => {}); // prevent noisy unhandled connection warnings

    await Promise.race([
      testClient.connect(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000)),
    ]);
    await testClient.quit();

    // Redis is reachable — create the real queue
    const queue = new Bull(name, config.redisUrl);
    console.log(`[queue] ✓ ${name} queue connected to Redis`);

    if (config.isDev()) {
      queue.on('completed', (job) => console.log(`[queue] ${name}#${job.id} completed`));
      queue.on('failed', (job, err) => console.error(`[queue] ${name}#${job.id} failed:`, err.message));
    }
    return queue;
  } catch {
    console.warn(`[queue] Redis not reachable — ${name} running in no-op mode (embeddings will be skipped)`);
    return noOpQueue;
  }
}

// ── LazyQueue: initialises async, safe to call add() immediately ─────
class LazyQueue {
  constructor(name) {
    this._promise = tryCreateBullQueue(name);
  }
  async add(jobName, data) {
    const q = await this._promise;
    return q.add(jobName, data);
  }
  async process(jobName, handler) {
    const q = await this._promise;
    if (typeof q.process === 'function') q.process(jobName, handler);
  }
  async on(event, handler) {
    const q = await this._promise;
    if (typeof q.on === 'function') q.on(event, handler);
  }
}

export const embeddingQueue = new LazyQueue('embedding');
export const notificationQueue = new LazyQueue('notifications');
