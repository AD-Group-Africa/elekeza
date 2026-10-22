'use client';

/**
 * Lesson page — "Learn → Practice → Complete → Earn → Continue".
 *
 * The learner reads the lesson (all at once, or one section at a time in
 * reading mode), and is offered the practice quiz once they reach the end —
 * only if the backend actually has one. Completion and XP are
 * server-authoritative. Staff can preview lessons; that never starts a quiz.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { LearningCompanion } from '@/features/learner';
import { useLearnerPreferences } from '@/features/learner/api';
import { useLessonQuiz } from '@/features/quiz/api';
import { LESSON_STATUS_LABEL, useLesson } from '../api';
import { LessonSection, ReadingProgress } from '../components/LessonSection';

function CenteredMessage({
  state,
  message,
  action,
}: {
  state: 'thinking' | 'concerned';
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <LearningCompanion state={state} size={96} />
      <p className="text-base text-purple-200" role={state === 'concerned' ? 'alert' : 'status'}>
        {message}
      </p>
      {action}
    </div>
  );
}

export default function LessonScreen() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const homeHref = isStudent ? '/student-home' : '/teacher/lessons';

  const lessonQuery = useLesson(id);
  const prefsQuery = useLearnerPreferences(isStudent);
  const quizQuery = useLessonQuiz(id, isStudent);

  const [currentSection, setCurrentSection] = useState(0);
  const [readingMode, setReadingMode] = useState(false);

  if (lessonQuery.isLoading) return <CenteredMessage state="thinking" message="Getting your lesson ready…" />;
  if (lessonQuery.isError || !lessonQuery.data) {
    return (
      <CenteredMessage
        state="concerned"
        message={
          lessonQuery.isError
            ? 'We could not load this lesson right now. Please try again.'
            : 'This lesson could not be found.'
        }
        action={<ButtonLink href={homeHref}>Back to your home</ButtonLink>}
      />
    );
  }

  const lesson = lessonQuery.data;
  const sections = lesson.sections ?? [];
  if (sections.length === 0) {
    return (
      <CenteredMessage
        state="concerned"
        message="This lesson does not have content yet."
        action={<ButtonLink href={isStudent ? '/student-lessons' : '/teacher/lessons'}>Back to lessons</ButtonLink>}
      />
    );
  }

  const total = sections.length;
  const atEnd = currentSection === total - 1;
  const prefs = prefsQuery.data ?? {};
  const serverTts = prefs.readAloud?.value === 'true';
  const companionLine =
    prefs.dial?.value === 'encouraging'
      ? 'You’re doing well — let’s keep going.'
      : 'Let’s learn something useful today.';
  const quiz =
    quizQuery.data && Array.isArray(quizQuery.data.questions) && quizQuery.data.questions.length > 0
      ? quizQuery.data
      : null;
  const statusLabel = lesson.status ? (LESSON_STATUS_LABEL[lesson.status] ?? lesson.status) : '';
  const visible = readingMode ? [currentSection] : sections.map((_, idx) => idx);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-20">
      <Link href={homeHref} className="flex items-center gap-1.5 text-sm text-purple-300 transition hover:text-white">
        <ArrowLeft size={16} aria-hidden="true" /> Back to home
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-purple-100">{lesson.title ?? 'Lesson'}</h1>
          {statusLabel && (
            <span className="mt-1 inline-block rounded-full bg-green-600/30 px-3 py-0.5 text-xs font-medium text-green-200">
              {statusLabel}
            </span>
          )}
        </div>
        {isStudent && (
          <button
            type="button"
            onClick={() => setReadingMode((on) => !on)}
            aria-pressed={readingMode}
            className={
              'rounded-xl border px-3.5 py-2 text-sm transition ' +
              (readingMode
                ? 'border-purple-400 bg-purple-600/30 text-white'
                : 'border-purple-300/20 text-purple-200 hover:bg-white/10')
            }
          >
            Reading mode: one section at a time
          </button>
        )}
      </div>

      {isStudent && (
        <div className="flex items-center gap-3 text-purple-200">
          <LearningCompanion state={prefsQuery.isLoading ? 'thinking' : 'greeting'} size={48} className="shrink-0" />
          <p className="text-sm">{prefsQuery.isLoading ? '' : companionLine}</p>
        </div>
      )}

      <ReadingProgress current={currentSection} total={total} completed={atEnd && !quiz} />

      <div className="space-y-4">
        {visible.map((idx) => (
          <LessonSection
            key={idx}
            section={sections[idx]}
            index={idx}
            total={total}
            showPosition={readingMode}
            serverTts={serverTts}
          />
        ))}
      </div>

      {!atEnd && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setCurrentSection((s) => Math.max(0, s - 1))}
            disabled={currentSection === 0}
            className="rounded-lg border border-purple-300/20 px-4 py-2 text-sm text-purple-200 hover:bg-white/10 disabled:opacity-30"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setCurrentSection((s) => Math.min(total - 1, s + 1))}
            className="rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:from-purple-500 hover:to-indigo-500"
          >
            Next section
          </button>
        </div>
      )}

      {/* Practice — learners only, once they reach the end, and only if it exists. */}
      {isStudent && atEnd && (
        <section className="space-y-4 rounded-2xl bg-white/10 p-5" aria-labelledby="practice-heading">
          <h2 id="practice-heading" className="text-lg font-semibold text-purple-100">
            Practice what you learned
          </h2>
          <p className="text-sm text-purple-300">Answer a few questions to finish the lesson and earn your XP.</p>
          {quizQuery.isLoading ? (
            <p className="text-sm text-purple-300" role="status">
              Checking practice…
            </p>
          ) : quiz ? (
            <>
              <ButtonLink href={ROUTES.quiz(id)} size="lg">
                Finish lesson and earn XP →
              </ButtonLink>
              <p className="text-xs text-purple-300">
                Your answers are marked by the server. You cannot change your score here.
              </p>
            </>
          ) : (
            <p className="text-sm text-amber-300" role="status">
              Practice is not ready for this lesson yet. You can read the lesson first.
            </p>
          )}
        </section>
      )}

      {Object.keys(lesson.keyTerms ?? {}).length > 0 && (
        <section className="space-y-3 rounded-2xl bg-white/10 p-5" aria-labelledby="terms-heading">
          <h2 id="terms-heading" className="text-lg font-semibold text-purple-100">
            Key words
          </h2>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries(lesson.keyTerms!).map(([term, definition]) => (
              <div key={term} className="rounded-xl bg-white/5 px-4 py-3">
                <dt className="font-semibold text-purple-100">{term}</dt>
                <dd className="mt-1 text-sm text-purple-300">{definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
