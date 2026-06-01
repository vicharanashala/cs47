import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import * as answerService from '../services/answer.service.js';
import * as flagService from '../services/flag.service.js';
import User from '../models/User.js';
import Escalation from '../models/Escalation.js';
import Answer from '../models/Answer.js';
import Flag from '../models/Flag.js';

const router = Router();

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// GET /api/admin/queue  — unverified answers
router.get('/queue', async (req, res, next) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const [answers, total] = await Promise.all([
      Answer.find({ status: 'unverified' })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'username reputation')
        .populate('escalationId', 'title body tags')
        .lean(),
      Answer.countDocuments({ status: 'unverified' }),
    ]);
    res.json({ answers, total });
  } catch (err) { next(err); }
});

// POST /api/admin/answers/:id/verify
router.post('/answers/:id/verify', async (req, res, next) => {
  try {
    const answer = await answerService.verifyAnswer(req.user, req.params.id);
    res.json(answer);
  } catch (err) { next(err); }
});

// POST /api/admin/answers/:id/reject
router.post('/answers/:id/reject', async (req, res, next) => {
  try {
    const schema = z.object({ reason: z.string().min(5) });
    const { reason } = schema.parse(req.body);
    const answer = await answerService.rejectAnswer(req.user, req.params.id, reason);
    res.json(answer);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// GET /api/admin/flags  — pending flags
router.get('/flags', async (req, res, next) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const result = await flagService.getPendingFlags(skip, limit);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/admin/flags/:id/resolve
router.post('/flags/:id/resolve', async (req, res, next) => {
  try {
    const schema = z.object({ action: z.enum(['remove_content', 'dismiss']) });
    const { action } = schema.parse(req.body);
    const flag = await flagService.resolveFlag(req.user, req.params.id, action);
    res.json(flag);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// GET /api/admin/stats
router.get('/stats', async (req, res, next) => {
  try {
    const [openEscalations, unverifiedAnswers, pendingFlags, totalUsers] = await Promise.all([
      Escalation.countDocuments({ status: 'open' }),
      Answer.countDocuments({ status: 'unverified' }),
      Flag.countDocuments({ status: 'pending' }),
      User.countDocuments(),
    ]);
    res.json({ openEscalations, unverifiedAnswers, pendingFlags, totalUsers });
  } catch (err) { next(err); }
});

// POST /api/admin/users/:id/ban
router.post('/users/:id/ban', async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBanned: true, banExpiresAt: null },
      { new: true }
    ).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User banned', user });
  } catch (err) { next(err); }
});

// POST /api/admin/users/:id/unban
router.post('/users/:id/unban', async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBanned: false, banExpiresAt: null },
      { new: true }
    ).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User unbanned', user });
  } catch (err) { next(err); }
});

export default router;
