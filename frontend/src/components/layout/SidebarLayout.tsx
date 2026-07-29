'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard, Users, BookOpen, ClipboardCheck, Upload, TrendingUp,
  Calendar, User, Settings, FileText, MessageSquare, Menu, X, Building2, BrainCircuit
} from 'lucide-react';

const teacherItems = [
  { href: '/teacher', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teacher/students', label: 'Students', icon: Users },
  { href: '/teacher/lessons', label: 'Lessons', icon: BookOpen },
  { href: '/teacher/assignments', label: 'Assignments', icon: ClipboardCheck },
  { href: '/teacher/content', label: 'Content', icon: Upload },
  { href: '/teacher/progress', label: 'Progress', icon: TrendingUp },
  { href: '/teacher/plans', label: 'Lesson Plans', icon: BookOpen },
  { href: '/teacher/timetable', label: 'Timetable', icon: Calendar },
  { href: '/teacher/communication', label: 'Communication', icon: MessageSquare },
    { href: '/teacher/schedule', label: 'Schedule', icon: Calendar },
];

const studentItems = [
  { href: '/student-ai-tutor', label: 'AI Tutor', icon: BrainCircuit },
  { href: '/student-home', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/student-lessons', label: 'My Lessons', icon: BookOpen },
  { href: '/student-quizzes', label: 'Quizzes', icon: ClipboardCheck },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
];

const guardianItems = [
  { href: '/guardian', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/guardian/wards', label: 'My Child', icon: User },
  { href: '/guardian/reports', label: 'Reports', icon: FileText },
  { href: '/guardian/schedule', label: 'Schedule', icon: Calendar },
  { href: '/guardian/communication', label: 'Communication', icon: MessageSquare },
];

const adminItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/school/onboarding', label: 'Schools', icon: Users },
  { href: '/super-admin', label: 'Platform', icon: TrendingUp },
];

const commonItems = [
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

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
        <button onClick={() => setCollapsed(!collapsed)} className="text-purple-300 hover:text-white">
          {collapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
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
            className={'flex items-center gap-3 p-2 rounded-lg transition ' + (pathname === item.href ? 'bg-purple-600/40 text-white' : 'text-purple-200 hover:bg-white/10')}
          >
            <item.icon size={20} />
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </Link>
        ))}
        <button
          onClick={logout}
          className="flex items-center gap-3 p-2 rounded-lg text-purple-200 hover:bg-white/10 w-full text-left"
        >
          <LogOutIcon size={20} />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-gradient)" }}>
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
      >
        <Menu size={24} />
      </button>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {children}
      </main>
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







