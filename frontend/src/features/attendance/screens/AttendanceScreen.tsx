'use client';

/**
 * Attendance register — teacher/school-admin tool.
 *
 * Flow: pick class → pick date → mark each learner → save → see counts.
 * Read-only history is available for any learner via the drilldown panel.
 * Keyboard-friendly: status buttons are real radios; save is a single POST.
 */

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Field, LoadingState, PageHeader, Select, TextInput } from '@/components/ui';
import { getErrorStatus } from '@/lib/api';
import { learnerCountLabel } from '@/lib/pluralize';
import { cn } from '@/lib/cn';
import { attendanceApi, attendanceKeys, useClasses, type LearnerAttendance, type RosterEntry } from '../api';
import { useAuth } from '@/features/auth';
import { formatDate } from '@/lib/format';
import { SchoolAttendanceSummary } from '../components/SchoolAttendanceSummary';

const STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;

const STATUS_TONE: Record<string, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  ABSENT: 'bg-rose-100 text-rose-800 border-rose-300',
  LATE: 'bg-amber-100 text-amber-800 border-amber-300',
  EXCUSED: 'bg-sky-100 text-sky-800 border-sky-300',
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Message = { tone: 'success' | 'error'; text: string } | null;

export default function AttendanceScreen() {
  const role = useAuth().user?.role;
  const isSchoolAdmin = role === 'SCHOOL_ADMIN' || role === 'ADMIN';
  const queryClient = useQueryClient();
  const classesQuery = useClasses();
  const classes = classesQuery.data ?? [];
  const [chosenClassId, setChosenClassId] = useState<number | null>(null);
  const classId = chosenClassId ?? classes[0]?.id ?? null;
  const [date, setDate] = useState(todayISO);
  const [message, setMessage] = useState<Message>(null);
  const [history, setHistory] = useState<LearnerAttendance | null>(null);

  const rosterQuery = useQuery({
    queryKey: attendanceKeys.roster(classId ?? 0, date),
    queryFn: () => attendanceApi.roster(classId!, date),
    enabled: classId != null,
  });
  const roster = rosterQuery.data ?? [];

  // Unsaved marks for the register currently on screen.
  const rosterKey = `${classId}|${date}`;
  const [edits, setEdits] = useState<{ key: string; marks: Record<number, string> }>({ key: '', marks: {} });
  const marks = edits.key === rosterKey ? edits.marks : {};
  const statusOf = (r: RosterEntry) => marks[r.learnerId] ?? r.status;
  const setStatus = (learnerId: number, status: string) =>
    setEdits((prev) => ({
      key: rosterKey,
      marks: { ...(prev.key === rosterKey ? prev.marks : {}), [learnerId]: status },
    }));

  const save = useMutation({
    mutationFn: () =>
      attendanceApi.save(
        classId!,
        date,
        roster.map((r) => ({ learnerId: r.learnerId, status: statusOf(r)!, note: r.note ?? undefined })),
      ),
    onSuccess: async (session) => {
      const c = session.counts;
      setMessage({
        tone: 'success',
        text: `Saved. Present ${c.PRESENT ?? 0} · Absent ${c.ABSENT ?? 0} · Late ${c.LATE ?? 0} · Excused ${c.EXCUSED ?? 0}`,
      });
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.roster(classId!, date) });
    },
    onError: (err) => {
      const status = getErrorStatus(err);
      setMessage({
        tone: 'error',
        text:
          status === 403
            ? 'Not authorized.'
            : status === 400
              ? 'Some entries were invalid — check the register.'
              : 'Save failed. Please try again.',
      });
    },
  });

  const onSave = () => {
    if (classId == null) return;
    const unmarked = roster.filter((r) => !statusOf(r));
    if (unmarked.length > 0) {
      setMessage({ tone: 'error', text: `Mark every learner first (${unmarked.length} left).` });
      return;
    }
    setMessage(null);
    save.mutate();
  };

  const changeRegister = (next: { classId?: number; date?: string }) => {
    setMessage(null);
    setHistory(null);
    if (next.classId !== undefined) setChosenClassId(next.classId);
    if (next.date !== undefined) setDate(next.date);
  };

  const openHistory = async (learnerId: number) => {
    try {
      setHistory(await attendanceApi.learnerHistory(learnerId));
    } catch {
      setMessage({ tone: 'error', text: 'Could not load attendance history.' });
    }
  };

  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = roster.filter((r) => statusOf(r) === s).length;
    return acc;
  }, {});

  const loadError = classesQuery.isError
    ? 'Could not load classes. Please refresh to try again.'
    : rosterQuery.isError
      ? getErrorStatus(rosterQuery.error) === 403
        ? 'You are not authorized for this class.'
        : 'Could not load the register. Please try again.'
      : null;
  const loading = classesQuery.isLoading || rosterQuery.isLoading;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Attendance" description="Mark the daily register for your class." />
      {isSchoolAdmin && <SchoolAttendanceSummary />}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field id="attendance-class" label="Class" className="flex-1">
          <Select
            id="attendance-class"
            value={classId ?? ''}
            onChange={(e) => changeRegister({ classId: Number(e.target.value) })}
          >
            {classes.length === 0 && <option value="">No classes yet</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({learnerCountLabel(c.learnerCount)})
              </option>
            ))}
          </Select>
        </Field>
        <Field id="attendance-date" label="Date">
          <TextInput
            id="attendance-date"
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => changeRegister({ date: e.target.value })}
          />
        </Field>
      </div>

      {loadError && (
        <Alert tone="error" className="mb-4">
          {loadError}
        </Alert>
      )}
      {message && (
        <Alert tone={message.tone} className="mb-4">
          {message.text}
        </Alert>
      )}

      {loading ? (
        <LoadingState label="Loading register…" />
      ) : roster.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong p-8 text-center text-fg-muted">
          {classes.length === 0
            ? 'No classes have been created for your school yet.'
            : 'No learners are enrolled in this class yet.'}{' '}
          <Link href="/classes" className="font-semibold text-accent underline">
            {classes.length === 0 ? 'Set up classes' : 'Add learners to this class'}
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2 text-xs" aria-live="polite">
            {STATUSES.map((s) => (
              <span key={s} className={`rounded-full border px-3 py-1 font-medium ${STATUS_TONE[s]}`}>
                {s}: {counts[s]}
              </span>
            ))}
          </div>

          <ul className="space-y-2" aria-label="Attendance register">
            {roster.map((r) => (
              <li key={r.learnerId} className="rounded-xl border border-line bg-surface p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-fg">{r.learnerName}</span>
                    <button
                      type="button"
                      className="text-xs text-accent-strong underline underline-offset-2 hover:no-underline"
                      onClick={() => openHistory(r.learnerId)}
                    >
                      History
                    </button>
                  </div>
                  <div role="radiogroup" aria-label={`Status for ${r.learnerName}`} className="flex flex-wrap gap-1">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={statusOf(r) === s}
                        onClick={() => setStatus(r.learnerId, s)}
                        className={cn(
                          'rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                          statusOf(r) === s
                            ? STATUS_TONE[s]
                            : 'border-line bg-surface text-fg-muted hover:bg-surface-hover',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5">
            <Button
              size="lg"
              onClick={onSave}
              loading={save.isPending}
              disabled={roster.length === 0}
              className="w-full sm:w-auto"
            >
              {save.isPending ? 'Saving…' : 'Save register'}
            </Button>
          </div>
        </>
      )}

      {history && <AttendanceHistory history={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

function AttendanceHistory({ history, onClose }: { history: LearnerAttendance; onClose: () => void }) {
  return (
    <Card padding="lg" className="mt-8" role="region" aria-label="Attendance history">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-fg">{history.learnerName} — history</h2>
          <p className="text-sm text-fg-muted">
            {history.className ?? 'No class'} · attendance rate {history.attendanceRate}% over {history.sessionsMarked}{' '}
            days
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-fg-muted underline">
          Close
        </button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {Object.entries(history.counts).map(([k, v]) => (
          <span key={k} className={`rounded-full border px-3 py-1 font-medium ${STATUS_TONE[k] ?? 'border-line'}`}>
            {k}: {v}
          </span>
        ))}
      </div>
      {history.records.length === 0 ? (
        <p className="text-sm text-fg-subtle">No attendance recorded yet.</p>
      ) : (
        <table className="w-full text-sm text-fg">
          <caption className="sr-only">Attendance records for {history.learnerName}</caption>
          <thead>
            <tr className="border-b border-line text-left text-fg-muted">
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Date
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Class
              </th>
              <th scope="col" className="py-1.5 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {history.records.slice(0, 20).map((row, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="py-1.5 pr-3">{formatDate(row.date)}</td>
                <td className="py-1.5 pr-3">{row.className}</td>
                <td className="py-1.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[row.status] ?? 'border-line'}`}
                  >
                    {row.status}
                  </span>
                  {row.note ? <span className="ml-2 text-xs text-fg-subtle">{row.note}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
