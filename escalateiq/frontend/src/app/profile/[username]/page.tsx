'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { User, Escalation, Answer, ReputationEvent } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import Link from 'next/link';

type TabType = 'escalations' | 'answers' | 'reputation';

interface PopulatedAnswer extends Omit<Answer, 'escalationId'> {
  escalationId: {
    _id: string;
    title: string;
  };
}

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser, isAuthenticated } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('escalations');

  // Determine target username: if "me", use logged-in user's username
  const isOwnProfile = username === 'me' || (currentUser && currentUser.username === username);
  const targetUsername = username === 'me' ? currentUser?.username : username;

  useEffect(() => {
    if (username === 'me' && !isAuthenticated) {
      router.replace('/login');
    }
  }, [username, isAuthenticated, router]);

  // Fetch basic user profile info
  const { data: profileUser, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['user-profile', targetUsername],
    queryFn: () =>
      api.get(`/users/${targetUsername}`).then((r) => r.data as User),
    enabled: !!targetUsername,
  });

  // Fetch user's escalations
  const { data: escalationsData, isLoading: escalationsLoading } = useQuery({
    queryKey: ['user-escalations', targetUsername],
    queryFn: () =>
      api.get(`/users/${targetUsername}/escalations`).then((r) => r.data as { escalations: Escalation[] }),
    enabled: !!targetUsername && activeTab === 'escalations',
  });

  // Fetch user's answers
  const { data: answersData, isLoading: answersLoading } = useQuery({
    queryKey: ['user-answers', targetUsername],
    queryFn: () =>
      api.get(`/users/${targetUsername}/answers`).then((r) => r.data as { answers: PopulatedAnswer[] }),
    enabled: !!targetUsername && activeTab === 'answers',
  });

  // Fetch user's reputation history
  const { data: reputationData, isLoading: reputationLoading } = useQuery({
    queryKey: ['user-reputation', targetUsername],
    queryFn: () =>
      api.get(`/users/${targetUsername}/reputation`).then((r) => r.data as { reputation: number; history: ReputationEvent[] }),
    enabled: !!targetUsername && activeTab === 'reputation',
  });

  if (username === 'me' && !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <div className="h-44 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
        <div className="h-12 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (profileError || !profileUser) {
    return (
      <div className="text-center py-20 text-slate-500">
        <div className="text-4xl mb-2">✕</div>
        <p>User "{targetUsername}" not found.</p>
        <Link href="/feed" className="text-brand-400 hover:underline mt-4 inline-block text-sm">
          Return to feed
        </Link>
      </div>
    );
  }

  const formattedDate = new Date(profileUser.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const tabOptions: { id: TabType; label: string }[] = [
    { id: 'escalations', label: 'Escalations' },
    { id: 'answers', label: 'Answers' },
    { id: 'reputation', label: 'Reputation Events' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Profile Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 mb-8 relative overflow-hidden">
        {/* Background glow decorator */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-xl shadow-brand-500/20">
              {profileUser.username[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-slate-100">{profileUser.username}</h1>
                {profileUser.role === 'admin' && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Admin
                  </span>
                )}
                {isOwnProfile && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
                    You
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">Member since {formattedDate}</p>
            </div>
          </div>

          <div className="flex gap-4 border-t border-slate-800 md:border-t-0 pt-4 md:pt-0">
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl px-5 py-3 text-center min-w-[7rem]">
              <div className="text-2xl font-black text-brand-400">{profileUser.reputation}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Reputation</div>
            </div>
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl px-5 py-3 text-center min-w-[7rem]">
              <div className="text-2xl font-black text-slate-300">
                {profileUser.role === 'admin' ? 'Staff' : 'Contributor'}
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Rank</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-850 gap-4 mb-6">
        {tabOptions.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-semibold tracking-wide transition-all border-b-2 px-1 relative ${
              activeTab === tab.id
                ? 'border-brand-500 text-brand-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="space-y-4">
        {/* ESCALATIONS TAB */}
        {activeTab === 'escalations' && (
          <>
            {escalationsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-32 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : !escalationsData?.escalations.length ? (
              <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-500 text-sm">
                No escalations raised by this user.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {escalationsData.escalations.map((esc) => (
                  <Link key={esc._id} href={`/escalation/${esc._id}`}>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span
                            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                              esc.status === 'resolved'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                                : esc.status === 'answered'
                                ? 'bg-sky-500/20 text-sky-400 border-sky-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {esc.status}
                          </span>
                          {esc.tags.map((tag) => (
                            <span key={tag} className="text-[10px] bg-slate-800 text-slate-500 px-2 py-0.5 rounded">
                              #{tag}
                            </span>
                          ))}
                        </div>
                        <h3 className="font-semibold text-slate-200 mb-1 line-clamp-1 group-hover:text-brand-300">
                          {esc.title}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-1">{esc.body}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-slate-400 block">▲ {esc.upvoteCount}</span>
                        <span className="text-[10px] text-slate-600 block mt-0.5">upvotes</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* ANSWERS TAB */}
        {activeTab === 'answers' && (
          <>
            {answersLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-32 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : !answersData?.answers.length ? (
              <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-500 text-sm">
                No answers submitted by this user.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {answersData.answers.map((ans) => {
                  const escalationTitle = ans.escalationId?.title || 'Unknown Escalation';
                  return (
                    <div
                      key={ans._id}
                      className={`bg-slate-900 border rounded-xl p-5 ${
                        ans.status === 'verified'
                          ? 'border-emerald-700/30 bg-emerald-950/5'
                          : ans.status === 'rejected'
                          ? 'border-red-950/40 bg-red-950/5'
                          : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <span className="text-xs text-slate-500 font-medium">
                          Answered:{' '}
                          <Link
                            href={`/escalation/${typeof ans.escalationId === 'object' ? ans.escalationId._id : ans.escalationId}`}
                            className="text-brand-400 hover:underline font-semibold"
                          >
                            {escalationTitle.length > 50 ? `${escalationTitle.slice(0, 50)}...` : escalationTitle}
                          </Link>
                        </span>

                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                            ans.status === 'verified'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                              : ans.status === 'rejected'
                              ? 'bg-red-500/20 text-red-400 border-red-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {ans.status}
                        </span>
                      </div>

                      <p className="text-sm text-slate-300 leading-relaxed mb-3">{ans.body}</p>

                      {ans.status === 'rejected' && ans.rejectionReason && (isOwnProfile || currentUser?.role === 'admin') && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400 mb-3">
                          <strong className="block mb-0.5 font-bold">Rejection Reason:</strong>
                          {ans.rejectionReason}
                        </div>
                      )}

                      <div className="flex justify-between items-center text-xs text-slate-600">
                        <span>Submitted on {new Date(ans.createdAt).toLocaleDateString()}</span>
                        <span className="font-semibold text-slate-400">▲ {ans.upvoteCount} upvotes</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* REPUTATION TAB */}
        {activeTab === 'reputation' && (
          <>
            {reputationLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : !reputationData?.history.length ? (
              <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-500 text-sm">
                No reputation changes logged for this user.
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-850 overflow-hidden">
                {reputationData.history.map((event) => {
                  const isPositive = event.delta > 0;
                  return (
                    <div key={event._id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-slate-300">
                          {event.reason.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(event.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div
                        className={`text-sm font-extrabold px-3 py-1 rounded-lg shrink-0 ${
                          isPositive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {isPositive ? `+${event.delta}` : event.delta}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
