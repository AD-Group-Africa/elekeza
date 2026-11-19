import type { ComponentType } from 'react';
import {
  LayoutDashboard, Users, BookOpen, ClipboardCheck, Upload, TrendingUp,
  Calendar, User, Settings, FileText, MessageSquare, SlidersHorizontal,
  UserCheck, Wallet, NotebookPen, UserCog, BrainCircuit, AlertTriangle,
} from 'lucide-react';

/**
 * Role → navigation mapping for the application shell.
 *
 * Wave 0 (UX-P1-01): extracted from `SidebarLayout` so the mapping can be
 * unit-tested without booting Next's router or the auth provider. This is the
 * single source of truth for "which links does this role see"; the shell only
 * renders what this returns.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number | string }>;
};

export const teacherItems: NavItem[] = [
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

export const studentItems: NavItem[] = [
  { href: '/student-ai-tutor', label: 'AI Tutor', icon: BrainCircuit },
  { href: '/student-home', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/student-lessons', label: 'My Lessons', icon: BookOpen },
  { href: '/assignments', label: 'Assignments', icon: NotebookPen },
  { href: '/student-quizzes', label: 'Quizzes', icon: ClipboardCheck },
  { href: '/student-exams', label: 'Exams', icon: FileText },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
  { href: '/learner/preferences', label: 'How I Learn', icon: SlidersHorizontal },
];

export const guardianItems: NavItem[] = [
  { href: '/guardian', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/guardian/wards', label: 'My Child', icon: User },
  { href: '/guardian/fees', label: 'Fees', icon: Wallet },
  { href: '/guardian/reports', label: 'Reports', icon: FileText },
  { href: '/guardian/schedule', label: 'Schedule', icon: Calendar },
  { href: '/guardian/communication', label: 'Communication', icon: MessageSquare },
];

export const adminItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/staff', label: 'Staff Accounts', icon: UserCog },
  { href: '/finance', label: 'Finance', icon: Wallet },
  { href: '/attendance', label: 'Attendance', icon: UserCheck },
  { href: '/school/onboarding', label: 'Schools', icon: Users },
  { href: '/super-admin', label: 'Platform', icon: TrendingUp },
];

export const commonItems: NavItem[] = [
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

/**
 * Navigation for a role. `SCHOOL_ADMIN` is an institution-level administrator
 * and must never be offered the platform (super-admin) surface; `ADMIN` is the
 * platform role and may see it. An unknown or missing role gets no links at
 * all rather than a guess — the shell must not show anyone else's menu.
 */
export function navItemsFor(role: string | undefined | null): NavItem[] {
  switch (role) {
    case 'TEACHER':
      return teacherItems;
    case 'STUDENT':
      return studentItems;
    case 'GUARDIAN':
      return guardianItems;
    case 'SCHOOL_ADMIN':
      return adminItems.filter((item) => item.href !== '/super-admin');
    case 'ADMIN':
      return adminItems;
    default:
      return [];
  }
}
