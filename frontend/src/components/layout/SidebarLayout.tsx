'use client';

import { useAuth } from '@/hooks/useAuth';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const NAV_BY_ROLE: Record<string, { label: string; href: string; icon: string }[]> = {
  TEACHER: [
    { label: 'Dashboard', href: '/teacher', icon: '📊' },
    { label: 'Upload',    href: '/upload', icon: '📤' },
    { label: 'Profile',   href: '/dashboard/profile', icon: '👤' },
    { label: 'Settings',  href: '/dashboard/settings', icon: '⚙️' },
  ],
  STUDENT: [
    { label: 'Home',      href: '/student-home', icon: '🏠' },
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'History',   href: '/dashboard/history', icon: '📚' },
    { label: 'Profile',   href: '/dashboard/profile', icon: '👤' },
    { label: 'Settings',  href: '/dashboard/settings', icon: '⚙️' },
  ],
  GUARDIAN: [
    { label: 'Dashboard', href: '/guardian', icon: '📊' },
    { label: 'Profile',   href: '/dashboard/profile', icon: '👤' },
    { label: 'Settings',  href: '/dashboard/settings', icon: '⚙️' },
  ],
};

export default function SidebarLayout({
  children,
  rightPanel,
}: {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) { setCollapsed(true); setMobileOpen(false); }
      else if (window.innerWidth < 1024) setCollapsed(true);
      else setCollapsed(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const navItems = NAV_BY_ROLE[user?.role || 'STUDENT'] || NAV_BY_ROLE.STUDENT;

  return (
    <div className="flex min-h-screen">
      <button
        className="fixed top-4 left-4 z-50 md:hidden text-white bg-gray-800 p-2 rounded"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      <aside
        className={`bg-gray-900 text-white p-4 flex flex-col transition-all duration-300 fixed md:sticky top-0 left-0 h-screen z-40
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          ${collapsed ? 'w-20' : 'w-64'}
        `}
      >
        <div className="flex items-center justify-between mb-8">
          {!collapsed && (
            <Link href="/dashboard">
              <Image src="/Elekeza Logo.png" alt="Elekeza" width={120} height={40} />
            </Link>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="text-white opacity-70 hover:opacity-100 text-xl hidden md:block">
            {collapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition hover:bg-white/10
                  ${collapsed ? 'justify-center' : ''}
                  ${isActive ? 'border-l-4 border-purple-500 bg-white/10 font-bold' : 'opacity-70'}
                `}
                onClick={() => setMobileOpen(false)}>
                <span className="text-xl">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-white/20">
          {!collapsed && <p className="text-sm opacity-80 mb-2">{user?.name || 'Learner'}</p>}
          <button onClick={handleLogout} className="text-sm opacity-60 hover:opacity-100 transition">
            {collapsed ? '🚪' : 'Logout'}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen">
        <div className="flex-1 px-4 md:px-8 py-6 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>

      {rightPanel && (
        <aside className="w-72 bg-white/5 backdrop-blur-lg p-4 hidden xl:block">
          {rightPanel}
        </aside>
      )}
    </div>
  );
}
