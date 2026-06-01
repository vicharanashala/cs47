'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { EscalationCheckResponse, FAQEntry } from '@/types';
import { useQueryClient } from '@tanstack/react-query';
import { useNotificationStore } from '@/store/notificationStore';
import Link from 'next/link';

interface RaiseEscalationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalState = 'form' | 'checking' | 'faq_match' | 'feed_match' | 'success';

export function RaiseEscalationModal({ isOpen, onClose }: RaiseEscalationModalProps) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useNotificationStore();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [state, setState] = useState<ModalState>('form');
  const [result, setResult] = useState<EscalationCheckResponse | null>(null);
  const [error, setError] = useState('');

  const reset = () => {
    setTitle('');
    setBody('');
    setTags('');
    setState('form');
    setResult(null);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (force = false) => {
    setError('');
    setState('checking');
    try {
      const endpoint = force ? '/escalations/force' : '/escalations';
      const { data } = await api.post<EscalationCheckResponse>(endpoint, {
        title: title.trim(),
        body: body.trim(),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5),
      });
      setResult(data);
      if (data.action === 'faq_match') {
        setState('faq_match');
      } else if (data.action === 'feed_match') {
        setState('feed_match');
      } else {
        setState('success');
        queryClient.invalidateQueries({ queryKey: ['escalations'] });
        addToast('Your escalation has been posted!', 'success');
        setTimeout(handleClose, 1500);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to submit';
      setError(typeof msg === 'string' ? msg : 'Failed to submit');
      setState('form');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl glass rounded-2xl shadow-2xl animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-100">Raise an Escalation</h2>
          <button onClick={handleClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Checking state */}
          {state === 'checking' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-12 h-12 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400">Checking FAQ and feed for similar questions…</p>
            </div>
          )}

          {/* Success state */}
          {state === 'success' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 text-2xl">✓</div>
              <p className="text-slate-200 font-medium">Escalation posted successfully!</p>
            </div>
          )}

          {/* FAQ Match */}
          {state === 'faq_match' && result?.action === 'faq_match' && (
            <div className="space-y-4">
              <div className="bg-brand-500/10 border border-brand-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-brand-400 text-lg">✦</span>
                  <h3 className="text-brand-300 font-medium">We found an answer in our FAQ!</h3>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-4 text-sm text-slate-300 leading-relaxed">
                  {(result.payload as { generatedAnswer: string }).generatedAnswer}
                </div>
                {(result.payload as { faqEntries: FAQEntry[] }).faqEntries?.length > 0 && (
                  <div className="mt-3 text-xs text-slate-500">
                    Sources: {(result.payload as { faqEntries: FAQEntry[] }).faqEntries.map((e) => (
                      <Link key={e._id} href={`/faq/${e._id}`} className="text-brand-400 hover:underline mr-2">
                        {e.question.slice(0, 40)}...
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleSubmit(true)}
                className="w-full text-sm text-slate-500 hover:text-slate-300 py-2 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
              >
                This didn't answer my question — post it anyway
              </button>
            </div>
          )}

          {/* Feed Match */}
          {state === 'feed_match' && result?.action === 'feed_match' && (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-amber-400 text-lg">⇡</span>
                  <h3 className="text-amber-300 font-medium">A similar escalation is already open!</h3>
                </div>
                <p className="text-sm text-slate-400 mb-3">We've registered your upvote on it.</p>
                <Link
                  href={`/escalation/${(result.payload as { _id: string })._id}`}
                  className="text-sm text-brand-400 hover:underline"
                  onClick={handleClose}
                >
                  {(result.payload as { title: string }).title}
                </Link>
              </div>
              <button
                onClick={() => handleSubmit(true)}
                className="w-full text-sm text-slate-500 hover:text-slate-300 py-2 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
              >
                Post as a separate escalation anyway
              </button>
            </div>
          )}

          {/* Form */}
          {state === 'form' && (
            <div className="space-y-4">
              {error && (
                <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What's your question? (5–300 chars)"
                  maxLength={300}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Details <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Describe your issue in detail… (min 20 chars)"
                  rows={4}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Tags <span className="text-slate-600 font-normal">(comma-separated, max 5)</span>
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="billing, account, api..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <button
                onClick={() => handleSubmit(false)}
                disabled={title.length < 5 || body.length < 20}
                className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                Submit Escalation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
