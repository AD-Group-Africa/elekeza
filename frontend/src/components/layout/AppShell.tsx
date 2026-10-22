'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useAuth } from '@/features/auth';
import NotificationBell from '@/features/notifications/components/NotificationBell';
import ElekezaAssist from '@/components/layout/ElekezaAssist';
import { LoadingState } from '@/components/ui';
import { MobileBottomNav } from './MobileBottomNav';
import { SidebarNav } from './SidebarNav';

/**
 * The signed-in application frame: sidebar, mobile menu and bottom bar,
 * notifications and Elekeza Assist. Used once, by app/(app)/layout.tsx.
 * Visitors without a session are sent to the sign-in page.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // Mobile menu: close on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--bg-gradient)' }}>
        <LoadingState label={loading ? 'Loading…' : 'Taking you to sign in…'} />
      </div>
    );
  }

  const role = user.role;
  const closeMobile = () => setMobileOpen(false);
  const sidebar = (
    <SidebarNav
      role={role}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((c) => !c)}
      onNavigate={closeMobile}
      onLogout={logout}
    />
  );

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-gradient)' }}>
      {/* WCAG 2.4.1 Bypass Blocks — first focusable element on the page */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-lg focus:bg-purple-700 focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      <aside className={(collapsed ? 'w-16' : 'w-56') + ' hidden transition-all duration-300 md:block'}>
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={closeMobile} aria-hidden="true" />
          <aside className="relative z-50 w-56" role="dialog" aria-modal="true" aria-label="Menu">
            {sidebar}
          </aside>
        </div>
      )}

      <button
        onClick={() => setMobileOpen(true)}
        className="glass-card fixed left-4 top-4 z-40 rounded-lg p-2 text-purple-200 md:hidden"
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>

      {/* Extra bottom padding so the mobile bottom nav and Elekeza Assist never
          cover the end of the page: content can always scroll clear of them. */}
      <main id="main-content" className="flex-1 overflow-auto p-4 pb-28 md:p-6 md:pb-24">
        <div className="mb-2 flex justify-end">
          <NotificationBell />
        </div>
        {children}
      </main>

      <MobileBottomNav role={role} onOpenMenu={() => setMobileOpen(true)} />

      {/* `collapsed` keeps the desktop pill clear of the sidebar's Logout button. */}
      <ElekezaAssist collapsed={collapsed} />
    </div>
  );
}
