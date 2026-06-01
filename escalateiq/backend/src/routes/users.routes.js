import { Router } from 'express';
import User from '../models/User.js';
import Escalation from '../models/Escalation.js';
import Answer from '../models/Answer.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import * as reputationService from '../services/reputation.service.js';
import * as notificationService from '../services/notification.service.js';

const router = Router();

// GET /api/users/me
router.get('/me', requireAuth, async (req, res) => {
  res.json(req.user);
});

// GET /api/users/me/notifications
router.get('/me/notifications', requireAuth, async (req, res, next) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const notifications = await notificationService.getNotifications(req.user._id.toString(), skip, limit);
    const unreadCount = await notificationService.getUnreadCount(req.user._id.toString());
    res.json({ notifications, unreadCount });
  } catch (err) { next(err); }
});

// POST /api/users/me/notifications/read-all
router.post('/me/notifications/read-all', requireAuth, async (req, res, next) => {
  try {
    await notificationService.markAllRead(req.user._id.toString());
    res.json({ message: 'All notifications marked as read' });
  } catch (err) { next(err); }
});

// GET /api/users/:username
router.get('/:username', async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('username role reputation createdAt')
      .lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
});

// GET /api/users/:username/reputation
router.get('/:username/reputation', async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username }).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const history = await reputationService.getReputationHistory(user._id.toString(), skip, limit);
    res.json({ reputation: user.reputation, history });
  } catch (err) { next(err); }
});

// GET /api/users/:username/escalations
router.get('/:username/escalations', async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username }).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const escalations = await Escalation.find({ userId: user._id, status: { $ne: 'removed' } })
      .sort({ createdAt: -1 })
      .select('-embedding -__v')
      .lean();

    res.json({ escalations });
  } catch (err) { next(err); }
});

// GET /api/users/:username/answers
router.get('/:username/answers', async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username }).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const answers = await Answer.find({ userId: user._id })
      .populate('escalationId', 'title')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ answers });
  } catch (err) { next(err); }
});

export default router;
