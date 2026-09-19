'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { examAPI } from '@/lib/api';
import { Clock, FileText } from 'lucide-react';

interface ExamRow {
  id: number;
  title: string;
  subject: string;
  description?: string | null;
  durationMinutes: number;
  questionCount: number;
  totalMarks: number;
}

interface ExamQuestion {
  id: number;
  question: string;
  qtype: string;
  options: (string | null)[];
  marks: number;
}

interface StartResponse {
  attemptId: number;
  examId: number;
  expiresAt: string;
  remainingSeconds: number;
  questions: ExamQuestion[];
  savedAnswers: Record<string, string>;
}

interface ResultRow {
  attemptId: number;
  examTitle: string;
  status: string;
  score: number | null;
  totalMarks: number;
}

interface BreakdownRow {
  questionId: number;
  question: string;
  qtype: string;
  studentAnswer: string | null;
  correct: boolean | null;
  marksAwarded: number | null;
  marksPossible: number;
  feedback?: string | null;
}

interface ResultDetail {
  attemptId: number;
  examTitle: string;
  status: string;
  score: number | null;
  totalMarks: number;
  breakdown: BreakdownRow[];
}


export default function StudentExams() {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState<StartResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState<{ score: number | null; totalMarks: number } | null>(null);
  const [fullscreenHint, setFullscreenHint] = useState(false);
  const [resultDetail, setResultDetail] = useState<ResultDetail | null>(null);

  const attemptRef = useRef<StartResponse | null>(null);
  attemptRef.current = attempt;

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([examAPI.available(), examAPI.myResults()])
      .then(([a, r]) => { setExams(a.data || []); setResults(r.data || []); })
      .catch(() => setError('Could not load exams. Please retry.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Server-authoritative countdown ────────────────────────────────────────
  // The backend owns expiry; this timer is display-only and re-syncs from the
  // server response. Submission past expiry is rejected server-side.
  useEffect(() => {
    if (!attempt) return;
    const tick = () => setRemaining(Math.max(0, Math.round((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [attempt]);

  // ── Integrity monitoring (advisory, layered — never an auto-fail) ─────────
  useEffect(() => {
    if (!attempt) return;
    const report = (eventType: string, detail?: string) => {
      examAPI.integrityEvent(attempt.attemptId, eventType, detail).catch(() => { /* best effort */ });
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') report('TAB_HIDDEN'); };
    const onBlur = () => report('WINDOW_BLURRED');
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        report('FULLSCREEN_EXITED');
        setFullscreenHint(true);
      } else {
        setFullscreenHint(false);
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    const onOffline = () => report('NETWORK_LOST');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFsChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('offline', onOffline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('offline', onOffline);
    };
  }, [attempt]);

  const startExam = async (exam: ExamRow) => {
    setError('');
    try {
      const res = await examAPI.start(exam.id);
      const started = res.data as StartResponse;
      setAttempt(started);
      setAnswers(Object.fromEntries(
        Object.entries((started.savedAnswers || {}) as Record<string, string>).map(([k, v]) => [Number(k), String(v)])
      ));
      setFinished(null);
      setRemaining(started.remainingSeconds);
      // Offer fullscreen exam mode (best-effort; browser lockdown is not absolute).
      document.documentElement.requestFullscreen?.().catch(() => { /* user may refuse */ });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Could not start the exam.');
    }
  };

  // ── Autosave (debounced per question) ─────────────────────────────────────
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const setAnswer = (questionId: number, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    if (!attemptRef.current) return;
    const attemptId = attemptRef.current.attemptId;
    clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = setTimeout(() => {
      examAPI.saveAnswer(attemptId, questionId, value).catch(() => { /* retried on submit */ });
    }, 600);
  };

  const submit = async () => {
    if (!attemptRef.current || submitting) return;
    setSubmitting(true);
    setError('');
    const payload = Object.entries(answers).map(([q, a]) => ({ questionId: Number(q), answer: a || null }));
    try {
      const res = await examAPI.submit(attemptRef.current.attemptId, payload);
      setFinished({ score: res.data.score, totalMarks: res.data.totalMarks });
      document.exitFullscreen?.().catch(() => { /* noop */ });
      setAttempt(null);
      setAnswers({});
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Submission failed. Your answers are saved — try again.');
      // If the attempt was finalized server-side (e.g. timed out), drop back to list.
      const code = (e as { response?: { status?: number } })?.response?.status;
      if (code === 409) { setAttempt(null); load(); }
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-submit when the server-side window closes. `submit` closes over the
  // current attempt/answers; rerunning on its identity change would double-fire,
  // so it is intentionally excluded from the dependency list.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  useEffect(() => {
    if (attempt && remaining === 0 && !submitting) { void submit(); }
  }, [remaining, attempt, submitting]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const openResult = async (attemptId: number) => {
    setError('');
    try {
      const res = await examAPI.resultDetail(attemptId);
      setResultDetail(res.data as ResultDetail);
    } catch {
      setError('Could not load the result.');
    }
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-purple-200">My Exams</h1>

        {error && (
          <div role="alert" className="bg-red-500/20 border border-red-500/40 text-red-200 rounded-lg p-3 text-sm">{error}</div>
        )}

        {finished && (
          <div className="glass-card p-6 text-center">
            <p className="text-lg text-purple-100 font-semibold">Exam submitted</p>
            <p className="text-purple-300 mt-1">Score: {finished.score ?? '—'} / {finished.totalMarks}</p>
            <p className="text-purple-400 text-sm mt-2">Short-answer questions are marked by your teacher.</p>
          </div>
        )}

        {attempt ? (
          <div className="space-y-4">
            <div className="glass-card p-4 flex items-center justify-between sticky top-2 z-10">
              <span className="text-purple-200 flex items-center gap-2"><Clock size={18} /> Time left: <span className="font-mono font-bold">{fmt(remaining)}</span></span>
              <button onClick={submit} disabled={submitting}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg">
                {submitting ? 'Submitting…' : 'Submit exam'}
              </button>
            </div>
            {fullscreenHint && (
              <div className="bg-yellow-500/20 border border-yellow-500/40 text-yellow-100 rounded-lg p-3 text-sm">
                Exam mode exited fullscreen. This event has been recorded for review.
              </div>
            )}
            {attempt.questions.map((q, idx) => (
              <div key={q.id} className="glass-card p-4 space-y-2">
                <p className="text-purple-100 font-medium">{idx + 1}. {q.question} <span className="text-purple-400 text-sm">({q.marks} mark{q.marks > 1 ? 's' : ''})</span></p>
                {q.qtype === 'MCQ' && (
                  <div className="grid gap-2">
                    {q.options.filter(Boolean).map((opt, oi) => {
                      const letter = String.fromCharCode(65 + oi);
                      return (
                        <label key={oi} className="flex items-center gap-2 text-purple-100 cursor-pointer">
                          <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === letter} onChange={() => setAnswer(q.id, letter)} />
                          <span><span className="font-semibold">{letter}.</span> {opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {q.qtype === 'TRUE_FALSE' && (
                  <div className="flex gap-4">
                    {['A', 'B'].map((letter, i) => (
                      <label key={letter} className="flex items-center gap-2 text-purple-100 cursor-pointer">
                        <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === letter} onChange={() => setAnswer(q.id, letter)} />
                        <span>{i === 0 ? 'True' : 'False'}</span>
                      </label>
                    ))}
                  </div>
                )}
                {q.qtype === 'SHORT_ANSWER' && (
                  <input className="w-full bg-purple-900/40 border border-purple-500/30 rounded-lg px-3 py-2 text-purple-100"
                    placeholder="Type your answer" value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)} />
                )}
              </div>
            ))}
          </div>
        ) : loading ? (
          <p className="text-purple-300">Loading…</p>
        ) : exams.length === 0 && results.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <FileText size={48} className="text-purple-400 mx-auto mb-4" />
            <p className="text-purple-200">No exams available right now.</p>
          </div>
        ) : (
          <>
            {exams.length > 0 && (
              <div className="grid gap-3">
                {exams.map(exam => (
                  <div key={exam.id} className="glass-card p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-purple-100">{exam.title}</p>
                      <p className="text-sm text-purple-300">{exam.subject} · {exam.questionCount} questions · {exam.totalMarks} marks · {exam.durationMinutes} min</p>
                      {exam.description && <p className="text-sm text-purple-300 mt-1">{exam.description}</p>}
                    </div>
                    <button onClick={() => startExam(exam)} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg">
                      Start exam
                    </button>
                  </div>
                ))}
              </div>
            )}
            {results.length > 0 && (
              <div className="glass-card p-4">
                <h2 className="font-semibold text-purple-100 mb-2">Past results</h2>
                <ul className="space-y-1 text-sm text-purple-200">
                  {results.map(r => (
                    <li key={r.attemptId} className="flex justify-between items-center border-b border-purple-500/10 py-1">
                      <button className="underline text-left" onClick={() => openResult(r.attemptId)}>{r.examTitle}</button>
                      <span>{r.status === 'SUBMITTED' && r.score != null ? `${r.score} / ${r.totalMarks}` : r.status === 'TIMED_OUT' ? 'Timed out' : 'Marking…'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {resultDetail && (
          <div className="glass-card p-6 space-y-3" role="dialog" aria-label={`Result for ${resultDetail.examTitle}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-purple-100">{resultDetail.examTitle} — {resultDetail.score ?? '—'} / {resultDetail.totalMarks}</h2>
              <button onClick={() => setResultDetail(null)} className="text-purple-300">Close</button>
            </div>
            {resultDetail.breakdown.map(b => (
              <div key={b.questionId} className="border border-purple-500/20 rounded-lg p-3">
                <p className="text-purple-100 text-sm">{b.question}</p>
                <p className="text-purple-300 text-sm mt-1">
                  Your answer: <span className="text-purple-100">{b.studentAnswer || '—'}</span>
                  {' · '}
                  {b.qtype === 'SHORT_ANSWER'
                    ? (b.marksAwarded != null ? `${b.marksAwarded}/${b.marksPossible} (teacher marked)` : 'Awaiting teacher marking')
                    : (b.correct ? `Correct · ${b.marksAwarded ?? 0}/${b.marksPossible}` : `Not correct · 0/${b.marksPossible}`)}
                </p>
                {b.feedback && <p className="text-purple-200 text-sm mt-1 italic">Teacher: {b.feedback}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
