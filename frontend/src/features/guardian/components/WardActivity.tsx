'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge, Card, LoadingState } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { guardianApi, guardianKeys } from '../api';

/** A child's exams, classwork and attendance, read-only for their guardian. */
export function WardActivity({ wardId }: { wardId: string | number }) {
  const exams = useQuery({ queryKey: guardianKeys.exams(wardId), queryFn: () => guardianApi.examResults(wardId) });
  const work = useQuery({ queryKey: guardianKeys.submissions(wardId), queryFn: () => guardianApi.submissions(wardId) });
  const attendance = useQuery({
    queryKey: guardianKeys.attendance(wardId),
    queryFn: () => guardianApi.attendance(wardId),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Exam results">
        {exams.isLoading ? (
          <LoadingState />
        ) : (exams.data ?? []).length === 0 ? (
          <p className="text-sm text-fg-muted">No exams taken yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {exams.data!.map((r) => (
              <li key={r.attemptId} className="flex justify-between gap-2">
                <span>{r.examTitle}</span>
                <span className="font-semibold">
                  {r.status === 'SUBMITTED' && r.score != null
                    ? `${r.score} / ${r.totalMarks}`
                    : r.status === 'TIMED_OUT'
                      ? 'Timed out'
                      : 'Being marked'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Classwork">
        {work.isLoading ? (
          <LoadingState />
        ) : (work.data ?? []).length === 0 ? (
          <p className="text-sm text-fg-muted">No classwork submitted yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {work.data!.slice(0, 8).map((s) => (
              <li key={s.id}>
                <div className="flex items-center justify-between gap-2">
                  <span>Submitted {formatDate(s.submittedAt)}</span>
                  {s.graded ? (
                    <Badge tone="success">Score {s.score}</Badge>
                  ) : (
                    <Badge tone="info">Waiting for marking</Badge>
                  )}
                </div>
                {s.feedback && <p className="mt-1 text-fg-muted">Teacher: {s.feedback}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Attendance">
        {attendance.isLoading ? (
          <LoadingState />
        ) : !attendance.data || attendance.data.sessionsMarked === 0 ? (
          <p className="text-sm text-fg-muted">No attendance recorded yet.</p>
        ) : (
          <>
            <p className="text-2xl font-bold">{attendance.data.attendanceRate}%</p>
            <p className="mb-2 text-xs text-fg-muted">over {attendance.data.sessionsMarked} school days</p>
            <ul className="space-y-1 text-sm">
              {attendance.data.records.slice(0, 6).map((r, i) => (
                <li key={i} className="flex justify-between">
                  <span>{formatDate(r.date)}</span>
                  <span className="font-medium">{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
