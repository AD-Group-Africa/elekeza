'use client';

/**
 * Assignments — learner view.
 *
 * Shows the learner's published assignments, lets them submit (and
 * resubmit — the server updates the existing submission), and displays
 * graded feedback. Learner-facing language: plain, encouraging, no jargon.
 */

import { useCallback, useEffect, useState } from 'react';
import { assignmentsAPI, type AssignmentInfo, type SubmissionInfo } from '@/lib/api';

function dueLabel(due: string | null): string {
  if (!due) return 'No due date';
  const dueDate = new Date(due + 'T23:59:59');
  const days = Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `Was due ${due}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

export default function LearnerAssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentInfo[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, s] = await Promise.all([
        assignmentsAPI.mine(),
        assignmentsAPI.mySubmissions(),
      ]);
      setAssignments(a.data);
      setSubmissions(s.data);
    } catch {
      setMessage({ tone: 'error', text: 'Could not load your assignments. Please refresh to try again.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submissionFor = (id: number) => submissions.find((s) => s.assignmentId === id) ?? null;

  const toggle = (a: AssignmentInfo) => {
    if (openId === a.id) { setOpenId(null); return; }
    setOpenId(a.id);
    const sub = submissionFor(a.id);
    setDraft(sub?.content ?? '');
    setMessage(null);
  };

  const submit = async (a: AssignmentInfo) => {
    if (!draft.trim()) {
      setMessage({ tone: 'error', text: 'Write your answer first.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await assignmentsAPI.submit(a.id, draft);
      setSubmissions((rows) => [res.data, ...rows.filter((s) => s.assignmentId !== a.id)]);
      setMessage({ tone: 'ok', text: 'Submitted! Your teacher can now see your work.' });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setMessage({
        tone: 'error',
        text: status === 403 ? 'You are not enrolled in this class.'
          : status === 400 ? 'This assignment is not open for submissions.'
          : 'Could not submit. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">My assignments</h1>
      <p className="text-gray-600 mb-6">Work set by your teachers. Take your time — you can always improve your answer.</p>

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
        <p className="py-8 text-center text-gray-500" role="status">Loading…</p>
      ) : assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
          No assignments right now. Enjoy the breather — new work will appear here.
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Assignments">
          {assignments.map((a) => {
            const sub = submissionFor(a.id);
            const open = openId === a.id;
            return (
              <li key={a.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-semibold">{a.title}</h2>
                    <p className="text-sm text-gray-600">
                      {a.className ?? 'Class'} · {dueLabel(a.dueDate)} · {a.points} points
                    </p>
                  </div>
                  {sub?.graded ? (
                    <span className="shrink-0 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                      Graded: {sub.score}/{a.points}
                    </span>
                  ) : sub ? (
                    <span className="shrink-0 rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                      Submitted
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      To do
                    </span>
                  )}
                </div>

                {a.instructions && <p className="mt-2 text-sm text-gray-700">{a.instructions}</p>}
                {sub?.feedback && (
                  <p className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-900">
                    Teacher feedback: {sub.feedback}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => toggle(a)}
                  aria-expanded={open}
                  className="mt-3 text-sm font-medium text-emerald-700 underline underline-offset-2 hover:no-underline"
                >
                  {open ? 'Close' : sub ? 'Improve my answer' : 'Open and answer'}
                </button>

                {open && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium" htmlFor={`answer-${a.id}`}>
                      Your answer
                    </label>
                    <textarea
                      id={`answer-${a.id}`}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={5}
                      maxLength={20000}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Write your answer here…"
                    />
                    <button
                      type="button"
                      onClick={() => submit(a)}
                      disabled={saving}
                      className="mt-2 rounded-xl bg-emerald-600 px-6 py-2.5 font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-50"
                    >
                      {saving ? 'Submitting…' : sub ? 'Update my answer' : 'Submit'}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
