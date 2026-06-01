/**
 * EscalateIQ — Express Application
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import escalationsRoutes from './routes/escalations.routes.js';
import answersRoutes from './routes/answers.routes.js';
import answerVoteRoutes from './routes/answerVote.routes.js';
import faqRoutes from './routes/faq.routes.js';
import flagsRoutes from './routes/flags.routes.js';
import adminRoutes from './routes/admin.routes.js';
import leaderboardRoutes from './routes/leaderboard.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import config from './config/index.js';

const app = express();

// ── Security & parsing ──────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: config.isDev() ? ['http://localhost:3000', 'http://localhost:5173'] : process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (config.isDev()) {
  app.use(morgan('dev'));
}

// ── Health check ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// ── Routes ──────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/escalations', escalationsRoutes);
app.use('/api/escalations/:escalationId/answers', answersRoutes);
app.use('/api/answers', answerVoteRoutes);
app.use('/api/faq', faqRoutes);
app.use('/api/flags', flagsRoutes);
app.use('/api/admin', adminRoutes);

// ── Error handlers (must be last) ──────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
