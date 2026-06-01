/**
 * RAG Service (Retrieval-Augmented Generation)
 * Generates a grounded answer from FAQ context using Google Gemini 1.5 Flash.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/index.js';

let _gemini = null;

function getGeminiClient() {
  if (!_gemini) {
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    _gemini = new GoogleGenerativeAI(config.geminiApiKey);
  }
  return _gemini;
}

/**
 * Generate a synthesized answer from FAQ context using Gemini.
 * @param {string} userQuery - the user's original question
 * @param {Array} faqEntries - array of FAQEntry documents (from semantic search)
 * @returns {Promise<string>} generated answer text
 */
export async function generateFAQAnswer(userQuery, faqEntries) {
  // Build context from top-k FAQ entries
  const context = faqEntries
    .slice(0, config.ragTopK)
    .map((e) => `Q: ${e.question}\nA: ${e.answer}`)
    .join('\n---\n');

  const systemPrompt = `You are a helpful support assistant for EscalateIQ. 
Answer the user's question using ONLY the provided FAQ context below.
If the context does not contain a specific answer, respond: "I couldn't find a specific answer in our FAQ."
Do not make up information. Be concise and helpful. Format your response in clear, readable prose.

FAQ Context:
${context}`;

  const userMessage = `User Question: ${userQuery}`;

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent([systemPrompt, userMessage]);
    return result.response.text();
  } catch (err) {
    console.error('[rag_service] Gemini error:', err.message);
    // Graceful fallback — return the top FAQ answer directly
    if (faqEntries.length > 0) {
      return faqEntries[0].answer;
    }
    return "I couldn't generate an answer at this time. Please try again later.";
  }
}
