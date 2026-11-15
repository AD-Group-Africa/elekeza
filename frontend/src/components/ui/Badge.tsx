import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-white/10 text-purple-200 border-white/10',
  accent: 'bg-purple-600/30 text-purple-100 border-purple-400/30',
  success: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  warning: 'bg-amber-500/15 text-amber-100 border-amber-500/40',
  danger: 'bg-red-500/15 text-red-200 border-red-500/40',
  info: 'bg-sky-500/15 text-sky-100 border-sky-500/40',
};

/** Small status label. Always pair colour with readable text. */
export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
