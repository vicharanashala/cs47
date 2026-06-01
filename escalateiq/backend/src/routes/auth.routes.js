import { Router } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const user = await authService.registerUser(data);
    res.status(201).json({
      message: 'Registration successful',
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const { accessToken, refreshToken, user } = await authService.loginUser(data);
    res.json({ accessToken, refreshToken, user: { id: user._id, username: user.username, email: user.email, role: user.role, reputation: user.reputation } });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });
    const tokens = await authService.refreshAccessToken(refreshToken);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await authService.logout(refreshToken);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
