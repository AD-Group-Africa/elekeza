'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Accessible tabs. Render the active panel as `children`; it is wrapped in a
 * tabpanel linked to its tab. Arrow keys move between tabs.
 */
export function Tabs<K extends string>({
  id,
  label,
  tabs,
  value,
  onChange,
  children,
}: {
  /** Unique prefix for element ids. */
  id: string;
  /** Accessible name of the tab list. */
  label: string;
  tabs: Array<{ key: K; label: string }>;
  value: K;
  onChange: (key: K) => void;
  children: ReactNode;
}) {
  const move = (delta: number) => {
    const i = tabs.findIndex((t) => t.key === value);
    const next = tabs[(i + delta + tabs.length) % tabs.length];
    onChange(next.key);
    document.getElementById(`${id}-tab-${next.key}`)?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="mb-6 flex flex-wrap gap-2"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') move(1);
          if (e.key === 'ArrowLeft') move(-1);
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            id={`${id}-tab-${t.key}`}
            type="button"
            role="tab"
            aria-selected={value === t.key}
            aria-controls={`${id}-panel`}
            tabIndex={value === t.key ? 0 : -1}
            onClick={() => onChange(t.key)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              value === t.key
                ? 'bg-accent text-accent-contrast'
                : 'border border-line bg-surface text-fg hover:bg-surface-hover',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${value}`}>
        {children}
      </div>
    </div>
  );
}
