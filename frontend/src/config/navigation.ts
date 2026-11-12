import type { ComponentType } from 'react';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardCheck,
  Upload,
  TrendingUp,
  Calendar,
  User,
  Settings,
  FileText,
  MessageSquare,
  Menu,
  BrainCircuit,
  AlertTriangle,
  SlidersHorizontal,
  UserCheck,
  Wallet,
  NotebookPen,
  UserCog,
  CircleHelp,
  BarChart3,
  FileSpreadsheet,
  Building2,
  School,
  Network,
  CalendarDays,
  Tablet,
  GraduationCap,
} from 'lucide-react';
import type { Role } from '@/lib/roles';

/**
 * Sidebar and mobile navigation for every role. To add a page to a menu,
 * add one entry here — layouts read this file and never hard-code links.
 */

type Icon = ComponentType<{ size?: number | string; className?: string; 'aria-hidden'?: boolean }>;

export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
}

export interface BottomNavItem {
  label: string;
  icon: Icon;
  ariaLabel: string;
  /** A link… */
  href?: string;
  /** …or an action: open Elekeza Assist, or open the full menu. */
  action?: 'assist' | 'menu';
}

const TEACHER: NavItem[] = [
  { href: '/teacher', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teacher/students', label: 'Students', icon: Users },
  { href: '/classes', label: 'Classes', icon: School },
  { href: '/teacher/lessons', label: 'Lessons', icon: BookOpen },
  { href: '/teacher/assignments', label: 'Assignments', icon: ClipboardCheck },
  { href: '/teacher/content', label: 'Content', icon: Upload },
  { href: '/teacher-assignments', label: 'Classwork', icon: NotebookPen },
  { href: '/teacher/exams', label: 'Exams', icon: FileText },
  { href: '/teacher/quiz-results', label: 'Quiz Results', icon: ClipboardCheck },
  { href: '/teacher/support', label: 'Support Signals', icon: AlertTriangle },
  { href: '/teacher/progress', label: 'Progress', icon: TrendingUp },
  { href: '/curriculum', label: 'Curriculum', icon: Network },
  { href: '/teacher/timetable', label: 'Timetable', icon: Calendar },
  { href: '/calendar', label: 'School Calendar', icon: CalendarDays },
  { href: '/teacher/communication', label: 'Communication', icon: MessageSquare },
  { href: '/attendance', label: 'Attendance', icon: UserCheck },
];

const STUDENT: NavItem[] = [
  { href: '/student-ai-tutor', label: 'AI Tutor', icon: BrainCircuit },
  { href: '/student-home', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/student-lessons', label: 'My Lessons', icon: BookOpen },
  { href: '/assignments', label: 'Assignments', icon: NotebookPen },
  { href: '/student-quizzes', label: 'Quizzes', icon: ClipboardCheck },
  { href: '/student-exams', label: 'Exams', icon: FileText },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/fees', label: 'My Fees', icon: Wallet },
  { href: '/learner/preferences', label: 'How I Learn', icon: SlidersHorizontal },
];

const GUARDIAN: NavItem[] = [
  { href: '/guardian', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/guardian/wards', label: 'My Child', icon: User },
  { href: '/guardian/fees', label: 'Fees', icon: Wallet },
  { href: '/guardian/reports', label: 'Reports', icon: FileText },
  { href: '/guardian/schedule', label: 'Schedule', icon: Calendar },
  { href: '/guardian/communication', label: 'Communication', icon: MessageSquare },
];

const SCHOOL_ADMIN: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/staff', label: 'Staff Accounts', icon: UserCog },
  { href: '/admin/learners', label: 'Learners', icon: GraduationCap },
  { href: '/school/import', label: 'Import Learners', icon: FileSpreadsheet },
  { href: '/classes', label: 'Classes', icon: School },
  { href: '/curriculum', label: 'Curriculum', icon: Network },
  { href: '/finance', label: 'Finance', icon: Wallet },
  { href: '/attendance', label: 'Attendance', icon: UserCheck },
  { href: '/calendar', label: 'School Calendar', icon: CalendarDays },
  { href: '/admin/devices', label: 'Devices', icon: Tablet },
  { href: '/analytics', label: 'Engagement', icon: BarChart3 },
];

const PLATFORM_ADMIN: NavItem[] = [...SCHOOL_ADMIN, { href: '/super-admin', label: 'Platform', icon: Building2 }];

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  TEACHER,
  STUDENT,
  GUARDIAN,
  SCHOOL_ADMIN,
  ADMIN: PLATFORM_ADMIN,
};

/** Shown to every signed-in role, below the role menu. */
export const COMMON_NAV: NavItem[] = [
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

/** Mobile bottom bar (learners and guardians; staff menus are too long). */
export const BOTTOM_NAV_BY_ROLE: Partial<Record<Role, BottomNavItem[]>> = {
  STUDENT: [
    { label: 'Home', href: '/student-home', icon: LayoutDashboard, ariaLabel: 'Home' },
    { label: 'Learn', href: '/student-lessons', icon: BookOpen, ariaLabel: 'Learn' },
    { label: 'Progress', href: '/progress', icon: TrendingUp, ariaLabel: 'Progress' },
    { label: 'Help', action: 'assist', icon: CircleHelp, ariaLabel: 'Help — open Elekeza Assist' },
    { label: 'Profile', href: '/dashboard/profile', icon: User, ariaLabel: 'Profile' },
  ],
  GUARDIAN: [
    { label: 'Home', href: '/guardian', icon: LayoutDashboard, ariaLabel: 'Home' },
    { label: 'Child', href: '/guardian/wards', icon: User, ariaLabel: 'My child' },
    { label: 'Reports', href: '/guardian/reports', icon: FileText, ariaLabel: 'Reports' },
    { label: 'Messages', href: '/guardian/communication', icon: MessageSquare, ariaLabel: 'Messages' },
    { label: 'More', action: 'menu', icon: Menu, ariaLabel: 'More — open full menu' },
  ],
};
