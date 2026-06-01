'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { Escalation, Notification } from '@/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const queryClient = useQueryClient();
  const { accessToken } = useAuthStore();
  const { addNotification, addToast } = useNotificationStore();

  const connect = useCallback(() => {
    const url = accessToken ? `${WS_URL}/ws/feed?token=${accessToken}` : `${WS_URL}/ws/feed`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[ws] Connected');
      retryCount.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const { event: eventType, data } = JSON.parse(event.data);

        switch (eventType) {
          case 'new_escalation':
            // Prepend to feed cache
            queryClient.setQueryData<{ escalations: Escalation[]; total: number }>(
              ['escalations'],
              (old) =>
                old
                  ? { escalations: [data, ...old.escalations], total: old.total + 1 }
                  : { escalations: [data], total: 1 }
            );
            break;

          case 'escalation_answered':
            queryClient.invalidateQueries({ queryKey: ['escalation', data.escalationId] });
            break;

          case 'notification':
            addNotification(data as Notification);
            addToast(getNotificationMessage(data), 'info');
            break;
        }
      } catch (err) {
        console.error('[ws] Parse error:', err);
      }
    };

    ws.onclose = () => {
      // Exponential backoff reconnect
      const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
      retryCount.current++;
      retryRef.current = setTimeout(connect, delay);
    };

    ws.onerror = (err) => {
      // Browser ws.onerror event contains no sensitive details for security reasons,
      // and logging console.error triggers unwanted Next.js HMR overlay popups.
      console.warn('[ws] Connection encountered an issue or was interrupted:', err);
    };
  }, [accessToken, queryClient, addNotification, addToast]);

  useEffect(() => {
    connect();
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef.current;
}

function getNotificationMessage(data: { type: string; payload: Record<string, unknown> }): string {
  switch (data.type) {
    case 'answer_received': return 'Your escalation received a new answer!';
    case 'answer_verified': return 'Your answer was verified and added to the FAQ!';
    case 'answer_rejected': return 'Your answer was rejected.';
    case 'auto_upvote': return 'Your escalation was auto-upvoted!';
    case 'faq_promotion': return 'Your escalation was promoted to FAQ!';
    default: return 'New notification';
  }
}
