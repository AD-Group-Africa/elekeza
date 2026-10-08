'use client';

/**
 * Elekeza Assist — the assistance interface.
 *
 * Fixed bottom-LEFT of the content area (deliberately away from the top-right
 * notification bell and the bottom-right toasts, so notifications, toasts and
 * assistance never collide; the viewport's bottom-left corner belongs to the
 * sidebar and its Logout button). Collapsed = one accessible trigger;
 * expanded = a non-modal panel with context-aware help actions.
 *
 * Contract (docs/UX_AND_DESIGN_SYSTEM.md §5):
 * - never auto-opens (only user action or the explicit `elekeza:assist-open`
 *   CustomEvent from the mobile bottom-nav "Help" item);
 * - never pretends to be human (labelled "automated helper");
 * - never fabricates educational information (actions link to real surfaces —
 *   the AI tutor, preferences, messages — never invented answers);
 * - keyboard accessible (Esc closes, focus is trapped while open and returned
 *   to the trigger on close);
 * - screen-reader accessible (dialog + labelled controls);
 * - respects reduced motion and mobile safe areas;
 * - does not cover primary controls (bottom-left of the content area — right
 *   of the desktop sidebar — and above the mobile bottom nav);
 * - styled with the canonical Elekeza design tokens (moss accent) so the
 *   surface is opaque and theme-consistent in dark / light / calm.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleHelp, X, BookOpen, SlidersHorizontal, MessagesSquare, Volume2, Users, Wallet, AlertTriangle, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function ElekezaAssist({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || '/';
  const { user } = useAuth();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Never auto-open: the only programmatic opener is the explicit event from
  // the mobile bottom navigation "Help" item.
  useEffect(() => {
    const openAssist = () => setOpen(true);
    window.addEventListener('elekeza:assist-open', openAssist);
    return () => window.removeEventListener('elekeza:assist-open', openAssist);
  }, []);

  // Focus management: focus the close button on open, return to trigger on close.
  useEffect(() => {
    if (open) {
      panelRef.current?.querySelector<HTMLElement>('[data-assist-close]')?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [open]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === 'Tab' && panelRef.current) {
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  if (!user) return null;

  // Hide on auth screens — there is nothing to assist there.
  if (['/login', '/register', '/forgot-password', '/reset-password'].includes(pathname)) return null;

  const lessonMatch = pathname.match(/^\/lesson\/(\d+)/);
  const role = user.role;

  const actions: { href: string; label: string; icon: React.ComponentType<{ size?: number | string; className?: string }> }[] = [];
  if (role === 'STUDENT') {
    if (lessonMatch) {
      actions.push({ href: `/student-ai-tutor?lessonId=${lessonMatch[1]}`, label: 'Explain this lesson', icon: BookOpen });
      actions.push({ href: '/learner/preferences', label: 'Turn on read-aloud', icon: Volume2 });
    } else {
      actions.push({ href: '/student-ai-tutor', label: 'Ask the AI Tutor', icon: BookOpen });
    }
    actions.push({ href: '/student-lessons', label: 'My lessons', icon: LayoutDashboard });
    actions.push({ href: '/learner/preferences', label: 'Change how I learn', icon: SlidersHorizontal });
  } else if (role === 'GUARDIAN') {
    actions.push({ href: '/guardian/wards', label: "My child's progress", icon: Users });
    actions.push({ href: '/guardian/reports', label: 'Learning reports', icon: BookOpen });
    actions.push({ href: '/guardian/communication', label: 'Messages', icon: MessagesSquare });
  } else if (role === 'TEACHER') {
    actions.push({ href: '/teacher/students', label: 'My students', icon: Users });
    actions.push({ href: '/teacher/support', label: 'Support signals', icon: AlertTriangle });
    actions.push({ href: '/teacher/communication', label: 'Messages', icon: MessagesSquare });
  } else {
    actions.push({ href: '/admin', label: 'School dashboard', icon: LayoutDashboard });
    actions.push({ href: '/attendance', label: 'Attendance', icon: Users });
    actions.push({ href: '/finance', label: 'Fees & finance', icon: Wallet });
  }

  // Desktop: sit at the left edge of the content column (right of the sidebar,
  // whose width is 224px expanded / 64px collapsed). Mobile: viewport left with
  // a 16px gutter, above the bottom nav.
  const horizontal = `left-4 ${collapsed ? 'md:left-20' : 'md:left-60'}`;

  return (
    <>
      {/* Collapsed trigger — bottom-LEFT of the content area, above the mobile
          bottom nav */}
      {!open && (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Elekeza Assist — open help"
          aria-expanded={false}
          className={`fixed bottom-24 md:bottom-6 z-40 flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-3 text-[var(--accent-contrast)] shadow-lg transition motion-reduce:transition-none hover:bg-[var(--accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)] ${horizontal}`}
        >
          <CircleHelp size={20} aria-hidden="true" />
          <span className="text-sm font-semibold">Elekeza Assist</span>
        </button>
      )}

      {/* Expanded panel — non-modal dialog so the page stays usable; opaque
          token surface so underlying page text never bleeds through */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Elekeza Assist"
          onKeyDown={onKeyDown}
          className={`fixed bottom-24 md:bottom-6 z-40 w-[calc(100%-2rem)] max-w-sm rounded-xl border border-[var(--border-strong)] bg-[var(--bg-primary)] p-4 shadow-2xl ${horizontal}`}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-[var(--text-primary)]">Elekeza Assist</span>
            <button
              type="button"
              data-assist-close
              onClick={() => setOpen(false)}
              aria-label="Close Elekeza Assist"
              className="rounded-md p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <p className="mb-3 text-sm text-[var(--text-secondary)]">How can I help?</p>
          <div className="space-y-1">
            {actions.map(a => (
              <Link
                key={a.href}
                href={a.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] transition motion-reduce:transition-none hover:bg-[var(--bg-card-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <a.icon size={18} aria-hidden="true" />
                {a.label}
              </Link>
            ))}
          </div>
          <p className="mt-3 border-t border-[var(--border-color)] pt-2 text-xs text-[var(--text-muted)]">
            Automated helper — not a human. Your teachers and guardians read what you share.
          </p>
        </div>
      )}
    </>
  );
}
