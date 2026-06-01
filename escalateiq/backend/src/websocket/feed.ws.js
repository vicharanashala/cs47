/**
 * WebSocket Feed Server
 * Real-time events for the public feed and per-user notifications.
 *
 * Feed clients: set of WebSocket connections listening to feed events
 * User clients: map of userId → WebSocket for targeted notifications
 */

import { WebSocketServer } from 'ws';
import { decodeToken } from '../utils/jwt.utils.js';
import User from '../models/User.js';

// Map<userId:string, WebSocket> for authenticated users (notifications)
export const userClients = new Map();

// Set<WebSocket> for anonymous feed subscribers
const feedClients = new Set();

/**
 * Initialise WebSocket server on an existing HTTP server.
 * @param {http.Server} httpServer
 */
export function initWebSocket(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/feed' });

  wss.on('connection', async (ws, req) => {
    // Optional auth: parse ?token=<jwt> from URL
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    let userId = null;
    if (token) {
      try {
        const payload = decodeToken(token);
        userId = payload.userId;
        userClients.set(userId, ws);
      } catch {
        // Token invalid — still allow as anonymous feed subscriber
      }
    }

    feedClients.add(ws);
    console.log(`[ws] Client connected (userId=${userId ?? 'anon'}). Total: ${feedClients.size}`);

    // Keepalive ping
    const pingInterval = setInterval(() => {
      if (ws.readyState === 1) ws.ping();
    }, 30000);

    ws.on('pong', () => {}); // absorb pong

    ws.on('close', () => {
      feedClients.delete(ws);
      if (userId) userClients.delete(userId);
      clearInterval(pingInterval);
      console.log(`[ws] Client disconnected. Total: ${feedClients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[ws] Error:', err.message);
      feedClients.delete(ws);
      if (userId) userClients.delete(userId);
    });
  });

  return wss;
}

/**
 * Broadcast an event to ALL connected feed clients.
 * @param {string} eventType
 * @param {object} payload
 */
export function broadcast(eventType, payload) {
  const message = JSON.stringify({ event: eventType, data: payload });
  const dead = [];

  for (const ws of feedClients) {
    if (ws.readyState === 1) {
      ws.send(message);
    } else {
      dead.push(ws);
    }
  }

  // Clean up dead connections
  dead.forEach((ws) => feedClients.delete(ws));
}
