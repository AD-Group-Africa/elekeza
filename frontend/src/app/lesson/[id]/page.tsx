'use client';

/**
 * Learner Lesson Page — the gamified "Learn → Practice → Complete → Earn → Continue"
 * experience.
 *
 * One page, not a dashboard fragment. The learner lands on a real lesson, reads the
 * content, is offered a practice quiz only when the backend quiz API exists for that
 * lesson, and is rewarded on completion. Completion and XP are server-authoritative;
 * the browser never trusts client-supplied XP, scores, or learner IDs.
 *
 * Accessibility-first: plain language, large targets, text labels on every visual
 * status, reduced-motion respected, no colour-only meaning, readable typography.
 * The companion is a UX primitive here, not decoration — it can be removed without
 * breaking the learning flow.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { useAuth } from '@/hooks/useAuth';
import LearningCompanion, { CompanionState } from '@/components/learner/LearningCompanion';

// ---------------------------------------------------------------------------
// Types — mirror the backend lesson view payload exactly.
// ---------------------------------------------------------------------------

interface LessonSection {
  heading?: string;
  body: string | { text?: string; content?: string };
}

interface LessonData {
  id?: number;
  title?: string;
  status?: string;
  sections?: LessonSection[];
  keyTerms?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Rendering helpers — plain language, readable, accessible.
// ---------------------------------------------------------------------------

/** Convert a section body (string or object) into plain text. */
function plainBody(section: LessonSection): string {
  if (typeof section.body === 'string') return section.body;
  return section.body.text || section.body.content || '';
}

/** Limits are part of the accessible experience: one section at a time for
 * learners who need less density; full page for learners who want it. */
function SectionPanel({
  section,
  index,
  total,
  reduced,
}: {
  section: LessonSection;
  index: number;
  total: number;
  reduced: boolean;
}) {
  const bodyText = plainBody(section);
  const heading = section.heading?.trim();

  return (
    <section className="glass-card p-5" aria-labelledby={`lesson-section-${index}`}>
      {heading && (
        <h3 id={`lesson-section-${index}`} className="text-xl font-semibold text-purple-100 mb-3">
          {heading}
        </h3>
      )}        <div className="leading-relaxed text-purple-200 whitespace-pre-line">
          {bodyText}
        </div>
      {reduced && <p className="mt-3 text-xs text-purple-300">Section {index + 1} of {total}</p>}
    </section>
  );
}

/** Progress strip that never relies on colour alone. */
function ProgressStrip({
  current,
  total,
  completed,
}: {
  current: number;
  total: number;
  completed: boolean;
}) {
  const pct = total > 0 ? Math.round(((current + 1) / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm" role="status" aria-live="polite">
      <span className="text-purple-300">
        {completed ? 'Completed' : `Section ${current + 1} of ${total}`}
      </span>
      <span className="text-purple-400">·</span>
      <span className="text-purple-300" aria-label={`${pct} percent through`}>{pct}%</span>
      <div className="flex-1 bg-white/10 rounded-full h-2.5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-[width] duration-500"
          style={{ width: `${Math.min(100, pct)}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${pct} percent complete`}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LessonPage() {
  const { id } = useParams();

  const { user } = useAuth();

  // Content states
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Learner-specific states
  const [prefs, setPrefs] = useState<Record<string, { value: string; source: string }> | null>(null);
  const [companionState, setCompanionState] = useState<CompanionState>('thinking');
  const [companionLine, setCompanionLine] = useState('');

  // Reading experience
  const [currentSection, setCurrentSection] = useState(0);
  const [reduced, setReduced] = useState(false);

  // Practice quiz states — only shown if real quiz API is available
  const [quiz, setQuiz] = useState<{ quizId: number; questions: unknown[] } | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [openedQuiz, setOpenedQuiz] = useState(false);

  const isStudent = user?.role === 'STUDENT';

  // ---------------------------------------------------------------------------
  // Load lesson
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!id) return;
    api
      .get('/content/lessons/' + id)
      .then((res) => {
        setLesson(res.data ?? null);
        if (!res.data) setError('This lesson could not be found.');
      })
      .catch(() => setError('We could not load this lesson right now. Please try again.'))
      .finally(() => setLoading(false));
  }, [id]);

  // ---------------------------------------------------------------------------
  // Learner preferences — used for reading mode and companion tone only.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isStudent) return;
    api
      .get('/learner/preferences')
      .then((res) => setPrefs(res.data?.effective ?? {}))
      .catch(() => setPrefs({}))
      .finally(() => {
        // Companion greeting adapts to learner state only; it does not replace content.
        setCompanionState('greeting');
        const dial = prefs?.dial?.value;
        if (dial === 'calm') {
          setCompanionLine('Let’s learn something useful today.');
        } else if (dial === 'encouraging') {
          setCompanionLine('You’re doing well — let’s keep going.');
        } else {
          setCompanionLine('Let’s learn something useful today.');
        }
      });
  }, [isStudent]);

  // ---------------------------------------------------------------------------
  // Practice quiz — server-authoritative, only if real quiz API exists
  // ---------------------------------------------------------------------------
  // Practice quiz — server-authoritative, only if real quiz API exists
  // Fetch immediately so the learner sees whether practice is available without
  // waiting for a user action. State updates happen inside the then/catch/finally
  // chain, not synchronously in the effect body.
  useEffect(() => {
    if (!id || openedQuiz) return;
    let mounted = true;
    api
      .get('/quiz/' + id + '/start')
      .then((res) => {
        if (!mounted) return;
        const data = res.data as { quizId?: number; questions?: unknown[] } | null;
        if (data?.quizId && Array.isArray(data.questions) && data.questions.length > 0) {
          setQuiz({ quizId: data.quizId, questions: data.questions });
        }
      })
      .catch(() => {
        if (mounted) setQuizError('Practice is not ready for this lesson yet. You can read the lesson first.');
      })
      .finally(() => {
        if (mounted) setQuizLoading(false);
      });
    return () => { mounted = false; };
  }, [id, openedQuiz]);

  // ---------------------------------------------------------------------------
  // Section navigation
  // ---------------------------------------------------------------------------
  const sections = lesson?.sections ?? [];
  const totalSections = sections.length;

  const goNext = () => {
    if (currentSection < totalSections - 1) setCurrentSection((prev) => prev + 1);
  };
  const goPrev = () => {
    if (currentSection > 0) setCurrentSection((prev) => prev - 1);
  };

  const allRead = totalSections > 0 && currentSection === totalSections - 1;

  // ---------------------------------------------------------------------------
  // Reading-mode toggle — simplified language option for accessibility only.
  // ---------------------------------------------------------------------------
  function toggleReduced() {
    setReduced((prev) => !prev);
  }

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <LearningCompanion state="thinking" size={96} />
          <p className="text-purple-200">Getting your lesson ready…</p>
        </div>
      </SidebarLayout>
    );
  }

  if (error && !lesson) {
    return (
      <SidebarLayout>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <LearningCompanion state="concerned" size={96} />
          <p className="text-purple-200 text-base">{error}</p>
          <a
            href="/student-home"
            className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm text-white"
          >
            Back to your home
          </a>
        </div>
      </SidebarLayout>
    );
  }

  // ---------------------------------------------------------------------------
  // No content in lesson
  // ---------------------------------------------------------------------------
  if (!sections.length) {
    return (
      <SidebarLayout>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <LearningCompanion state="concerned" size={96} />
          <p className="text-purple-200 text-base">This lesson does not have content yet.</p>
          <a
            href="/student-lessons"
            className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm text-white"
          >
            Back to My Lessons
          </a>
        </div>
      </SidebarLayout>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const currentSectionData = sections[currentSection];
  const status = lesson?.status ?? '';

  return (
    <SidebarLayout>
      <main className="mx-auto max-w-2xl space-y-6 pb-20">
        {/* Back */}
        <a
          href="/student-home"
          className="flex items-center gap-1.5 text-sm text-purple-300 hover:text-white transition"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back to home
        </a>

        {/* Title + meta */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-purple-100">{lesson?.title ?? 'Lesson'}</h1>
            {status && (
              <span className="mt-1 inline-block rounded-full bg-green-600/30 px-3 py-0.5 text-xs font-medium text-green-200">
                {status}
              </span>
            )}
          </div>
          {isStudent && (
            <button
              onClick={toggleReduced}
              className={`rounded-xl border px-3.5 py-2 text-sm transition ${
                reduced
                  ? 'border-purple-400 bg-purple-600/30 text-white'
                  : 'border-purple-300/20 text-purple-200 hover:bg-white/10'
              }`}
              aria-pressed={reduced}
              aria-label={reduced ? 'Reading mode on — one section at a time' : 'Reading mode off'}
            >
              {reduced ? 'Reading mode on' : 'Reading mode off'}
            </button>
          )}
        </div>

        {/* Companion — encouraging, not required */}
        {isStudent && (
          <div className="flex items-center gap-3 text-purple-200">
            <LearningCompanion state={companionState} size={48} className="shrink-0" />
            <div>
              <p className="text-sm">{companionLine}</p>
            </div>
          </div>
        )}

        {/* Progress strip */}
        <ProgressStrip current={currentSection} total={totalSections} completed={allRead && !quiz?.quizId} />

        {/* Content */}
        <div className="space-y-4">
          {sections.map((section, idx) => (
            <SectionPanel
              key={idx}
              section={section}
              index={idx}
              total={totalSections}
              reduced={reduced || idx !== currentSection}
            />
          ))}
        </div>

        {/* Next section controls */}
        {!allRead && (
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={goPrev}
              disabled={currentSection === 0}
              className="rounded-lg border border-purple-300/20 px-4 py-2 text-sm text-purple-200 hover:bg-white/10 disabled:opacity-30"
            >
              Previous
            </button>
            <button
              onClick={goNext}
              className="rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:from-purple-500 hover:to-indigo-500"
            >
              Next section
            </button>
          </div>
        )}

        {/* Practice quiz — only if real quiz API is available */}
        {isStudent && totalSections > 0 && currentSection === totalSections - 1 && (
          <section className="space-y-4 rounded-2xl bg-white/10 p-5" aria-labelledby="practice-heading">
            <h2 id="practice-heading" className="text-lg font-semibold text-purple-100">
              Practice what you learned
            </h2>
            <p className="text-purple-300 text-sm">
              Answer a few questions to finish the lesson and earn your XP.
            </p>

            {quizLoading && <p className="text-purple-300 text-sm">Checking practice…</p>}
            {quizError && (
              <p className="text-amber-300 text-sm" role="status">{quizError}</p>
            )}

            {quiz && !openedQuiz && (
              <button
                onClick={() => setOpenedQuiz(true)}
                className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:from-purple-500 hover:to-indigo-500"
              >
                Start practice
              </button>
            )}

            {openedQuiz && quiz && (
              <div className="mt-2">
                <a
                  href={`/quiz/${lesson?.id}`}
                  className="block rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/15"
                >
                  Open practice quiz →
                </a>
                <p className="mt-1 text-xs text-purple-300">
                  Your answers are marked by the server. You cannot change your score here.
                </p>
              </div>
            )}

            {!quizLoading && !quizError && !quiz && (
              <p className="text-purple-300 text-sm">
                Practice is not available for this lesson yet.
              </p>
            )}
          </section>
        )}

        {/* Key terms */}
        {Object.keys(lesson?.keyTerms ?? {}).length > 0 && (
          <section className="space-y-3 rounded-2xl bg-white/10 p-5" aria-labelledby="terms-heading">
            <h2 id="terms-heading" className="text-lg font-semibold text-purple-100">
              Key words
            </h2>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Object.entries(lesson!.keyTerms!).map(([term, definition]) => (
                <div key={term} className="rounded-xl bg-white/5 px-4 py-3">
                  <dt className="font-semibold text-purple-100">{term}</dt>
                  <dd className="mt-1 text-sm text-purple-300">{definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Continue / next step */}
        {allRead && quiz?.quizId && (
          <div className="flex flex-wrap gap-3 justify-end">
            <a
              href={`/quiz/${lesson?.id}`}
              className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:from-purple-500 hover:to-indigo-500"
            >
              Finish lesson and earn XP →
            </a>
          </div>
        )}
      </main>
    </SidebarLayout>
  );
}
