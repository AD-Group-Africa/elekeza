import { CalendarDays, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { DEADLINE_TYPE_LABEL, type Deadline } from '../api';

/** Dated list of school deadlines/events, with optional delete for their creator. */
export function DeadlineList({
  deadlines,
  canDelete,
  onDelete,
  empty = 'Nothing scheduled.',
}: {
  deadlines: Deadline[];
  canDelete?: (d: Deadline) => boolean;
  onDelete?: (d: Deadline) => void;
  empty?: string;
}) {
  if (deadlines.length === 0) return <p className="text-sm text-purple-300">{empty}</p>;
  return (
    <ul className="space-y-2">
      {deadlines.map((d) => (
        <li key={d.id} className="flex items-start justify-between gap-3 rounded-lg bg-white/5 p-3">
          <div className="flex items-start gap-3">
            <CalendarDays size={18} className="mt-0.5 shrink-0 text-purple-300" aria-hidden="true" />
            <div>
              <p className="font-medium text-purple-100">{d.title}</p>
              <p className="text-xs text-purple-300">{formatDateTime(d.dueAt)}</p>
              {d.description && <p className="mt-1 text-sm text-purple-200">{d.description}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={d.deadlineType === 'EXAM' ? 'warning' : 'accent'}>
              {DEADLINE_TYPE_LABEL[d.deadlineType] ?? d.deadlineType}
            </Badge>
            {canDelete?.(d) && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(d)}
                aria-label={`Delete ${d.title}`}
                className="rounded p-1 text-purple-300 hover:bg-white/10 hover:text-white"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
