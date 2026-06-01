/**
 * Notification Service
 * Stores in-app notifications in MongoDB and pushes them live via WebSocket.
 */

import Notification from '../models/Notification.js';

// Reference to WebSocket client map — injected at startup
// Map<userId:string, WebSocket>
let _wsClients = null;

/**
 * Inject the WebSocket client map from websocket/feed.ws.js.
 * Called once at server startup.
 * @param {Map<string, WebSocket>} wsClients
 */
export function setWsClients(wsClients) {
  _wsClients = wsClients;
}

/**
 * Create a notification and push it to the user if they are online.
 * @param {string} userId
 * @param {string} type - notification type
 * @param {object} payload - arbitrary JSON payload
 */
export async function notifyUser(userId, type, payload = {}) {
  const notification = await Notification.create({ userId, type, payload });

  // Push via WebSocket if user is connected
  if (_wsClients) {
    const ws = _wsClients.get(userId.toString());
    if (ws && ws.readyState === 1 /* WebSocket.OPEN */) {
      ws.send(
        JSON.stringify({
          event: 'notification',
          data: {
            id: notification._id,
            type,
            payload,
            createdAt: notification.createdAt,
          },
        })
      );
    }
  }

  return notification;
}

/**
 * Get notifications for a user (paginated).
 * @param {string} userId
 * @param {number} skip
 * @param {number} limit
 */
export async function getNotifications(userId, skip = 0, limit = 20) {
  return Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
}

/**
 * Mark a specific notification as read.
 * @param {string} userId
 * @param {string} notificationId
 */
export async function markRead(userId, notificationId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true },
    { new: true }
  );
}

/**
 * Mark all notifications as read for a user.
 * @param {string} userId
 */
export async function markAllRead(userId) {
  return Notification.updateMany({ userId, isRead: false }, { isRead: true });
}

/**
 * Get unread count for a user.
 * @param {string} userId
 */
export async function getUnreadCount(userId) {
  return Notification.countDocuments({ userId, isRead: false });
}
