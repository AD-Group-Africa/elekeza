'use client';

/**
 * Attendance register — teacher/school-admin tool.
 *
 * Flow: pick class → pick date → mark each learner → save → see counts.
 * Read-only history is available for any learner via the drilldown panel.
 * Keyboard-friendly: status buttons are real radios; save is a single POST.
 */

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { attendanceAPI, type ClassInfo, type RosterEntry, type LearnerAttendance } from '@/lib/api';

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

export default function AttendancePage() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [date, setDate] = useState(todayISO());
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [history, setHistory] = useState<LearnerAttendance | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await attendanceAPI.classes();
        if (!live) return;
        setClasses(res.data);
        if (res.data.length > 0) setClassId(res.data[0].id);
      } catch {
        if (live) setMessage({ tone: 'error', text: 'Could not load classes. Please refresh to try again.' });
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);

  const loadRoster = useCallback(async (cid: number, d: string) => {
    setLoading(true);
    setMessage(null);
    setHistory(null);
    try {
      const res = await attendanceAPI.roster(cid, d);
      setRoster(res.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setRoster([]);
      setMessage({
        tone: 'error',
        text: status === 403
          ? 'You are not authorized for this class.'
          : 'Could not load the register. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (classId != null) loadRoster(classId, date);
  }, [classId, date, loadRoster]);

  const setStatus = (learnerId: number, status: string) => {
    setRoster((rows) =>
      rows.map((r) => (r.learnerId === learnerId ? { ...r, status } : r))
    );
  };

  const save = async () => {
    if (classId == null) return;
    const unmarked = roster.filter((r) => !r.status);
    if (unmarked.length > 0) {
      setMessage({ tone: 'error', text: `Mark every learner first (${unmarked.length} left).` });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await attendanceAPI.save(
        classId,
        date,
        roster.map((r) => ({ learnerId: r.learnerId, status: r.status!, note: r.note ?? undefined }))
      );
      const c = res.data.counts;
      setMessage({
        tone: 'ok',
        text: `Saved. Present ${c.PRESENT ?? 0} · Absent ${c.ABSENT ?? 0} · Late ${c.LATE ?? 0} · Excused ${c.EXCUSED ?? 0}`,
      });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setMessage({
        tone: 'error',
        text: status === 403 ? 'Not authorized.' : status === 400 ? 'Some entries were invalid — check the register.' : 'Save failed. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (learnerId: number) => {
    try {
      const res = await attendanceAPI.learnerHistory(learnerId);
      setHistory(res.data);
    } catch {
      setMessage({ tone: 'error', text: 'Could not load attendance history.' });
    }
  };

  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = roster.filter((r) => r.status === s).length;
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Attendance</h1>
      <p className="text-gray-600 mb-6">Mark the daily register for your class.</p>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end mb-6">
        <label className="flex-1 text-sm font-medium">
          Class
          <select
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={classId ?? ''}
            onChange={(e) => setClassId(Number(e.target.value))}
          >
            {classes.length === 0 && <option value="">No classes yet</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.learnerCount} learners)</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Date
          <input
            type="date"
            className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      {message && (
        <div
          role="status"
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            message.tone === 'ok'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-rose-300 bg-rose-50 text-rose-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-gray-500" role="status">Loading register…</p>
      ) : roster.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
          {classes.length === 0
            ? 'No classes have been created for your school yet. An administrator can create them via the seed or API.'
            : 'No learners are enrolled in this class yet.'}
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
              <li key={r.learnerId} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.learnerName}</span>
                    <button
                      type="button"
                      className="text-xs text-emerald-700 underline underline-offset-2 hover:no-underline"
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
                        aria-checked={r.status === s}
                        onClick={() => setStatus(r.learnerId, s)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                          r.status === s ? STATUS_TONE[s] : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
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
            <button
              type="button"
              onClick={save}
              disabled={saving || roster.length === 0}
              className="w-full sm:w-auto rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save register'}
            </button>
          </div>
        </>
      )}

      {history && (
        <section aria-label="Attendance history" className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h2 className="font-semibold">{history.learnerName} — history</h2>
              <p className="text-sm text-gray-600">
                {history.className ?? 'No class'} · attendance rate {history.attendanceRate}% over {history.sessionsMarked} days
              </p>
            </div>
            <button type="button" onClick={() => setHistory(null)} className="text-sm text-gray-500 underline">Close</button>
          </div>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {Object.entries(history.counts).map(([k, v]) => (
              <span key={k} className={`rounded-full border px-3 py-1 font-medium ${STATUS_TONE[k] ?? 'border-gray-300'}`}>{k}: {v}</span>
            ))}
          </div>
          {history.records.length === 0 ? (
            <p className="text-sm text-gray-500">No attendance recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Attendance records for {history.learnerName}</caption>
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th scope="col" className="py-1.5 pr-3 font-medium">Date</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Class</th>
                  <th scope="col" className="py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.records.slice(0, 20).map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">{row.date}</td>
                    <td className="py-1.5 pr-3">{row.className}</td>
                    <td className="py-1.5">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[row.status] ?? 'border-gray-300'}`}>
                        {row.status}
                      </span>
                      {row.note ? <span className="ml-2 text-xs text-gray-500">{row.note}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </main>
  );
}
