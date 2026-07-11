'use client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';

const NAV_BY_ROLE: Record<string, { label: string; href: string; icon: string }[]> = {
  TEACHER: [
    { label: 'Dashboard',  href: '/teacher',      icon: 'ðŸ“Š' },
    { label: 'Upload',     href: '/upload',        icon: 'ðŸ“¤' },
    { label: 'Import',     href: '/school/import', icon: 'ðŸ“‹' },
    { label: 'Profile',    href: '/dashboard/profile', icon: 'ðŸ‘¤' },
    { label: 'Settings',   href: '/dashboard/settings', icon: 'âš™ï¸' },
  ],
  SCHOOL_ADMIN: [
    { label: 'Dashboard',  href: '/teacher',             icon: 'ðŸ“Š' },
    { label: 'Import',     href: '/school/import',        icon: 'ðŸ“‹' },
    { label: 'Analytics',  href: '/admin/analytics',      icon: 'ðŸ“ˆ' },
    { label: 'Upload',     href: '/upload',               icon: 'ðŸ“¤' },
    { label: 'Settings',   href: '/dashboard/settings',   icon: 'âš™ï¸' },
  ],
  STUDENT: [
    { label: 'Home',       href: '/student-home',      icon: 'ðŸ ' },
    { label: 'Progress',   href: '/dashboard',          icon: 'ðŸ“Š' },
    { label: 'History',    href: '/dashboard/history',  icon: 'ðŸ“š' },
    { label: 'Settings',   href: '/dashboard/settings', icon: 'âš™ï¸' },
  ],
  GUARDIAN: [
    { label: 'My Children', href: '/guardian',    icon: 'ðŸ‘¨â€ðŸ‘©â€ðŸ‘¦' },
    { label: 'Settings',    href: '/dashboard/settings', icon: 'âš™ï¸' },
  ],
  ADMIN: [
    { label: 'Schools',    href: '/admin',             icon: 'ðŸ«' },
    { label: 'Analytics',  href: '/admin/analytics',   icon: 'ðŸ“ˆ' },
    { label: 'Users',      href: '/admin/users',       icon: 'ðŸ‘¥' },
    { label: 'Settings',   href: '/dashboard/settings', icon: 'âš™ï¸' },
  ],
};

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { user, logout }  = useAuth();
  const router    = useRouter();
  const pathname  = usePathname();
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread]         = useState(0);

  // Responsive collapse
  useEffect(() => {
    const resize = () => {
      if (window.innerWidth < 768) { setCollapsed(true); setMobileOpen(false); }
      else if (window.innerWidth < 1024) setCollapsed(true);
      else setCollapsed(false);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Poll unread notifications
  useEffect(() => {
    if (!user) return;
    const load = () => api.get('/notifications/unread')
      .then(r => setUnread(Array.isArray(r.data) ? r.data.length : 0))
      .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [user]);

  const handleLogout = async () => { await logout(); router.push('/login'); };

  const navItems = NAV_BY_ROLE[user?.role ?? 'STUDENT'] ?? NAV_BY_ROLE.STUDENT;

  return (
    <div className="flex min-h-screen">
      {/* Hamburger */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden text-white bg-gray-800/80 backdrop-blur p-2 rounded-lg shadow"
        onClick={() => setMobileOpen(o => !o)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? 'âœ•' : 'â˜°'}
      </button>

      {/* Backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`bg-gray-900 text-white flex flex-col transition-all duration-300 fixed md:sticky top-0 left-0 h-screen z-40
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        ${collapsed ? 'w-20' : 'w-64'}`}>

        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 min-h-[64px]">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="text-xl font-bold text-purple-400">Elekeza</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden md:flex w-8 h-8 items-center justify-center rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition text-sm"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? 'â†’' : 'â†'}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const isNotif = item.href === '/notifications';
            return (
              <Link key={item.href} href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition font-medium text-sm
                  ${active ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}>
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                {!collapsed && (
                  <span className="flex-1">{item.label}</span>
                )}
                {!collapsed && isNotif && unread > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Notifications for all roles */}
          <Link href="/notifications" onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition font-medium text-sm
              ${pathname === '/notifications' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}>
            <span className="text-lg flex-shrink-0">ðŸ””</span>
            {!collapsed && (
              <>
                <span className="flex-1">Notifications</span>
                {unread > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </>
            )}
          </Link>
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-gray-700">
          {!collapsed && user && (
            <div className="px-2 pb-2">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
              <p className="text-xs text-purple-400 mt-0.5 capitalize">{user.role?.toLowerCase().replace('_', ' ')}</p>
            </div>
          )}
          <button onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-gray-400 hover:bg-gray-700 hover:text-white transition text-sm">
            <span className="text-lg">ðŸšª</span>
            {!collapsed && 'Sign out'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 md:p-8 overflow-auto min-h-screen">
        {children}
      </main>
    </div>
  );
}


