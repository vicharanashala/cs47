'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { AdminStats } from '@/types';
import Link from 'next/link';

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data as AdminStats),
    refetchInterval: 30000,
  });

  const statCards = stats
    ? [
        { label: 'Open Escalations', value: stats.openEscalations, color: 'text-sky-400', href: '/feed' },
        { label: 'Pending Verification', value: stats.unverifiedAnswers, color: 'text-amber-400', href: '/admin/queue' },
        { label: 'Pending Flags', value: stats.pendingFlags, color: 'text-red-400', href: '/admin/flags' },
        { label: 'Total Users', value: stats.totalUsers, color: 'text-emerald-400', href: '#' },
      ]
    : [];

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-100 mb-6">Platform Overview</h2>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Link key={card.label} href={card.href}>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
                <div className={`text-3xl font-bold mb-1 ${card.color}`}>{card.value}</div>
                <div className="text-sm text-slate-500">{card.label}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/admin/queue">
          <div className="bg-slate-900 border border-amber-700/30 rounded-xl p-5 hover:border-amber-700/50 transition-colors">
            <h3 className="font-medium text-amber-300 mb-1">Verification Queue</h3>
            <p className="text-sm text-slate-500">Review and verify community answers</p>
          </div>
        </Link>
        <Link href="/admin/flags">
          <div className="bg-slate-900 border border-red-700/30 rounded-xl p-5 hover:border-red-700/50 transition-colors">
            <h3 className="font-medium text-red-300 mb-1">Flagged Content</h3>
            <p className="text-sm text-slate-500">Review reported posts and answers</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
