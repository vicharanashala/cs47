/**
 * Zustand notification store — toast queue + unread count
 */

import { create } from 'zustand';
import { Notification } from '@/types';

export type Toast = {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
};

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  toasts: Toast[];
  setNotifications: (notifications: Notification[], unreadCount: number) => void;
  addNotification: (notification: Notification) => void;
  decrementUnread: (by?: number) => void;
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  toasts: [],
  setNotifications: (notifications, unreadCount) => set({ notifications, unreadCount }),
  addNotification: (notification) =>
    set((s) => ({
      notifications: [notification, ...s.notifications],
      unreadCount: s.unreadCount + (notification.isRead ? 0 : 1),
    })),
  decrementUnread: (by = 1) =>
    set((s) => ({ unreadCount: Math.max(0, s.unreadCount - by) })),
  addToast: (message, type = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    // Auto-remove after 4s
    setTimeout(() => get().removeToast(id), 4000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
