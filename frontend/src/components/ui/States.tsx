import type { ReactNode } from 'react';
import { Inbox, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Consistent loading indicator; announced to screen readers. */
export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn('flex items-center gap-2 py-6 text-purple-300', className)}>
      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Friendly "nothing here yet" panel with an optional next step. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('glass-card p-6 text-center', className)}>
      <div className="mx-auto mb-3 flex justify-center text-purple-400" aria-hidden="true">
        {icon ?? <Inbox size={40} />}
      </div>
      <p className="text-purple-200">{title}</p>
      {description && <p className="mt-1 text-sm text-purple-300">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
