'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard, Users, BookOpen, ClipboardCheck, Upload, TrendingUp,
  Calendar, User, Settings, FileText, MessageSquare, Menu, X, BrainCircuit, AlertTriangle, SlidersHorizontal,
  UserCheck, Wallet, NotebookPen, UserCog
} from 'lucide-react';
import NotificationBell from '@/components/layout/NotificationBell';
import ElekezaAssist from '@/components/assist/ElekezaAssist';

const teacherItems = [
  { href: '/teacher', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teacher/students', label: 'Students', icon: Users },
  { href: '/teacher/lessons', label: 'Lessons', icon: BookOpen },
  { href: '/teacher/assignments', label: 'Assignments', icon: ClipboardCheck },
  { href: '/teacher/content', label: 'Content', icon: Upload },
  { href: '/teacher-assignments', label: 'Classwork', icon: NotebookPen },
  { href: '/teacher/exams', label: 'Exams', icon: FileText },
  { href: '/teacher/quiz-results', label: 'Quiz Results', icon: ClipboardCheck },
  { href: '/teacher/support', label: 'Support Signals', icon: AlertTriangle },
  { href: '/teacher/progress', label: 'Progress', icon: TrendingUp },
  { href: '/teacher/plans', label: 'Lesson Plans', icon: BookOpen },
  { href: '/teacher/timetable', label: 'Timetable', icon: Calendar },
  { href: '/teacher/communication', label: 'Communication', icon: MessageSquare },
  { href: '/teacher/schedule', label: 'Schedule', icon: Calendar },
  { href: '/attendance', label: 'Attendance', icon: UserCheck },
];

const studentItems = [
  { href: '/student-ai-tutor', label: 'AI Tutor', icon: BrainCircuit },
  { href: '/student-home', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/student-lessons', label: 'My Lessons', icon: BookOpen },
  { href: '/assignments', label: 'Assignments', icon: NotebookPen },
  { href: '/student-quizzes', label: 'Quizzes', icon: ClipboardCheck },
  { href: '/student-exams', label: 'Exams', icon: FileText },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
  { href: '/learner/preferences', label: 'How I Learn', icon: SlidersHorizontal },
];

const guardianItems = [
  { href: '/guardian', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/guardian/wards', label: 'My Child', icon: User },
  { href: '/guardian/fees', label: 'Fees', icon: Wallet },
  { href: '/guardian/reports', label: 'Reports', icon: FileText },
  { href: '/guardian/schedule', label: 'Schedule', icon: Calendar },
  { href: '/guardian/communication', label: 'Communication', icon: MessageSquare },
];

const adminItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/staff', label: 'Staff Accounts', icon: UserCog },
  { href: '/finance', label: 'Finance', icon: Wallet },
  { href: '/attendance', label: 'Attendance', icon: UserCheck },
  { href: '/school/onboarding', label: 'Schools', icon: Users },
  { href: '/super-admin', label: 'Platform', icon: TrendingUp },
];

const commonItems = [
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

// Mobile bottom navigation sets (Home | Learn | Progress | Help | Profile).
type BottomItem = { label: string; href?: string; icon: React.ComponentType<{ size?: number | string }>; event?: boolean; overlay?: boolean; ariaLabel?: string };

const studentBottomItems: BottomItem[] = [
  { label: 'Home', href: '/student-home', icon: LayoutDashboard, ariaLabel: 'Home' },
  { label: 'Learn', href: '/student-lessons', icon: BookOpen, ariaLabel: 'Learn' },
  { label: 'Progress', href: '/progress', icon: TrendingUp, ariaLabel: 'Progress' },
  { label: 'Help', icon: CircleHelpIcon, event: true, ariaLabel: 'Help — open Elekeza Assist' },
  { label: 'Profile', href: '/dashboard/profile', icon: User, ariaLabel: 'Profile' },
];

const guardianBottomItems: BottomItem[] = [
  { label: 'Home', href: '/guardian', icon: LayoutDashboard, ariaLabel: 'Home' },
  { label: 'Child', href: '/guardian/wards', icon: User, ariaLabel: 'My child' },
  { label: 'Reports', href: '/guardian/reports', icon: FileText, ariaLabel: 'Reports' },
  { label: 'Messages', href: '/guardian/communication', icon: MessageSquare, ariaLabel: 'Messages' },
  { label: 'More', icon: Menu, overlay: true, ariaLabel: 'More — open full menu' },
];

function CircleHelpIcon({ size }: { size?: number | string }) {
  return (
    <svg width={size ?? 20} height={size ?? 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const role = user?.role || 'STUDENT';

  const navItems = (() => {
    switch (role) {
      case 'TEACHER': return teacherItems;
      case 'STUDENT': return studentItems;
      case 'GUARDIAN': return guardianItems;
      case 'SCHOOL_ADMIN': return adminItems.filter(item => item.href !== '/super-admin');
      case 'ADMIN': return adminItems; // ADMIN sees same sidebar but can access super-admin
      default: return [];
    }
  })();

  const sidebar = (
    <div className="flex flex-col h-full backdrop-blur-md border-r p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <div className="flex items-center justify-between mb-6">
        {!collapsed && <Link href={role === 'STUDENT' ? '/student-home' : '/' + role.toLowerCase().replace
        ('_', '-')} className="text-xl font-bold text-purple-200 hover:text-white transition">Elekeza</Link>}
        <button onClick={() => setCollapsed(!collapsed)} className="text-purple-300 hover:text-white" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? 'page' : undefined}
            className={'flex items-center gap-3 p-2 rounded-lg transition ' + (pathname === item.href ? 'bg-purple-600/40 text-white' : 'text-purple-200 hover:bg-white/10')}
          >
            <item.icon size={20} />
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </Link>
        ))}
      </nav>

      <div className="border-t border-purple-300/10 pt-4 space-y-1">
        {commonItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? 'page' : undefined}
            className={'flex items-center gap-3 p-2 rounded-lg transition ' + (pathname === item.href ? 'bg-purple-600/40 text-white' : 'text-purple-200 hover:bg-white/10')}
          >
            <item.icon size={20} />
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </Link>
        ))}
        <button
          onClick={logout}
          className="flex items-center gap-3 p-2 rounded-lg text-purple-200 hover:bg-white/10 w-full text-left"
          aria-label="Logout"
        >
          <LogOutIcon size={20} />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-gradient)" }}>
      {/* WCAG 2.4.1 Bypass Blocks — first focusable element on the page */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-purple-700 focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>
      {/* Desktop sidebar */}
      <aside className={'hidden md:block ' + (collapsed ? 'w-16' : 'w-56') + ' transition-all duration-300'}>
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-56 z-50">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-2 glass-card rounded-lg text-purple-200"
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>

      {/* Main content — extra bottom padding on mobile so the bottom nav and
          Elekeza Assist never cover page content or forms */}
      <main id="main-content" className="flex-1 overflow-auto p-4 pb-28 md:p-6 md:pb-6">
        <div className="flex justify-end mb-2">
          <NotificationBell />
        </div>
        {children}
      </main>

      {/* Mobile bottom navigation (learner + guardian; staff keep the sidebar
          menu because their item sets are operational and long) */}
      {(role === 'STUDENT' || role === 'GUARDIAN') && (
        <nav
          aria-label="Primary"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {(role === 'STUDENT' ? studentBottomItems : guardianBottomItems).map(item => {
            const active = item.event !== true && pathname === item.href;
            const cls = 'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium min-h-[56px] ' +
              (active ? 'text-white bg-purple-600/40' : 'text-purple-200 hover:bg-white/10');
            const icon = <item.icon size={20} aria-hidden="true" />;
            return item.event === true ? (
              <button key={item.label} type="button" onClick={() => window.dispatchEvent(new CustomEvent('elekeza:assist-open'))} className={cls} aria-label={item.ariaLabel}>
                {icon}
                <span>{item.label}</span>
              </button>
            ) : item.overlay === true ? (
              <button key={item.label} type="button" onClick={() => setMobileOpen(true)} className={cls} aria-label={item.ariaLabel}>
                {icon}
                <span>{item.label}</span>
              </button>
            ) : (
              <Link key={item.label} href={item.href!} aria-current={active ? 'page' : undefined} className={cls}>
                {icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {/* Elekeza Assist — bottom-left floating assistance interface.
          `collapsed` keeps the desktop pill clear of the sidebar's Logout
          button (the viewport's bottom-left corner belongs to the sidebar). */}
      <ElekezaAssist collapsed={collapsed} />
    </div>
  );
}

function LogOutIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}







