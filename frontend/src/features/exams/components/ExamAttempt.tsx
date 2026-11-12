'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { Alert, Button, Card, TextInput } from '@/components/ui';
import { getErrorMessage, getErrorStatus } from '@/lib/api';
import { examApi, type StartedAttempt } from '../api';

const formatClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const secondsUntil = (iso: string) => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));

/**
 * A running exam attempt: server-authoritative countdown, debounced autosave
 * per answer, advisory integrity signals (never an auto-fail) and submit.
 * Auto-submits when the server-side window closes.
 */
export function ExamAttempt({
  attempt,
  onFinished,
  onAbandoned,
}: {
  attempt: StartedAttempt;
  onFinished: (result: { score: number | null; totalMarks: number }) => void;
  /** The attempt was finalised server-side (e.g. timed out) — leave the attempt view. */
  onAbandoned: (message: string) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>(() =>
    Object.fromEntries(Object.entries(attempt.savedAnswers || {}).map(([k, v]) => [Number(k), String(v)])),
  );
  const [remaining, setRemaining] = useState(attempt.remainingSeconds);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fullscreenHint, setFullscreenHint] = useState(false);
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const submittedRef = useRef(false);

  // Display-only countdown that re-syncs from the server's expiry; the server
  // rejects late submissions regardless.
  useEffect(() => {
    const iv = setInterval(() => setRemaining(secondsUntil(attempt.expiresAt)), 1000);
    return () => clearInterval(iv);
  }, [attempt.expiresAt]);

  // Integrity monitoring (advisory, layered — never an auto-fail).
  useEffect(() => {
    const report = (eventType: string) => {
      examApi.integrityEvent(attempt.attemptId, eventType).catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') report('TAB_HIDDEN');
    };
    const onBlur = () => report('WINDOW_BLURRED');
    const onFsChange = () => {
      const exited = !document.fullscreenElement;
      if (exited) report('FULLSCREEN_EXITED');
      setFullscreenHint(exited);
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
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
  }, [attempt.attemptId]);

  const setAnswer = (questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = setTimeout(() => {
      examApi.saveAnswer(attempt.attemptId, questionId, value).catch(() => {
        /* re-sent on submit */
      });
    }, 600);
  };

  const submit = async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError('');
    const payload = Object.entries(answers).map(([q, a]) => ({ questionId: Number(q), answer: a || null }));
    try {
      const res = await examApi.submit(attempt.attemptId, payload);
      document.exitFullscreen?.().catch(() => undefined);
      onFinished(res);
    } catch (e) {
      submittedRef.current = false;
      const message = getErrorMessage(e, 'Submission failed. Your answers are saved — try again.');
      if (getErrorStatus(e) === 409) onAbandoned(message);
      else setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-submit when time runs out.
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    if (remaining === 0) void submitRef.current();
  }, [remaining]);

  return (
    <div className="space-y-4">
      <Card className="sticky top-2 z-10 flex items-center justify-between">
        <span className="flex items-center gap-2 text-purple-200">
          <Clock size={18} aria-hidden="true" /> Time left:{' '}
          <span className="font-mono font-bold">{formatClock(remaining)}</span>
        </span>
        <Button variant="success" onClick={submit} loading={submitting}>
          {submitting ? 'Submitting…' : 'Submit exam'}
        </Button>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}
      {fullscreenHint && (
        <Alert tone="warning">Exam mode exited fullscreen. This event has been recorded for review.</Alert>
      )}

      {attempt.questions.map((q, idx) => (
        <Card key={q.id} className="space-y-2">
          <p className="font-medium text-purple-100" id={`q-${q.id}-label`}>
            {idx + 1}. {q.question}{' '}
            <span className="text-sm text-purple-400">
              ({q.marks} mark{q.marks > 1 ? 's' : ''})
            </span>
          </p>
          {q.qtype === 'MCQ' && (
            <div className="grid gap-2" role="radiogroup" aria-labelledby={`q-${q.id}-label`}>
              {q.options.filter(Boolean).map((opt, oi) => {
                const letter = String.fromCharCode(65 + oi);
                return (
                  <label key={oi} className="flex cursor-pointer items-center gap-2 text-purple-100">
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={answers[q.id] === letter}
                      onChange={() => setAnswer(q.id, letter)}
                    />
                    <span>
                      <span className="font-semibold">{letter}.</span> {opt}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {q.qtype === 'TRUE_FALSE' && (
            <div className="flex gap-4" role="radiogroup" aria-labelledby={`q-${q.id}-label`}>
              {['A', 'B'].map((letter, i) => (
                <label key={letter} className="flex cursor-pointer items-center gap-2 text-purple-100">
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={answers[q.id] === letter}
                    onChange={() => setAnswer(q.id, letter)}
                  />
                  <span>{i === 0 ? 'True' : 'False'}</span>
                </label>
              ))}
            </div>
          )}
          {q.qtype === 'SHORT_ANSWER' && (
            <TextInput
              aria-labelledby={`q-${q.id}-label`}
              placeholder="Type your answer"
              value={answers[q.id] || ''}
              onChange={(e) => setAnswer(q.id, e.target.value)}
            />
          )}
        </Card>
      ))}
    </div>
  );
}
