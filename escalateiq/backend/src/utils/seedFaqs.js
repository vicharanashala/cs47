/**
 * Seed FAQs Utility
 * Parses the Vicharanashala Internship FAQ HTML file and populates the database.
 * Converts basic HTML styling to clean Markdown.
 */

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import config from '../config/index.js';
import FAQEntry from '../models/FAQEntry.js';
import { embedText } from '../services/semantic.service.js';

// Section ID to Tag mapping
const tagMapping = {
  '1': 'about',
  '2': 'timing',
  '3': 'noc',
  '4': 'selection',
  '5': 'work',
  '6': 'conduct',
  '7': 'interviews',
  '8': 'certificate',
  '9': 'rosetta',
  '10': 'coursework',
  '11': 'spurti',
  '12': 'yaksha',
  '13': 'vibe',
  '14': 'team',
};

async function seed() {
  const htmlPath = path.resolve('FAQ — Vicharanashala Internship.html');
  if (!fs.existsSync(htmlPath)) {
    // Try parent directory
    const parentPath = path.resolve('../FAQ — Vicharanashala Internship.html');
    if (fs.existsSync(parentPath)) {
      runSeeder(parentPath);
    } else {
      console.error(`[seed] FAQ HTML file not found at ${htmlPath} or ${parentPath}`);
      process.exit(1);
    }
  } else {
    runSeeder(htmlPath);
  }
}

async function runSeeder(filePath) {
  try {
    console.log(`[seed] Reading ${filePath}...`);
    const html = fs.readFileSync(filePath, 'utf-8');

    // Connect to database
    console.log('[seed] Connecting to database...');
    await mongoose.connect(config.mongodbUri);
    console.log('[seed] Database connected.');

    // Clear existing FAQ entries
    console.log('[seed] Clearing old FAQ entries...');
    await FAQEntry.deleteMany({});
    console.log('[seed] Wiped database FAQ entries.');

    // Split by <details class="faq-q"
    const blocks = html.split('<details class="faq-q"');
    console.log(`[seed] Found ${blocks.length - 1} FAQ blocks in HTML.`);

    const faqEntries = [];
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];

      // 1. Extract id
      const idMatch = block.match(/id="([^"]+)"/);
      if (!idMatch) continue;
      const faqId = idMatch[1]; // e.g. q-1-1

      // Determine tag based on section ID (e.g. q-3-2 -> section 3 -> noc)
      const sectionMatch = faqId.match(/^q-(\d+)-/);
      const sectionId = sectionMatch ? sectionMatch[1] : '1';
      const tag = tagMapping[sectionId] || 'general';

      // 2. Extract summary (Question)
      const summaryMatch = block.match(/<summary>([\s\S]*?)<\/summary>/);
      if (!summaryMatch) continue;
      let question = summaryMatch[1];

      // Remove anchor links and strip html tags
      question = question.replace(/<a[\s\S]*?<\/a>/g, '');
      question = question.replace(/<[^>]+>/g, '');
      // Clean up numbering (e.g. "1.1 What is..." -> "What is...")
      question = question.replace(/^\d+\.\d+\s+/, '');
      question = question.trim().replace(/§$/, '').trim();

      // 3. Extract body (Answer)
      const detailsEndIndex = block.indexOf('</details>');
      const detailsBody = block.substring(summaryMatch[0].length + block.indexOf('<summary>'), detailsEndIndex);
      let answer = detailsBody.trim();

      // Convert HTML tags to clean markdown/text format
      answer = answer.replace(/<p>/g, '').replace(/<\/p>/g, '\n\n');
      answer = answer.replace(/<strong>/g, '**').replace(/<\/strong>/g, '**');
      answer = answer.replace(/<ul>/g, '').replace(/<\/ul>/g, '\n');
      answer = answer.replace(/<li>/g, '- ').replace(/<\/li>/g, '\n');
      answer = answer.replace(/<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, '[$2]($1)');
      answer = answer.replace(/<br\s*\/?>/g, '\n');
      answer = answer.replace(/<[^>]+>/g, ''); // strip any remaining tags
      answer = answer.trim().replace(/\n{3,}/g, '\n\n'); // normalize newlines

      if (question && answer) {
        faqEntries.push({
          question,
          answer,
          tags: [tag, 'vicharanashala', 'internship'],
          isPublished: true,
        });
      }
    }

    console.log(`[seed] Parsed ${faqEntries.length} complete FAQs successfully.`);

    // Check if Python Embedding Service is available
    let hasEmbeddingService = false;
    try {
      const resp = await fetch(`${config.embeddingServiceUrl}/health`, { signal: AbortSignal.timeout(2000) });
      hasEmbeddingService = resp.ok;
    } catch {
      hasEmbeddingService = false;
    }

    // Insert to DB + generate embeddings
    console.log(`[seed] Seeding to database${hasEmbeddingService ? ' and generating semantic embeddings' : ''}...`);
    
    let count = 0;
    for (const faq of faqEntries) {
      let embedding = null;
      if (hasEmbeddingService) {
        try {
          embedding = await embedText(`${faq.question} ${faq.answer}`);
        } catch (err) {
          console.warn(`[seed] Failed to generate embedding for "${faq.question.slice(0, 30)}...":`, err.message);
        }
      }

      await FAQEntry.create({
        ...faq,
        embedding,
      });

      count++;
      if (count % 10 === 0) {
        console.log(`[seed] Progress: ${count}/${faqEntries.length} entries written`);
      }
    }

    console.log(`[seed] ✓ Successfully seeded ${count} FAQs into database!`);
    mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('[seed] Seeder failed with fatal error:', err);
    process.exit(1);
  }
}

seed();
