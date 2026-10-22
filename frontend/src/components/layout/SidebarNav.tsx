'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, X } from 'lucide-react';
import { COMMON_NAV, NAV_BY_ROLE, type NavItem } from '@/config/navigation';
import { isRole, roleHome } from '@/lib/roles';
import { cn } from '@/lib/cn';

function NavLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg p-2 transition',
        active ? 'bg-purple-600/40 text-white' : 'text-purple-200 hover:bg-white/10',
      )}
    >
      <item.icon size={20} aria-hidden={true} />
      {collapsed ? (
        <span className="sr-only">{item.label}</span>
      ) : (
        <span className="text-sm font-medium">{item.label}</span>
      )}
    </Link>
  );
}

/** Sidebar contents: logo, the role's menu, common links and sign-out. */
export function SidebarNav({
  role,
  collapsed,
  onToggleCollapsed,
  onNavigate,
  onLogout,
}: {
  role: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate: () => void;
  onLogout: () => void;
}) {
  const items = isRole(role) ? NAV_BY_ROLE[role] : [];

  return (
    <div className="flex h-full flex-col border-r border-line bg-surface p-4 backdrop-blur-md">
      <div className="mb-6 flex items-center justify-between">
        {!collapsed && (
          <Link href={roleHome(role)} onClick={onNavigate} aria-label="Elekeza home">
            <Image
              src="/elekeza-logo-wide.png"
              alt="Elekeza"
              width={600}
              height={209}
              className="h-auto max-h-9 w-auto max-w-[150px] object-contain"
              priority
            />
          </Link>
        )}
        <button
          onClick={onToggleCollapsed}
          className="text-purple-300 hover:text-white"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
      </div>

      <nav aria-label="Main" className="flex-1 space-y-1">
        {items.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="space-y-1 border-t border-purple-300/10 pt-4">
        {COMMON_NAV.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg p-2 text-left text-purple-200 hover:bg-white/10"
          aria-label="Logout"
        >
          <LogOut size={20} aria-hidden="true" />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );
}
