'use client';

/**
 * AI Tutor — a contextual learning-support layer, NOT a chatbot.
 *
 * Six actions grounded in the learner's chosen lesson: Explain · Practice ·
 * Read aloud · Translate · Diagram · Summarize. "Read aloud" uses the
 * device's speech synthesis (no AI round-trip). Responses come from the
 * backend's lesson-grounded engine. Accessible: labelled controls, a live
 * result region, focus moved to the response.
 */

import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BookOpen, Dumbbell, GitBranch, Languages, Lightbulb, ListChecks, Volume2 } from 'lucide-react';
import { Alert, Field, LoadingState, Select } from '@/components/ui';
import { useAssignedLessons } from '@/features/learner/api';
import { lessonsApi, sectionText } from '@/features/lessons/api';
import { tutorApi, type PracticeQuestion, type TutorAction, type TutorRequest, type TutorResponse } from '../api';
import { TutorResult } from '../components/TutorResult';

type ActionKey = TutorAction | 'READ_ALOUD';

const ACTIONS: { key: ActionKey; label: string; icon: typeof Lightbulb; hint: string }[] = [
  { key: 'EXPLAIN', label: 'Explain this concept', icon: Lightbulb, hint: 'A simple explanation of this lesson' },
  { key: 'PRACTICE', label: 'Give me a practice problem', icon: Dumbbell, hint: 'One question from this lesson' },
  { key: 'READ_ALOUD', label: 'Read this aloud', icon: Volume2, hint: 'Your device reads the lesson' },
  { key: 'TRANSLATE', label: 'Translate to Kiswahili', icon: Languages, hint: 'See the lesson in Kiswahili' },
  { key: 'DIAGRAM', label: 'Show me a diagram', icon: GitBranch, hint: 'A simple labeled flow' },
  { key: 'SUMMARY', label: 'Summarize the lesson', icon: ListChecks, hint: 'What you learned' },
];

const speechAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
const noSubscribe = () => () => {};

function Tutor() {
  const lessons = useAssignedLessons();
  const requested = Number(useSearchParams().get('lessonId')) || null;
  const [chosenLesson, setChosenLesson] = useState<number | null>(null);
  const lessonList = lessons.data ?? [];
  const lessonId =
    chosenLesson ?? (lessonList.some((l) => l.id === requested) ? requested : (lessonList[0]?.id ?? null));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TutorResponse | null>(null);
  const [practice, setPractice] = useState<PracticeQuestion | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      if (speechAvailable()) window.speechSynthesis.cancel();
    },
    [],
  );

  const backToChoices = () => {
    setResult(null);
    setPractice(null);
    setAnswer(null);
    setError('');
  };

  const ask = async (action: TutorAction, extra: Partial<TutorRequest> = {}) => {
    if (busy) return;
    if (!lessonId) {
      setError('Choose a lesson first, then pick how I can help.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const data = await tutorApi.ask({ action, lessonId, ...extra });
      setResult(data);
      setPractice(data.practice ?? null);
      setAnswer(null);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch {
      setError('The tutor is temporarily unavailable. You can continue learning or try again.');
    } finally {
      setBusy(false);
    }
  };

  const readAloud = async () => {
    if (!speechAvailable()) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    if (!lessonId) return;
    try {
      const lesson = await lessonsApi.get(lessonId);
      const text = (lesson.sections || [])
        .map((s) => [s.heading, sectionText(s.body)].filter(Boolean).join('. '))
        .join(' ');
      if (!text.trim()) {
        setError('There is no lesson text to read yet.');
        return;
      }
      const utterance = new SpeechSynthesisUtterance(`${lesson.title ?? 'Lesson'}. ${text}`);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => {
        setSpeaking(false);
        setError('Your device could not read this aloud.');
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setSpeaking(true);
    } catch {
      setError('Could not load the lesson text to read aloud.');
    }
  };

  // Device capability; assumed available during server rendering.
  const canSpeak = useSyncExternalStore(noSubscribe, speechAvailable, () => true);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <BookOpen size={26} aria-hidden="true" />
        <h1 className="text-2xl font-bold">AI Tutor</h1>
        <span className="rounded-full border border-line px-2 py-1 text-xs text-fg-muted">
          Learning helper — built into your lesson
        </span>
      </div>

      {lessons.isLoading ? (
        <LoadingState label="Loading your lessons…" />
      ) : lessons.isError ? (
        <Alert tone="error">Could not load your lessons. Please refresh and try again.</Alert>
      ) : lessonList.length === 0 ? (
        <p className="text-sm text-fg-muted">
          You have no lessons yet. Open{' '}
          <Link href="/student-lessons" className="font-semibold underline">
            My Lessons
          </Link>{' '}
          to start one, then come back here.
        </p>
      ) : (
        <Field id="tutor-lesson" label="Which lesson are you studying?">
          <Select
            id="tutor-lesson"
            value={lessonId ?? ''}
            onChange={(e) => {
              setChosenLesson(Number(e.target.value));
              backToChoices();
            }}
            className="max-w-md"
          >
            {lessonList.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {/* Result region — announced to screen readers. */}
      <div ref={resultRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {busy && (
          <div className="rounded-xl border border-line bg-surface p-5" role="status">
            <p className="text-sm text-fg-muted">Thinking about your lesson…</p>
          </div>
        )}
        {!busy && result && (
          <TutorResult
            result={result}
            practice={practice}
            answer={answer}
            busy={busy}
            onAnswer={setAnswer}
            onCheckAnswer={() =>
              practice && answer !== null && ask('PRACTICE', { practiceId: practice.practiceId, answerIndex: answer })
            }
            onSimpler={() => ask('EXPLAIN', { variant: 'simpler' })}
            onAnotherPractice={() => ask('PRACTICE')}
            onBack={backToChoices}
          />
        )}
      </div>

      {!result && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">How would you like help?</h2>
          <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Tutor actions">
            {ACTIONS.map(({ key, label, icon: Icon, hint }) => {
              const isRead = key === 'READ_ALOUD';
              const unavailable = isRead && !canSpeak;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => (isRead ? readAloud() : ask(key as TutorAction))}
                  disabled={busy || unavailable || !lessonId}
                  title={unavailable ? 'Your device does not support read-aloud' : hint}
                  className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 text-left transition hover:bg-surface-hover disabled:opacity-50"
                >
                  <Icon size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
                  <span>
                    <span className="block font-medium">{isRead && speaking ? 'Stop reading' : label}</span>
                    <span className="mt-0.5 block text-xs text-fg-muted">
                      {unavailable ? 'Not available on this device' : hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-fg-muted">
        The tutor helps you understand your lessons. It never replaces your teacher and never shares your information.
      </p>
    </div>
  );
}

export default function TutorScreen() {
  // useSearchParams needs a Suspense boundary for static rendering.
  return (
    <Suspense fallback={<LoadingState />}>
      <Tutor />
    </Suspense>
  );
}
