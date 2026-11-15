import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type CardProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  /** Optional heading rendered at the top of the card. */
  title?: ReactNode;
  /** Optional content aligned to the right of the title (e.g. an action). */
  actions?: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
};

const PADDING = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' } as const;

/** The standard content surface. Uses the theme-aware `glass-card` style. */
export function Card({ title, actions, padding = 'md', className, children, ...rest }: CardProps) {
  return (
    <div className={cn('glass-card', PADDING[padding], className)} {...rest}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-semibold text-fg">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
