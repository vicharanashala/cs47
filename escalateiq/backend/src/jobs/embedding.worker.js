/**
 * Embedding Worker
 * Processes async embedding jobs for escalations and FAQ entries.
 * Calls the Python embedding microservice and stores vectors in MongoDB.
 */

import mongoose from 'mongoose';
import { embeddingQueue } from './queue.js';
import { embedText } from '../services/semantic.service.js';
import Escalation from '../models/Escalation.js';
import FAQEntry from '../models/FAQEntry.js';
import config from '../config/index.js';

// Ensure MongoDB is connected before processing
async function ensureConnection() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(config.mongodbUri);
  }
}

embeddingQueue.process('embed-escalation', async (job) => {
  await ensureConnection();
  const { escalationId } = job.data;

  const escalation = await Escalation.findById(escalationId);
  if (!escalation) {
    console.warn(`[embedding_worker] Escalation ${escalationId} not found — skipping`);
    return;
  }

  const text = `${escalation.title} ${escalation.body}`;
  const embedding = await embedText(text);

  await Escalation.findByIdAndUpdate(escalationId, { embedding });
  console.log(`[embedding_worker] Embedded escalation ${escalationId}`);
});

embeddingQueue.process('embed-faq', async (job) => {
  await ensureConnection();
  const { faqId } = job.data;

  const entry = await FAQEntry.findById(faqId);
  if (!entry) {
    console.warn(`[embedding_worker] FAQEntry ${faqId} not found — skipping`);
    return;
  }

  const text = `${entry.question} ${entry.answer}`;
  const embedding = await embedText(text);

  await FAQEntry.findByIdAndUpdate(faqId, { embedding });
  console.log(`[embedding_worker] Embedded FAQ entry ${faqId}`);
});

console.log('[embedding_worker] Worker started, waiting for jobs...');
