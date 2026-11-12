'use client';

/**
 * Learner home — not a dashboard. The learner lands, their companion greets
 * them, and there are exactly a few large, warm choices. One primary action
 * (Continue learning) dominates; everything else is progressively revealed.
 */

import Link from 'next/link';
import { ROUTES } from '@/config/routes';
import { upcoming, useDeadlines } from '@/features/calendar/api';
import { DeadlineList } from '@/features/calendar/components/DeadlineList';
import { useGamification, useProgressDashboard } from '../api';
import LearningCompanion, { type CompanionState } from '../components/LearningCompanion';
import { LevelProgress } from '../components/LevelProgress';

function timeGreeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export default function LearnerHomeScreen() {
  const progress = useProgressDashboard();
  const game = useGamification();
  const deadlines = useDeadlines();
  const comingUp = upcoming(deadlines.data ?? []).slice(0, 3);

  const loading = progress.isLoading;
  const name = progress.data?.name || 'Learner';
  const currentLesson = progress.data?.recentLessons?.[0];
  const companionState: CompanionState = loading ? 'thinking' : 'greeting';
  const companionLine = loading
    ? 'Let me get your world ready…'
    : currentLesson
      ? `Welcome back, ${name}! Ready to keep exploring?`
      : `Hi ${name}! What shall we discover today?`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-indigo-950 px-4 py-8 md:px-8">
      {/* Companion greeting — the emotional anchor of the page */}
      <section className="mx-auto max-w-2xl text-center" aria-live="polite">
        <LearningCompanion state={companionState} size={120} className="mx-auto" />
        <h1 className="mt-3 text-2xl font-bold text-purple-100 md:text-3xl">
          {timeGreeting()}, {name} <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-1 text-lg text-purple-300">{companionLine}</p>
      </section>

      {game.data && (
        <section className="mx-auto mt-6 max-w-2xl" aria-label="Your level">
          <LevelProgress game={game.data} />
        </section>
      )}

      {comingUp.length > 0 && (
        <section className="mx-auto mt-6 max-w-2xl rounded-2xl bg-white/10 p-4" aria-labelledby="coming-up">
          <h2 id="coming-up" className="mb-2 font-semibold text-purple-100">
            Coming up
          </h2>
          <DeadlineList deadlines={comingUp} />
        </section>
      )}

      {/* The few big choices — one primary action, tablet-first targets */}
      <section className="mx-auto mt-8 grid max-w-2xl gap-4 pb-20 md:pb-0" aria-label="Your learning choices">
        {currentLesson?.id != null && (
          <Link
            href={ROUTES.lesson(currentLesson.id)}
            className="group flex min-h-[92px] items-center gap-4 rounded-3xl text-white bg-gradient-to-r from-fuchsia-600 to-violet-600 p-5 shadow-xl shadow-purple-950/40 outline-none transition hover:from-fuchsia-500 hover:to-violet-500 focus-visible:ring-4 focus-visible:ring-fuchsia-300 active:scale-[0.99]"
          >
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 text-3xl"
              aria-hidden="true"
            >
              ▶
            </span>
            <span className="flex-1">
              <span className="block text-xs font-semibold uppercase tracking-wide text-fuchsia-200">
                Continue learning
              </span>
              <span className="mt-0.5 block text-lg font-bold text-white">{currentLesson.title}</span>
            </span>
            <span className="text-2xl text-white/70 transition group-hover:translate-x-1" aria-hidden="true">
              →
            </span>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-4">
          <BigChoice href="/student-lessons" emoji="🧭" title="Explore" subtitle="Discover new worlds" />
          <BigChoice href="/student-quizzes" emoji="🎯" title="Play" subtitle="Try a challenge" />
          <BigChoice href="/progress" emoji="🌟" title="My Journey" subtitle="See how far you've come" />
          <BigChoice href="/learner/preferences" emoji="🎨" title="How I Learn" subtitle="Make Elekeza yours" />
        </div>
      </section>
    </div>
  );
}

function BigChoice({ href, emoji, title, subtitle }: { href: string; emoji: string; title: string; subtitle: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[112px] flex-col justify-center rounded-3xl bg-white/10 p-5 outline-none transition hover:bg-white/15 focus-visible:ring-4 focus-visible:ring-fuchsia-300 active:scale-[0.98]"
    >
      <span className="text-3xl" aria-hidden="true">
        {emoji}
      </span>
      <span className="mt-2 text-base font-bold text-purple-100">{title}</span>
      <span className="text-sm text-purple-300">{subtitle}</span>
    </Link>
  );
}
