'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      router.replace('/feed');
    }
  }, [isAuthenticated, isAdmin, router]);

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Admin header */}
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-800">
        <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-400">
          ⚙
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Admin Panel</h1>
          <p className="text-xs text-slate-500">Moderation & verification dashboard</p>
        </div>
        <nav className="ml-8 flex gap-2">
          {[
            { href: '/admin', label: 'Dashboard' },
            { href: '/admin/queue', label: 'Verification Queue' },
            { href: '/admin/flags', label: 'Flagged Content' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
