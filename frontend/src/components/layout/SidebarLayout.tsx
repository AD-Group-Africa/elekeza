'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardCheck,
  Upload,
  TrendingUp,
  User,
  FileText,
  Settings,
  Menu,
  X
} from 'lucide-react';

const teacherItems = [
  { href: '/teacher', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teacher/students', label: 'Students', icon: Users },
  { href: '/teacher/lessons', label: 'Lessons', icon: BookOpen },
  { href: '/teacher/assignments', label: 'Assignments', icon: ClipboardCheck },
  { href: '/teacher/content', label: 'Content', icon: Upload },
  { href: '/teacher/progress', label: 'Progress', icon: TrendingUp },
];

const studentItems = [
  { href: '/student-home', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/lesson/1', label: 'My Lessons', icon: BookOpen },
  { href: '/quiz/1', label: 'Quizzes', icon: ClipboardCheck },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
];

const guardianItems = [
  { href: '/guardian', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/guardian/wards', label: 'My Child', icon: User },
  { href: '/guardian/reports', label: 'Reports', icon: FileText },
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
  const pathname = usePathname();
  const { user } = useAuth();

  const items = (() => {
    switch (user?.role) {
      case 'TEACHER':
      case 'SCHOOL_ADMIN':
        return teacherItems;
      case 'STUDENT':
        return studentItems;
      case 'GUARDIAN':
        return guardianItems;
      case 'ADMIN':
        return adminItems;
      default:
        return [];
    }
  })();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className={`bg-opacity-90 bg-black/30 backdrop-blur-xl border-r border-purple-500/20 text-white transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'} flex-shrink-0`}>
        <div className="flex items-center justify-between p-4">
          {!collapsed && <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Elekeza</span>}
          <button onClick={() => setCollapsed(!collapsed)} className="text-purple-300 hover:text-white">
            {collapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-2 mt-4">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 p-2 rounded-lg transition ${pathname === item.href ? 'bg-purple-600/40 text-white' : 'text-purple-200 hover:bg-white/10'}`}
            >
              <item.icon size={20} />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          ))}
          <div className="my-2 border-t border-purple-500/20"></div>
          {commonItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 p-2 rounded-lg transition ${pathname === item.href ? 'bg-purple-600/40 text-white' : 'text-purple-200 hover:bg-white/10'}`}
            >
              <item.icon size={20} />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          ))}
        </nav>
      </div>
      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        {children}
      </div>
    </div>
  );
}
