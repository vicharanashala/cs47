'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { FAQEntry } from '@/types';
import Link from 'next/link';

export default function FAQPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => setDebouncedSearch(value), 300);
    setDebounceTimer(timer);
  };

  const { data: faqList, isLoading: listLoading } = useQuery({
    queryKey: ['faq-list'],
    queryFn: () => api.get('/faq').then((r) => r.data as { entries: FAQEntry[]; total: number }),
    enabled: !debouncedSearch,
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['faq-search', debouncedSearch],
    queryFn: () =>
      api.get('/faq/search', { params: { q: debouncedSearch } }).then((r) => r.data as { entries: FAQEntry[] }),
    enabled: !!debouncedSearch,
  });

  const entries = debouncedSearch ? searchResults?.entries : faqList?.entries;
  const isLoading = debouncedSearch ? searchLoading : listLoading;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">FAQ Knowledge Base</h1>
        <p className="text-slate-400">
          Verified answers from the community, curated into a self-improving knowledge base.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-8">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search the FAQ knowledge base…"
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-12 pr-4 py-3.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors text-sm"
        />
        {search && (
          <button
            onClick={() => { setSearch(''); setDebouncedSearch(''); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            ✕
          </button>
        )}
      </div>

      {/* Stats */}
      {!debouncedSearch && faqList && (
        <p className="text-sm text-slate-600 mb-6">{faqList.total} FAQ entries</p>
      )}
      {debouncedSearch && searchResults && (
        <p className="text-sm text-slate-600 mb-6">{searchResults.entries.length} results for "{debouncedSearch}"</p>
      )}

      {/* Results */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 bg-slate-900 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {entries && entries.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          {debouncedSearch ? `No FAQ entries match "${debouncedSearch}"` : 'No FAQ entries yet.'}
        </div>
      )}

      {entries && entries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entries.map((entry) => (
            <FAQCard key={entry._id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function FAQCard({ entry }: { entry: FAQEntry }) {
  return (
    <Link href={`/faq/${entry._id}`} className="block group">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-full hover:border-slate-700 hover:bg-slate-900/80 transition-all">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="font-medium text-slate-200 group-hover:text-brand-300 transition-colors line-clamp-2">
            {entry.question}
          </h3>
        </div>

        <p className="text-sm text-slate-500 line-clamp-3 mb-3">{entry.answer}</p>

        <div className="flex flex-wrap gap-1">
          {entry.tags.map((tag) => (
            <span key={tag} className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
