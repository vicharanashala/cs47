'use client';

import { Escalation } from '@/types';
import Link from 'next/link';
import { useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

interface EscalationCardProps {
  escalation: Escalation;
}

const statusColors = {
  open: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  answered: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  resolved: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  removed: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export function EscalationCard({ escalation }: EscalationCardProps) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [voted, setVoted] = useState(escalation.hasUserVoted ?? false);
  const [votes, setVotes] = useState(escalation.upvoteCount);
  const [voting, setVoting] = useState(false);

  const handleUpvote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated || voted || voting) return;

    setVoting(true);
    try {
      const { data } = await api.post(`/escalations/${escalation._id}/upvote`);
      setVoted(true);
      setVotes(data.upvoteCount);
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
    } catch {
      // If already voted, still mark as voted
      setVoted(true);
    } finally {
      setVoting(false);
    }
  };

  const timeAgo = (dateStr: string) => {
    const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  };

  return (
    <Link href={`/escalation/${escalation._id}`} className="block group">
      <article className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 hover:bg-slate-900/80 transition-all duration-200 hover:shadow-lg hover:shadow-black/20">
        <div className="flex items-start gap-4">
          {/* Upvote button */}
          <button
            onClick={handleUpvote}
            disabled={!isAuthenticated || voted || voting}
            className={`flex flex-col items-center gap-1 px-2.5 py-2 rounded-lg border transition-all min-w-[3rem] ${
              voted
                ? 'bg-brand-500/20 border-brand-500/40 text-brand-400'
                : 'border-slate-700 text-slate-500 hover:border-brand-500/50 hover:text-brand-400 hover:bg-brand-500/10'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <svg className="w-4 h-4" fill={voted ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
            <span className="text-xs font-bold">{votes}</span>
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColors[escalation.status]}`}>
                {escalation.status}
              </span>
              {escalation.tags.map((tag) => (
                <span key={tag} className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>

            <h3 className="font-semibold text-slate-100 group-hover:text-brand-300 transition-colors line-clamp-2 mb-2">
              {escalation.title}
            </h3>

            <p className="text-sm text-slate-400 line-clamp-2 mb-3">{escalation.body}</p>

            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span>
                by{' '}
                <span className="text-slate-400 font-medium hover:text-brand-400 transition-colors">
                  {escalation.authorUsername}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
                {escalation.viewCount} views
              </span>
              <span>{timeAgo(escalation.createdAt)}</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
