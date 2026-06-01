import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as flagService from '../services/flag.service.js';

const router = Router();

const flagSchema = z.object({
  targetId: z.string().min(1),
  targetType: z.enum(['escalation', 'answer']),
  reason: z.enum(['spam', 'abuse', 'duplicate', 'off_topic', 'pii']),
});

// POST /api/flags  — requires auth + 50 pts (checked in service)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const data = flagSchema.parse(req.body);
    const flag = await flagService.submitFlag(req.user, data);
    res.status(201).json(flag);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

export default router;
