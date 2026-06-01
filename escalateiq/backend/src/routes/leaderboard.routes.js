import { Router } from 'express';
import * as reputationService from '../services/reputation.service.js';

const router = Router();

// GET /api/leaderboard
router.get('/', async (req, res, next) => {
  try {
    const period = req.query.period === 'weekly' ? 'weekly' : 'all_time';
    const leaderboard = await reputationService.getLeaderboard(period);
    res.json({ leaderboard, period });
  } catch (err) {
    next(err);
  }
});

export default router;
