import { cn } from '@/lib/cn';

/** Accessible on/off toggle (role="switch"). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name (visually hidden). */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50',
        checked ? 'bg-purple-600' : 'bg-gray-400/60',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white transition',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}
