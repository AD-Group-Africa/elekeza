'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BOTTOM_NAV_BY_ROLE } from '@/config/navigation';
import { openAssist } from '@/components/layout/ElekezaAssist';
import { isRole } from '@/lib/roles';
import { cn } from '@/lib/cn';

/** Phone-sized bottom bar for learners and guardians. Hidden on desktop. */
export function MobileBottomNav({ role, onOpenMenu }: { role: string; onOpenMenu: () => void }) {
  const pathname = usePathname();
  const items = isRole(role) ? BOTTOM_NAV_BY_ROLE[role] : undefined;
  if (!items) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map((item) => {
        const active = !item.action && pathname === item.href;
        const cls = cn(
          'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium',
          active ? 'bg-purple-600/40 text-white' : 'text-purple-200 hover:bg-white/10',
        );
        const content = (
          <>
            <item.icon size={20} aria-hidden={true} />
            <span>{item.label}</span>
          </>
        );
        if (item.action) {
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.action === 'assist' ? openAssist : onOpenMenu}
              className={cls}
              aria-label={item.ariaLabel}
            >
              {content}
            </button>
          );
        }
        return (
          <Link
            key={item.label}
            href={item.href!}
            aria-current={active ? 'page' : undefined}
            aria-label={item.ariaLabel}
            className={cls}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
