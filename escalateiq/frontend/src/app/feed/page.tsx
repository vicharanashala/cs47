'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Escalation } from '@/types';
import { EscalationCard } from '@/components/escalation/EscalationCard';
import { RaiseEscalationModal } from '@/components/escalation/RaiseEscalationModal';
import { useAuth } from '@/hooks/useAuth';

type SortBy = 'newest' | 'most_upvoted' | 'unanswered';

export default function FeedPage() {
  const { isAuthenticated } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [tag, setTag] = useState('');
  const [tagInput, setTagInput] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['escalations', sortBy, tag],
    queryFn: () =>
      api
        .get('/escalations', { params: { sort_by: sortBy, ...(tag ? { tag } : {}) } })
        .then((r) => r.data as { escalations: Escalation[]; total: number }),
  });

  const sortOptions: { value: SortBy; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'most_upvoted', label: 'Most Upvoted' },
    { value: 'unanswered', label: 'Unanswered' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Hero section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">
          Escalation Feed
        </h1>
        <p className="text-slate-400">
          Community questions, semantically matched to our knowledge base.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Sort buttons */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 gap-1">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                sortBy === opt.value
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Tag filter */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTag(tagInput.trim());
          }}
          className="flex gap-2"
        >
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Filter by tag..."
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-brand-500 w-36"
          />
          {tag && (
            <button
              type="button"
              onClick={() => { setTag(''); setTagInput(''); }}
              className="text-slate-500 hover:text-slate-300 text-sm px-2"
            >
              ✕ {tag}
            </button>
          )}
        </form>

        {/* Stats */}
        {data && (
          <span className="ml-auto text-sm text-slate-600">
            {data.total} escalation{data.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Feed */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-36 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-16 text-slate-500">
          Failed to load feed. Is the backend running?
        </div>
      )}

      {data && (
        <div className="space-y-3">
          {data.escalations.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <p className="text-lg mb-2">No escalations yet</p>
              <p className="text-sm">Be the first to raise one!</p>
            </div>
          ) : (
            data.escalations.map((esc) => <EscalationCard key={esc._id} escalation={esc} />)
          )}
        </div>
      )}

      {/* Floating action button */}
      {isAuthenticated && (
        <button
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-8 right-8 w-14 h-14 bg-brand-600 hover:bg-brand-500 text-white rounded-full shadow-2xl shadow-brand-500/30 flex items-center justify-center transition-all hover:scale-110 glow"
          title="Raise an escalation"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      )}

      <RaiseEscalationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
