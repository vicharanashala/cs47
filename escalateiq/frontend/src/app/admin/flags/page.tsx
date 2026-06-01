'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Flag } from '@/types';
import { useState } from 'react';
import { useNotificationStore } from '@/store/notificationStore';
import Link from 'next/link';

interface PopulatedFlag extends Omit<Flag, 'reporterId'> {
  reporterId: {
    _id: string;
    username: string;
    reputation: number;
  } | null;
  target: {
    title?: string;
    body: string;
    userId: {
      _id: string;
      username: string;
    };
    escalationId?: {
      _id: string;
      title: string;
    };
  } | null;
}

export default function AdminFlagsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useNotificationStore();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-flags'],
    queryFn: () =>
      api.get('/admin/flags').then((r) => r.data as { flags: PopulatedFlag[]; total: number }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-100">
          Flagged Content
          {data && (
            <span className="ml-2 text-sm text-red-400 font-normal">({data.total} pending)</span>
          )}
        </h2>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-slate-900 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {data?.flags.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <div className="text-4xl mb-3">✓</div>
          <p>No content flags pending review. Excellent job!</p>
        </div>
      )}

      <div className="space-y-4">
        {data?.flags.map((flag) => (
          <FlagReviewCard
            key={flag._id}
            flag={flag}
            onAction={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-flags'] });
              queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
            }}
            addToast={addToast}
          />
        ))}
      </div>
    </div>
  );
}

function FlagReviewCard({
  flag,
  onAction,
  addToast,
}: {
  flag: PopulatedFlag;
  onAction: () => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}) {
  const [loading, setLoading] = useState<'remove_content' | 'dismiss' | null>(null);

  const handleResolve = async (action: 'remove_content' | 'dismiss') => {
    setLoading(action);
    try {
      await api.post(`/admin/flags/${flag._id}/resolve`, { action });
      addToast(
        action === 'remove_content'
          ? 'Content has been successfully removed.'
          : 'Flag dismissed. Content retained.',
        'success'
      );
      onAction();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to resolve flag';
      addToast(typeof msg === 'string' ? msg : 'Failed to resolve flag', 'error');
    } finally {
      setLoading(null);
    }
  };

  const badgeColors: Record<string, string> = {
    spam: 'bg-red-500/10 text-red-400 border-red-500/20',
    abuse: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    duplicate: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    off_topic: 'bg-slate-800 text-slate-400 border-slate-700',
    pii: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    auto_safety: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header Flag Meta */}
      <div className="bg-slate-800/40 px-5 py-3 border-b border-slate-850 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded border ${badgeColors[flag.reason]}`}>
            {flag.reason}
          </span>
          <span className="text-xs text-slate-500">
            on {flag.targetType}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          Reported by:{' '}
          <strong className="text-slate-400 font-semibold">
            {flag.reporterId?.username ?? 'System (Auto Safety)'}
          </strong>
        </span>
      </div>

      {/* Flagged Item Details */}
      <div className="p-5">
        <div className="mb-4">
          {flag.target ? (
            <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-4 mb-4">
              <p className="text-xs text-slate-600 mb-2">
                Author:{' '}
                <strong className="text-slate-500 font-bold">
                  {flag.target.userId?.username ?? 'Unknown'}
                </strong>
              </p>

              {/* Title if it's an escalation */}
              {flag.targetType === 'escalation' && flag.target.title && (
                <h4 className="text-sm font-semibold text-slate-200 mb-2">
                  {flag.target.title}
                </h4>
              )}

              {/* Context if it's an answer */}
              {flag.targetType === 'answer' && flag.target.escalationId && (
                <p className="text-xs text-slate-500 mb-2">
                  Escalation Context:{' '}
                  <Link
                    href={`/escalation/${flag.target.escalationId._id}`}
                    className="text-brand-400 hover:underline font-semibold"
                  >
                    {flag.target.escalationId.title}
                  </Link>
                </p>
              )}

              {/* Body */}
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {flag.target.body}
              </p>
            </div>
          ) : (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-lg mb-4">
              Target content not found or already deleted.
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex gap-3">
          <button
            onClick={() => handleResolve('dismiss')}
            disabled={!!loading}
            className="flex-1 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading === 'dismiss' ? 'Resolving…' : '✓ Keep Content (Dismiss)'}
          </button>
          <button
            onClick={() => handleResolve('remove_content')}
            disabled={!!loading}
            className="flex-1 bg-red-600/15 hover:bg-red-600/25 border border-red-700/40 text-red-400 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading === 'remove_content' ? 'Removing…' : '✕ Remove Content & Penalize'}
          </button>
        </div>
      </div>
    </div>
  );
}
