'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationStore } from '@/store/notificationStore';
import { useWebSocket } from '@/hooks/useWebSocket';

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { unreadCount } = useNotificationStore();

  // Mount WebSocket globally
  useWebSocket();

  const navLinks = [
    { href: '/feed', label: 'Feed' },
    { href: '/faq', label: 'FAQ' },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <nav className="sticky top-0 z-50 glass border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/feed" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold text-sm group-hover:shadow-lg group-hover:shadow-brand-500/40 transition-all">
            IQ
          </div>
          <span className="font-semibold text-slate-100 hidden sm:block">EscalateIQ</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith(link.href)
                  ? 'bg-brand-500/20 text-brand-400'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              {/* Notifications */}
              <Link
                href="/profile/me"
                className="relative p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <BellIcon />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>

              {/* Username */}
              <Link
                href={`/profile/${user?.username}`}
                className="text-sm text-slate-300 hover:text-white font-medium px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                {user?.username}
                <span className="ml-1.5 text-xs text-brand-400">{user?.reputation}pts</span>
              </Link>

              <button
                onClick={logout}
                className="text-sm text-slate-500 hover:text-red-400 px-2 py-1.5 rounded-lg transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="text-sm bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function BellIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}
