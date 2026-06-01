import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';
import * as answerService from '../services/answer.service.js';

const router = Router({ mergeParams: true });

const submitAnswerSchema = z.object({
  body: z.string().min(30),
});

// POST /api/escalations/:escalationId/answers
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const data = submitAnswerSchema.parse(req.body);
    const answer = await answerService.submitAnswer(req.user, req.params.escalationId, data);
    res.status(201).json(answer);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// GET /api/escalations/:escalationId/answers
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const answers = await answerService.listAnswers(req.params.escalationId, req.user?._id?.toString());
    res.json({ answers });
  } catch (err) { next(err); }
});

export default router;
