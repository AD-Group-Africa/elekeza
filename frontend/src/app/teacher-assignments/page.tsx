'use client';

/**
 * Assignments — teacher/school-admin view.
 *
 * Create assignments for a class, see submission progress per assignment,
 * open submissions and grade them with feedback. Authorization is enforced
 * server-side; this UI only mirrors the same boundaries for early feedback.
 */

import { useCallback, useEffect, useState } from 'react';
import { attendanceAPI, assignmentsAPI, type ClassInfo, type AssignmentInfo, type SubmissionInfo } from '@/lib/api';

export default function TeacherAssignmentsPage() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<AssignmentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // create form
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [points, setPoints] = useState('100');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  // grading panel
  const [openAssignmentId, setOpenAssignmentId] = useState<number | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionInfo[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [scores, setScores] = useState<Record<number, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<number, string>>({});

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

  const loadAssignments = useCallback(async (cid: number) => {
    try {
      const res = await assignmentsAPI.classAssignments(cid);
      setAssignments(res.data);
    } catch {
      setAssignments([]);
      setMessage({ tone: 'error', text: 'Could not load assignments for this class.' });
    }
  }, []);

  useEffect(() => {
    if (classId != null) loadAssignments(classId);
  }, [classId, loadAssignments]);

  const create = async () => {
    if (classId == null) return;
    if (!title.trim()) {
      setMessage({ tone: 'error', text: 'Give the assignment a title.' });
      return;
    }
    setCreating(true);
    setMessage(null);
    try {
      await assignmentsAPI.create({
        classId,
        title,
        instructions: instructions || undefined,
        dueDate: dueDate || undefined,
        points: Number(points) || 100,
      });
      setTitle(''); setInstructions(''); setDueDate(''); setPoints('100');
      setMessage({ tone: 'ok', text: 'Assignment created and published to the class.' });
      await loadAssignments(classId);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setMessage({
        tone: 'error',
        text: status === 403 ? 'Not authorized for this class.' : 'Could not create the assignment. Please try again.',
      });
    } finally {
      setCreating(false);
    }
  };

  const openSubmissions = async (assignmentId: number) => {
    if (openAssignmentId === assignmentId) { setOpenAssignmentId(null); return; }
    setOpenAssignmentId(assignmentId);
    setSubsLoading(true);
    try {
      const res = await assignmentsAPI.submissions(assignmentId);
      setSubmissions(res.data);
    } catch {
      setSubmissions([]);
      setMessage({ tone: 'error', text: 'Could not load submissions.' });
    } finally {
      setSubsLoading(false);
    }
  };

  const grade = async (a: AssignmentInfo, s: SubmissionInfo) => {
    const raw = scores[s.id];
    const score = Number(raw);
    if (raw === undefined || raw === '' || Number.isNaN(score) || score < 0 || score > a.points) {
      setMessage({ tone: 'error', text: `Score must be between 0 and ${a.points}.` });
      return;
    }
    setMessage(null);
    try {
      const res = await assignmentsAPI.grade(s.id, score, feedbacks[s.id] || undefined);
      setSubmissions((rows) => rows.map((r) => (r.id === s.id ? res.data : r)));
      setMessage({ tone: 'ok', text: `Graded ${s.learnerName ?? 'learner'}: ${score}/${a.points}.` });
      await loadAssignments(a.classId);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setMessage({ tone: 'error', text: status === 400 ? 'Score out of range.' : 'Could not save the grade. Please try again.' });
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Assignments</h1>
      <p className="text-gray-600 mb-6">Create work for your classes and grade what learners submit.</p>

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

      <section aria-label="Create assignment" className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold mb-3">New assignment</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium sm:col-span-2">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Fractions practice set 2"
            />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Instructions
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              maxLength={10000}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="What should learners do? Keep it clear and short."
            />
          </label>
          <label className="text-sm font-medium">
            Due date
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <label className="text-sm font-medium">
            Points
            <input
              type="number"
              min={1}
              max={1000}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Class
            <select
              value={classId ?? ''}
              onChange={(e) => setClassId(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {classes.length === 0 && <option value="">No classes yet</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.learnerCount} learners)</option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={creating || classId == null}
          className="mt-4 rounded-xl bg-emerald-600 px-6 py-2.5 font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create assignment'}
        </button>
      </section>

      {loading ? (
        <p className="py-8 text-center text-gray-500" role="status">Loading…</p>
      ) : assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
          No assignments for this class yet — create the first one above.
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Class assignments">
          {assignments.map((a) => (
            <li key={a.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold">{a.title}</h3>
                  <p className="text-sm text-gray-600">
                    {a.dueDate ? `Due ${a.dueDate}` : 'No due date'} · {a.points} points ·{' '}
                    {a.gradedCount}/{a.submissionCount || 0} graded
                    {a.submissionCount > 0 ? ` (${a.submissionCount} submitted)` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openSubmissions(a.id)}
                  aria-expanded={openAssignmentId === a.id}
                  className="shrink-0 text-sm font-medium text-emerald-700 underline underline-offset-2 hover:no-underline"
                >
                  {openAssignmentId === a.id ? 'Close submissions' : 'View submissions'}
                </button>
              </div>

              {openAssignmentId === a.id && (
                <div className="mt-3">
                  {subsLoading ? (
                    <p className="text-sm text-gray-500" role="status">Loading submissions…</p>
                  ) : submissions.length === 0 ? (
                    <p className="text-sm text-gray-500">No submissions yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {submissions.map((s) => (
                        <li key={s.id} className="rounded-lg border border-gray-200 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="font-medium text-sm">{s.learnerName ?? `Learner ${s.learnerId}`}</span>
                            {s.graded ? (
                              <span className="text-xs font-semibold text-emerald-800">
                                {s.score}/{a.points} · {s.feedback ?? 'no feedback'}
                              </span>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="sr-only" htmlFor={`score-${s.id}`}>Score for {s.learnerName}</label>
                                <input
                                  id={`score-${s.id}`}
                                  type="number"
                                  min={0}
                                  max={a.points}
                                  value={scores[s.id] ?? ''}
                                  onChange={(e) => setScores((m) => ({ ...m, [s.id]: e.target.value }))}
                                  placeholder={`0–${a.points}`}
                                  className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <label className="sr-only" htmlFor={`fb-${s.id}`}>Feedback for {s.learnerName}</label>
                                <input
                                  id={`fb-${s.id}`}
                                  value={feedbacks[s.id] ?? ''}
                                  onChange={(e) => setFeedbacks((m) => ({ ...m, [s.id]: e.target.value }))}
                                  maxLength={2000}
                                  placeholder="Feedback (optional)"
                                  className="w-full sm:w-56 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => grade(a, s)}
                                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                                >
                                  Save grade
                                </button>
                              </div>
                            )}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{s.content}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
