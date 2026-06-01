import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import * as faqService from '../services/faq.service.js';

const router = Router();

const createFAQSchema = z.object({
  question: z.string().min(10),
  answer: z.string().min(20),
  tags: z.array(z.string()).max(5).optional().default([]),
});

const updateFAQSchema = z.object({
  question: z.string().min(10).optional(),
  answer: z.string().min(20).optional(),
  tags: z.array(z.string()).max(5).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

// GET /api/faq  — public list
router.get('/', async (req, res, next) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const result = await faqService.getFAQList(skip, limit);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/faq/search?q=...  — full-text search
router.get('/search', async (req, res, next) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'q parameter required' });
    const entries = await faqService.searchFAQText(q);
    res.json({ entries });
  } catch (err) { next(err); }
});

// GET /api/faq/:id  — single entry
router.get('/:id', async (req, res, next) => {
  try {
    const entry = await faqService.getFAQById(req.params.id);
    res.json(entry);
  } catch (err) { next(err); }
});

// POST /api/faq  — admin only
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = createFAQSchema.parse(req.body);
    const entry = await faqService.createFAQEntry(data, req.user._id.toString());
    res.status(201).json(entry);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// PATCH /api/faq/:id  — admin only
router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const data = updateFAQSchema.parse(req.body);
    const entry = await faqService.updateFAQEntry(req.params.id, data);
    res.json(entry);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// DELETE /api/faq/:id  — admin only (soft delete)
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await faqService.deleteFAQEntry(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
