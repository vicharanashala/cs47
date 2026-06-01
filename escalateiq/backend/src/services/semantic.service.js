/**
 * Semantic Service
 * Communicates with the Python embedding microservice to:
 *  - Generate 384-dim embeddings
 *  - Search FAQ entries by vector similarity (cosine)
 *  - Search open escalations by vector similarity
 *
 * The HNSW-style search is done in-process using cosine similarity
 * across all stored embeddings loaded from MongoDB. This is fast enough
 * for thousands of entries. For production at scale, swap to Atlas $vectorSearch.
 */

import fetch from 'node-fetch';
import config from '../config/index.js';
import FAQEntry from '../models/FAQEntry.js';
import Escalation from '../models/Escalation.js';

const BASE_URL = config.embeddingServiceUrl;

/**
 * Embed a single text string.
 * @param {string} text
 * @returns {Promise<number[]>} 384-dim vector
 */
export async function embedText(text) {
  const response = await fetch(`${BASE_URL}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    throw new Error(`Embedding service error: ${response.statusText}`);
  }
  const data = await response.json();
  return data.embedding;
}

/**
 * Embed multiple texts in a single batch call.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedTexts(texts) {
  const response = await fetch(`${BASE_URL}/embed-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts }),
  });
  if (!response.ok) {
    throw new Error(`Embedding service error: ${response.statusText}`);
  }
  const data = await response.json();
  return data.embeddings;
}

/**
 * Compute cosine similarity between two vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} score in [0, 1]
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Search published FAQ entries by vector similarity.
 * Loads all FAQ entries with embeddings from MongoDB, computes cosine similarity
 * in-process, returns those above the threshold sorted by score desc.
 *
 * @param {number[]} queryEmbedding
 * @param {number} threshold - minimum similarity score (e.g. 0.85)
 * @param {number} limit - max results
 * @returns {Promise<Array<{entry: FAQEntry, score: number}>>}
 */
export async function searchFAQ(queryEmbedding, threshold = config.faqSimilarityThreshold, limit = 5) {
  // Fetch only documents that have an embedding
  const entries = await FAQEntry.find({ isPublished: true, embedding: { $exists: true, $ne: null } })
    .select('-__v')
    .lean();

  const results = entries
    .map((entry) => ({ entry, score: cosineSimilarity(queryEmbedding, entry.embedding) }))
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}

/**
 * Search open escalations by vector similarity.
 *
 * @param {number[]} queryEmbedding
 * @param {number} threshold - minimum similarity (e.g. 0.75)
 * @param {number} limit
 * @returns {Promise<Array<{escalation: Escalation, score: number}>>}
 */
export async function searchEscalations(queryEmbedding, threshold = config.feedSimilarityThreshold, limit = 3) {
  const escalations = await Escalation.find({
    status: { $in: ['open', 'answered'] },
    embedding: { $exists: true, $ne: null },
  })
    .select('-__v')
    .lean();

  const results = escalations
    .map((escalation) => ({ escalation, score: cosineSimilarity(queryEmbedding, escalation.embedding) }))
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}
