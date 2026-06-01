import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Navbar } from '@/components/layout/Navbar';
import { ToastContainer } from '@/components/ui/Toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'EscalateIQ — Crowdsourced FAQ Platform',
  description:
    'A semantically-aware crowdsourced FAQ platform where community answers become self-improving knowledge.',
  keywords: ['FAQ', 'crowdsourced', 'knowledge base', 'community Q&A'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        <Providers>
          <Navbar />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
          <ToastContainer />
        </Providers>
      </body>
    </html>
  );
}
