'use client';

/**
 * AI Tutor V1 — a contextual learning-support layer, NOT a chatbot.
 *
 * Six actions grounded in the learner's current lesson:
 *   Explain · Practice · Read aloud · Translate · Diagram · Summarize
 *
 * Honest by design:
 *  - "Read this aloud" is local browser speech synthesis (no AI loading
 *    state, no provider round-trip) with a clear fallback when unavailable.
 *  - Responses come from the backend's deterministic lesson-grounded engine;
 *    the card labels the source instead of pretending it is live AI.
 *  - The learner can always get back to the choices (and the lesson).
 *
 * Accessibility: labelled controls, aria-live result region, keyboard-first,
 * focus moved to the response, distinct icon per action (colour is never the
 * only signal).
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { tutorAPI, progressAPI } from '@/lib/api';
import {
  Lightbulb, Dumbbell, Volume2, Languages, GitBranch, ListChecks,
  ArrowLeft, BookOpen,
} from 'lucide-react';

// Backend /api/progress/lessons rows: { id, title, score, completed }.
interface LessonRow { id: number; title: string }

interface PracticeQ { practiceId: string; question: string; options: string[]; lessonTitle: string }
interface PracticeFb { correct: boolean; explanation: string; canRetry: boolean }
interface DiagramT { title: string; altText: string; nodes: { id: string; label: string }[]; edges: { from: string; to: string; label: string }[] }

interface TutorResult {
  action: string;
  intro?: string | null;
  content?: string | null;
  practice?: PracticeQ;
  feedback?: PracticeFb;
  originalText?: string | null;
  translatedBy?: string;
  diagram?: DiagramT;
  source?: string;
}

type ActionKey = 'EXPLAIN' | 'PRACTICE' | 'READ_ALOUD' | 'TRANSLATE' | 'DIAGRAM' | 'SUMMARY';

const ACTIONS: { key: ActionKey; label: string; icon: typeof Lightbulb; hint: string }[] = [
  { key: 'EXPLAIN', label: 'Explain this concept', icon: Lightbulb, hint: 'A simple explanation of this lesson' },
  { key: 'PRACTICE', label: 'Give me a practice problem', icon: Dumbbell, hint: 'One question from this lesson' },
  { key: 'READ_ALOUD', label: 'Read this aloud', icon: Volume2, hint: 'Your device reads the lesson' },
  { key: 'TRANSLATE', label: 'Translate to Kiswahili', icon: Languages, hint: 'See the lesson in Kiswahili' },
  { key: 'DIAGRAM', label: 'Show me a diagram', icon: GitBranch, hint: 'A simple labeled flow' },
  { key: 'SUMMARY', label: 'Summarize the lesson', icon: ListChecks, hint: 'What you learned' },
];

export default function AITutorPage() {
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TutorResult | null>(null);
  const [practice, setPractice] = useState<PracticeQ | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const resultRef = useRef<HTMLDivElement>(null);

  // Load the learner's lessons (the tutor's grounding menu).
  useEffect(() => {
    progressAPI.lessons()
      .then((res) => {
        const rows: LessonRow[] = res.data || [];
        setLessons(rows);
        if (rows.length > 0) setLessonId(rows[0].id);
      })
      .catch(() => setError('Could not load your lessons. Please refresh and try again.'));
  }, []);

  // Read-aloud availability is a device capability — checked once, honestly.
  useEffect(() => {
    if (typeof window !== 'undefined' && !('speechSynthesis' in window)) {
      setSpeechSupported(false);
    }
    return () => { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); };
  }, []);

  const ask = async (action: ActionKey, extra: Record<string, unknown> = {}) => {
    if (busy) return;
    if (action !== 'READ_ALOUD' && !lessonId) {
      setError('Choose a lesson first, then pick how I can help.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await tutorAPI.ask({
        action: action === 'READ_ALOUD' ? 'EXPLAIN' : action,
        lessonId: lessonId ?? undefined,
        ...extra,
      });
      const data = res.data as TutorResult;
      setResult(data);
      setPractice(data.practice ?? null);
      setAnswer(null);
      // Move assistive tech to the response.
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch {
      setError('The tutor is temporarily unavailable. You can continue learning or try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async () => {
    if (!practice || answer === null || busy) return;
    await ask('PRACTICE', { practiceId: practice.practiceId, answerIndex: answer });
  };

  const readAloud = () => {
    if (!('speechSynthesis' in window)) { setSpeechSupported(false); return; }
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    // Reading order = the lesson the tutor is grounded in (fetch its text).
    fetch(`/api/content/lessons/${lessonId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((lesson: { title?: string; sections?: { heading?: string; body?: string }[] }) => {
        const parts = (lesson.sections || []).map((s) => [s.heading, s.body].filter(Boolean).join('. ')).join(' ');
        if (!parts.trim()) { setError('There is no lesson text to read yet.'); return; }
        const u = new SpeechSynthesisUtterance(`${lesson.title ?? 'Lesson'}. ${parts}`);
        u.onend = () => setSpeaking(false);
        u.onerror = () => { setSpeaking(false); setError('Your device could not read this aloud.'); };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        setSpeaking(true);
      })
      .catch(() => setError('Could not load the lesson text to read aloud.'));
  };

  const backToChoices = () => { setResult(null); setPractice(null); setAnswer(null); setError(''); };

  return (
    <SidebarLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <BookOpen size={26} aria-hidden="true" />
          <h1 className="text-2xl font-bold">AI Tutor</h1>
          <span className="text-xs px-2 py-1 rounded-full border border-[var(--border)] opacity-80">Learning helper — built into your lesson</span>
        </div>

        {/* Lesson context picker: the tutor is always grounded in a lesson. */}
        <div>
          <label htmlFor="tutor-lesson" className="block text-sm font-medium mb-1">
            Which lesson are you studying?
          </label>
          {lessons.length === 0 ? (
            <p className="text-sm opacity-80">
              You have no lessons yet. Open <Link href="/student-lessons" className="underline font-semibold">My Lessons</Link> to start one, then come back here.
            </p>
          ) : (
            <select
              id="tutor-lesson"
              value={lessonId ?? ''}
              onChange={(e) => { setLessonId(Number(e.target.value)); backToChoices(); }}
              className="w-full max-w-md px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
            >
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <div role="alert" className="rounded-lg px-4 py-3 text-sm bg-red-500/15 border border-red-500/40">
            {error}
          </div>
        )}

        {/* Result region — announced to screen readers. */}
        <div ref={resultRef} tabIndex={-1} aria-live="polite" className="outline-none">
          {busy && (
            <div className="rounded-xl p-5 bg-[var(--surface)] border border-[var(--border)]" role="status">
              <p className="text-sm opacity-80">Thinking about your lesson…</p>
            </div>
          )}

          {!busy && result && (
            <div className="rounded-xl p-5 bg-[var(--surface)] border border-[var(--border)] space-y-4">
              {result.intro && (
                <p className="text-sm font-medium opacity-90">{result.intro}</p>
              )}

              {result.action === 'EXPLAIN' && (
                <div className="space-y-3">
                  <p className="whitespace-pre-line">{result.content}</p>
                  <button
                    onClick={() => ask('EXPLAIN', { variant: 'simpler' })}
                    className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--surface-muted)]"
                  >
                    Let&apos;s make it simpler
                  </button>
                </div>
              )}

              {result.action === 'SUMMARY' && (
                // The engine emits a tiny markdown subset (## heading, - bullets,
                // **bold**). Render it as real structure — raw hashes/bullets on
                // screen would be noise for early readers.
                <div className="space-y-2">
                  {(result.content ?? '').split('\n').map((line, i) => {
                    if (line.startsWith('## ')) {
                      return <h3 key={i} className="font-semibold">{line.slice(3)}</h3>;
                    }
                    if (line.startsWith('- ')) {
                      return (
                        <div key={i} className="flex gap-2">
                          <span aria-hidden="true">•</span>
                          <span>{line.slice(2)}</span>
                        </div>
                      );
                    }
                    if (!line.trim()) return null;
                    const bolded = line.split(/\*\*(.+?)\*\*/g);
                    return (
                      <p key={i} className="whitespace-pre-line">
                        {bolded.map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : part))}
                      </p>
                    );
                  })}
                </div>
              )}

              {result.action === 'TRANSLATE' && (
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-wide opacity-70">Kiswahili ({result.translatedBy})</p>
                  <p className="whitespace-pre-line">{result.content}</p>
                  {result.originalText && (
                    <details className="text-sm">
                      <summary className="cursor-pointer font-medium">Show original English</summary>
                      <p className="mt-2 opacity-80">{result.originalText}</p>
                    </details>
                  )}
                </div>
              )}

              {result.action === 'DIAGRAM' && result.diagram && (
                <div className="space-y-3">
                  <p className="font-semibold">{result.diagram.title}</p>
                  <ol className="space-y-2" aria-label={result.diagram.altText}>
                    {result.diagram.nodes.map((n, i) => (
                      <li key={n.id} className="flex items-center gap-2">
                        <span aria-hidden="true" className="w-7 h-7 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-sm font-bold">{i + 1}</span>
                        <span>{n.label}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="text-sm opacity-75">{result.diagram.altText}</p>
                </div>
              )}

              {result.action === 'PRACTICE' && practice && (
                <div className="space-y-4">
                  <p className="whitespace-pre-line font-medium">{practice.question}</p>
                  <div className="grid gap-2" role="radiogroup" aria-label="Your answer">
                    {practice.options.map((opt, i) => (
                      <label key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--border)] cursor-pointer hover:bg-[var(--surface-muted)]">
                        <input type="radio" name="tutor-practice" checked={answer === i} onChange={() => setAnswer(i)} />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={submitAnswer}
                    disabled={answer === null || busy}
                    className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white font-medium disabled:opacity-50"
                  >
                    Check my answer
                  </button>
                </div>
              )}

              {result.action === 'PRACTICE' && result.feedback && (
                <div className="space-y-3">
                  <p className={'font-semibold ' + (result.feedback.correct ? 'text-green-500' : 'text-amber-500')}>
                    {result.feedback.correct ? 'Correct!' : 'Not quite — keep going.'}
                  </p>
                  <p>{result.feedback.explanation}</p>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => ask('PRACTICE')} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--surface-muted)]">
                      Another practice question
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 flex-wrap pt-2 border-t border-[var(--border)]">
                <button onClick={backToChoices} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--surface-muted)]">
                  <ArrowLeft size={14} className="inline mr-1" aria-hidden="true" /> Back to choices
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action menu — always reachable when no result is showing. */}
        {!result && (
          <div>
            <h2 className="text-sm font-semibold mb-2">How would you like help?</h2>
            <div className="grid sm:grid-cols-2 gap-3" role="group" aria-label="Tutor actions">
              {ACTIONS.map(({ key, label, icon: Icon, hint }) => {
                const isRead = key === 'READ_ALOUD';
                return (
                  <button
                    key={key}
                    onClick={() => (isRead ? readAloud() : ask(key))}
                    disabled={busy || (isRead && !speechSupported) || (!isRead && !lessonId)}
                    title={isRead && !speechSupported ? 'Your device does not support read-aloud' : hint}
                    className="flex items-start gap-3 text-left p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-muted)] transition disabled:opacity-50"
                  >
                    <Icon size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
                    <span>
                      <span className="block font-medium">{isRead && speaking ? 'Stop reading' : label}</span>
                      <span className="block text-xs opacity-70 mt-0.5">
                        {isRead && !speechSupported ? 'Not available on this device' : hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs opacity-60">
          The tutor helps you understand your lessons. It never replaces your teacher and never shares your information.
        </p>
      </div>
    </SidebarLayout>
  );
}
