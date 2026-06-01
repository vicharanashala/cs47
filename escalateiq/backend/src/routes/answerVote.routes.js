import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as answerService from '../services/answer.service.js';

const router = Router();

// POST /api/answers/:id/upvote
router.post('/:id/upvote', requireAuth, async (req, res, next) => {
  try {
    const result = await answerService.upvoteAnswer(req.user, req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
