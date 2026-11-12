'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { attendanceApi, attendanceKeys } from '../api';

const LABELS = [
  ['PRESENT', 'Present'],
  ['LATE', 'Late'],
  ['ABSENT', 'Absent'],
  ['EXCUSED', 'Excused'],
] as const;

/** Whole-school attendance for the last 30 days (school admins). */
export function SchoolAttendanceSummary() {
  const summary = useQuery({ queryKey: attendanceKeys.summary, queryFn: attendanceApi.summary });
  const s = summary.data;
  if (!s) return null;
  return (
    <Card className="mb-6" role="region" aria-label="School attendance summary">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-fg-muted">
            Whole school · {formatDate(s.from)} – {formatDate(s.to)}
          </p>
          <p className="text-3xl font-bold text-fg">{s.sessions === 0 ? '—' : `${s.attendanceRate}%`}</p>
          <p className="text-xs text-fg-subtle">
            {s.sessions === 0 ? 'No registers marked in this period.' : `${s.sessions} registers marked`}
          </p>
        </div>
        <dl className="flex flex-wrap gap-2 text-sm">
          {LABELS.map(([key, label]) => (
            <div key={key} className="rounded-lg border border-line px-3 py-1.5">
              <dt className="inline text-fg-muted">{label}: </dt>
              <dd className="inline font-semibold text-fg">{s.counts[key] ?? 0}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}
