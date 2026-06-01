/**
 * EscalateIQ — Server Entry Point
 * Connects to MongoDB, starts HTTP server, initialises WebSocket + Bull workers.
 */

import http from 'http';
import mongoose from 'mongoose';
import app from './src/app.js';
import config from './src/config/index.js';
import { initWebSocket, userClients } from './src/websocket/feed.ws.js';
import { setWsClients } from './src/services/notification.service.js';

// ── Import workers so Bull processes run in-process ─────────────────
import './src/jobs/embedding.worker.js';

async function start() {
  // Connect to MongoDB
  console.log('[server] Connecting to MongoDB...');
  await mongoose.connect(config.mongodbUri);
  console.log('[server] MongoDB connected');

  // Create HTTP server from Express app
  const httpServer = http.createServer(app);

  // Initialise WebSocket
  initWebSocket(httpServer);
  setWsClients(userClients); // inject ws client map into notification service

  // Start listening
  httpServer.listen(config.port, () => {
    console.log(`[server] EscalateIQ API running on http://localhost:${config.port}`);
    console.log(`[server] WebSocket feed at ws://localhost:${config.port}/ws/feed`);
    console.log(`[server] Environment: ${config.env}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[server] SIGTERM received — shutting down...');
    httpServer.close();
    await mongoose.disconnect();
    process.exit(0);
  });
}

start().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
