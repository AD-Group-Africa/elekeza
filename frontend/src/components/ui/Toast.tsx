'use client';

import { useEffect, useRef } from 'react';

/** Short confirmation message, bottom-right; dismisses itself after 3 seconds. */
export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  // Keep the latest callback without restarting the timer on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const timer = setTimeout(() => onCloseRef.current(), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-50 rounded-lg bg-purple-600 px-4 py-2 text-white shadow-lg animate-in"
    >
      {message}
    </div>
  );
}
