'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { FAQEntry } from '@/types';
import Link from 'next/link';

export default function FAQDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: entry, isLoading } = useQuery({
    queryKey: ['faq', id],
    queryFn: () => api.get(`/faq/${id}`).then((r) => r.data as FAQEntry),
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="h-64 bg-slate-900 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!entry) {
    return <div className="text-center py-20 text-slate-500">FAQ entry not found.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/faq" className="text-sm text-slate-500 hover:text-brand-400 transition-colors mb-6 inline-flex items-center gap-1">
        ← Back to FAQ
      </Link>

      <article className="bg-slate-900 border border-emerald-700/30 rounded-xl p-6 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
            ✓ Verified Answer
          </span>
          {entry.tags.map((tag) => (
            <span key={tag} className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
        </div>

        <h1 className="text-xl font-bold text-slate-100 mb-6">{entry.question}</h1>

        <div className="prose prose-invert prose-sm max-w-none">
          <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">{entry.answer}</div>
        </div>

        {entry.sourceEscalation && (
          <div className="mt-6 pt-6 border-t border-slate-800">
            <Link
              href={`/escalation/${entry.sourceEscalation}`}
              className="text-sm text-slate-500 hover:text-brand-400 transition-colors"
            >
              View original escalation →
            </Link>
          </div>
        )}
      </article>
    </div>
  );
}
