import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export type AlertTone = 'success' | 'error' | 'info' | 'warning';

const TONES: Record<AlertTone, { box: string; icon: typeof Info }> = {
  success: { box: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200', icon: CheckCircle2 },
  error: { box: 'border-red-500/40 bg-red-500/10 text-red-200', icon: XCircle },
  info: { box: 'border-sky-500/40 bg-sky-500/10 text-sky-100', icon: Info },
  warning: { box: 'border-amber-500/40 bg-amber-500/10 text-amber-100', icon: AlertTriangle },
};

/**
 * Inline status message. Errors are announced immediately (role="alert"),
 * everything else politely (role="status"). Tone is shown by icon too, never
 * by colour alone.
 */
export function Alert({
  tone = 'info',
  children,
  className,
}: {
  tone?: AlertTone;
  children: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2 rounded-lg border px-4 py-3 text-sm', box, className)}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
