import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';
import * as escalationService from '../services/escalation.service.js';

const router = Router();

const createEscalationSchema = z.object({
  title: z.string().min(5).max(300),
  body: z.string().min(20),
  tags: z.array(z.string()).max(5).optional().default([]),
});

// POST /api/escalations  — core check_and_raise flow
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const data = createEscalationSchema.parse(req.body);
    const result = await escalationService.checkAndRaise(req.user, data);
    const statusCode = result.action === 'created' ? 201 : 200;
    res.status(statusCode).json(result);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// POST /api/escalations/force  — bypass semantic checks (after FAQ match)
router.post('/force', requireAuth, async (req, res, next) => {
  try {
    const data = createEscalationSchema.parse(req.body);
    const result = await escalationService.forceRaise(req.user, data);
    res.status(201).json(result);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// GET /api/escalations  — public feed
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const sortBy = req.query.sort_by || 'newest';
    const tag = req.query.tag || null;
    const currentUserId = req.user?._id?.toString() || null;
    const result = await escalationService.listEscalations({ skip, limit, sortBy, tag }, currentUserId);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/escalations/:id  — single escalation
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const escalation = await escalationService.getEscalation(req.params.id, req.user?._id?.toString());
    res.json(escalation);
  } catch (err) { next(err); }
});

// POST /api/escalations/:id/upvote
router.post('/:id/upvote', requireAuth, async (req, res, next) => {
  try {
    const result = await escalationService.upvoteEscalation(req.user, req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
