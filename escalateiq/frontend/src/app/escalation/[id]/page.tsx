'use client';

import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Escalation, Answer } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { useNotificationStore } from '@/store/notificationStore';
import Link from 'next/link';

export default function EscalationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user } = useAuth();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();
  const [answerBody, setAnswerBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: escalation, isLoading: escLoading } = useQuery({
    queryKey: ['escalation', id],
    queryFn: () => api.get(`/escalations/${id}`).then((r) => r.data as Escalation),
  });

  const { data: answersData, isLoading: answersLoading } = useQuery({
    queryKey: ['answers', id],
    queryFn: () =>
      api.get(`/escalations/${id}/answers`).then((r) => r.data as { answers: Answer[] }),
  });

  const handleSubmitAnswer = async () => {
    if (answerBody.length < 30) return;
    setSubmitting(true);
    try {
      await api.post(`/escalations/${id}/answers`, { body: answerBody });
      setAnswerBody('');
      queryClient.invalidateQueries({ queryKey: ['answers', id] });
      addToast('Answer submitted for review!', 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to submit answer';
      addToast(typeof msg === 'string' ? msg : 'Failed to submit answer', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (escLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="h-48 bg-slate-900 rounded-xl animate-pulse mb-4" />
      </div>
    );
  }

  if (!escalation) {
    return <div className="text-center py-20 text-slate-500">Escalation not found.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Escalation */}
      <article className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
              escalation.status === 'resolved'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
            }`}
          >
            {escalation.status}
          </span>
          {escalation.tags.map((tag) => (
            <span key={tag} className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
        </div>

        <h1 className="text-xl font-bold text-slate-100 mb-3">{escalation.title}</h1>
        <p className="text-slate-300 leading-relaxed mb-4">{escalation.body}</p>

        <div className="flex items-center gap-4 text-sm text-slate-600 border-t border-slate-800 pt-4">
          <span>
            <Link href={`/profile/${escalation.authorUsername}`} className="text-slate-400 hover:text-brand-400 transition-colors font-medium">
              {escalation.authorUsername}
            </Link>
          </span>
          <span>{escalation.upvoteCount} upvotes</span>
          <span>{escalation.viewCount} views</span>
        </div>
      </article>

      {/* Answers */}
      <h2 className="text-lg font-semibold text-slate-200 mb-4">
        {answersData?.answers.length ?? 0} Answer{answersData?.answers.length !== 1 ? 's' : ''}
      </h2>

      {answersLoading && (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-900 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      <div className="space-y-4 mb-8">
        {answersData?.answers.map((answer) => (
          <AnswerCard key={answer._id} answer={answer} escalationId={id} />
        ))}
      </div>

      {/* Answer form */}
      {isAuthenticated && escalation.status !== 'resolved' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="font-semibold text-slate-200 mb-4">Submit Your Answer</h3>
          <textarea
            value={answerBody}
            onChange={(e) => setAnswerBody(e.target.value)}
            placeholder="Write a detailed answer… (min 30 chars)"
            rows={5}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors resize-none mb-3"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">{answerBody.length} / 30 min</span>
            <button
              onClick={handleSubmitAnswer}
              disabled={answerBody.length < 30 || submitting}
              className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit Answer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AnswerCard({ answer, escalationId }: { answer: Answer; escalationId: string }) {
  const queryClient = useQueryClient();
  const [voted, setVoted] = useState(answer.hasUserVoted ?? false);
  const [votes, setVotes] = useState(answer.upvoteCount);

  const handleUpvote = async () => {
    if (voted) return;
    try {
      const { data } = await api.post(`/answers/${answer._id}/upvote`);
      setVoted(true);
      setVotes(data.upvoteCount);
    } catch {}
  };

  return (
    <div
      className={`bg-slate-900 border rounded-xl p-5 ${
        answer.status === 'verified'
          ? 'border-emerald-700/50 bg-emerald-950/10'
          : 'border-slate-800'
      }`}
    >
      {answer.status === 'verified' && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-emerald-400 text-sm font-medium flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Verified Answer
          </span>
        </div>
      )}

      <p className="text-slate-300 leading-relaxed mb-4">{answer.body}</p>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          by{' '}
          <Link href={`/profile/${answer.authorUsername}`} className="text-slate-400 hover:text-brand-400 transition-colors">
            {answer.authorUsername}
          </Link>
        </span>

        <button
          onClick={handleUpvote}
          disabled={voted}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs font-medium ${
            voted
              ? 'border-brand-500/40 text-brand-400 bg-brand-500/10'
              : 'border-slate-700 text-slate-500 hover:border-brand-500/40 hover:text-brand-400'
          }`}
        >
          ▲ {votes}
        </button>
      </div>
    </div>
  );
}
