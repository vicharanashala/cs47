'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Answer } from '@/types';
import { useState } from 'react';
import { useNotificationStore } from '@/store/notificationStore';

interface AdminAnswer extends Omit<Answer, 'escalationId'> {
  escalationId: {
    _id: string;
    title: string;
    body: string;
    tags: string[];
  } | string;
}

export default function AdminQueuePage() {
  const queryClient = useQueryClient();
  const { addToast } = useNotificationStore();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-queue'],
    queryFn: () =>
      api.get('/admin/queue').then((r) => r.data as { answers: AdminAnswer[]; total: number }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-100">
          Verification Queue
          {data && (
            <span className="ml-2 text-sm text-amber-400 font-normal">({data.total} pending)</span>
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

      {data?.answers.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <div className="text-4xl mb-3">✓</div>
          <p>No answers pending verification. Great work!</p>
        </div>
      )}

      <div className="space-y-4">
        {data?.answers.map((answer) => (
          <VerificationCard
            key={answer._id}
            answer={answer}
            onAction={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-queue'] });
              queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
            }}
            addToast={addToast}
          />
        ))}
      </div>
    </div>
  );
}

function VerificationCard({
  answer,
  onAction,
  addToast,
}: {
  answer: AdminAnswer;
  onAction: () => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState<'verify' | 'reject' | null>(null);

  const escalation = typeof answer.escalationId === 'object' ? answer.escalationId : null;

  const handleVerify = async () => {
    setLoading('verify');
    try {
      await api.post(`/admin/answers/${answer._id}/verify`);
      addToast('Answer verified and added to FAQ!', 'success');
      onAction();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to verify';
      addToast(typeof msg === 'string' ? msg : 'Failed to verify', 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim() || rejectReason.length < 5) return;
    setLoading('reject');
    try {
      await api.post(`/admin/answers/${answer._id}/reject`, { reason: rejectReason });
      addToast('Answer rejected.', 'info');
      onAction();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to reject';
      addToast(typeof msg === 'string' ? msg : 'Failed to reject', 'error');
    } finally {
      setLoading(null);
      setRejecting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Escalation context */}
      {escalation && (
        <div className="bg-slate-800/50 px-5 py-3 border-b border-slate-800">
          <p className="text-xs text-slate-500 mb-1">Escalation:</p>
          <p className="text-sm text-slate-300 font-medium">{escalation.title}</p>
        </div>
      )}

      {/* Answer */}
      <div className="p-5">
        <p className="text-sm text-slate-500 mb-2">
          Answer by{' '}
          <span className="text-slate-300 font-medium">
            {(answer.userId as unknown as { username: string })?.username}
          </span>
          <span className="ml-2 text-slate-600">
            ({(answer.userId as unknown as { reputation: number })?.reputation} pts)
          </span>
        </p>

        <p className="text-slate-200 leading-relaxed mb-5">{answer.body}</p>

        {/* Actions */}
        {!rejecting ? (
          <div className="flex gap-3">
            <button
              onClick={handleVerify}
              disabled={!!loading}
              className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-700/50 text-emerald-300 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading === 'verify' ? 'Verifying…' : '✓ Verify & Add to FAQ'}
            </button>
            <button
              onClick={() => setRejecting(true)}
              disabled={!!loading}
              className="flex-1 bg-red-600/10 hover:bg-red-600/20 border border-red-700/30 text-red-400 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              ✕ Reject
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (min 5 chars)…"
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={rejectReason.length < 5 || !!loading}
                className="flex-1 bg-red-600/20 border border-red-700/40 text-red-300 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {loading === 'reject' ? 'Rejecting…' : 'Confirm Reject'}
              </button>
              <button
                onClick={() => { setRejecting(false); setRejectReason(''); }}
                className="px-4 text-slate-500 hover:text-slate-300 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
