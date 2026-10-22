'use client';

import { useEffect, useState } from 'react';
import { useAccessibilitySettings } from './AccessibilitySettingsProvider';

/**
 * Reading guide: a soft horizontal band that follows the pointer (or the
 * focused element when using the keyboard) so a reader can keep their place
 * in a line of text. Shown only when the "Reading Guide" setting is on.
 */
export function ReadingGuide() {
  const { settings } = useAccessibilitySettings();
  const [y, setY] = useState<number | null>(null);

  useEffect(() => {
    if (!settings.readingGuide) return;
    const onMove = (e: PointerEvent) => setY(e.clientY);
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.getBoundingClientRect) return;
      const r = el.getBoundingClientRect();
      setY(r.top + r.height / 2);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('focusin', onFocus);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('focusin', onFocus);
    };
  }, [settings.readingGuide]);

  if (!settings.readingGuide || y === null) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 z-[60] h-10 -translate-y-1/2 border-y-2 border-amber-400/70 bg-amber-200/20"
      style={{ top: y }}
    />
  );
}
