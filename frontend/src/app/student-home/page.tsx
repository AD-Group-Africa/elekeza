'use client';

/**
 * LearnerHome — the transformed learner experience.
 *
 * NOT a dashboard. The learner lands, their companion greets them, and there
 * are exactly a few large, warm choices. One primary action (Continue
 * Learning) dominates; everything else is progressively revealed.
 *
 * Data comes from the existing progress + gamification APIs — no new backend
 * surface required for the home itself.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import LearningCompanion, { CompanionState } from '@/components/learner/LearningCompanion';

interface ProgressData {
  name?: string;
  streak?: number;
  completedLessons?: number;
  quizzesTaken?: number;
  averageScore?: number;
  upcomingQuizzes?: { title: string; lessonId: number }[];
  recentLessons?: { id: number; title: string; quizScore?: number }[];
}

interface GamificationData {
  level: number;
  levelName: string;
  points: number;
  nextLevelPoints: number;
  stars: number;
  achievements: string[];
}

export default function LearnerHome() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [game, setGame] = useState<GamificationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/progress/dashboard').then(res => setProgress(res.data)).catch(() => {});
    api.get('/gamification/student').then(res => setGame(res.data)).catch(() => {});
    api.get('/progress/dashboard').finally(() => setLoading(false));
  }, []);

  const name = progress?.name || 'Learner';
  const currentLesson = progress?.recentLessons?.[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const companionState: CompanionState = loading ? 'thinking' : 'greeting';
  const companionLine = loading
    ? 'Let me get your world ready…'
    : currentLesson
      ? `Welcome back, ${name}! Ready to keep exploring?`
      : `Hi ${name}! What shall we discover today?`;

  return (
    <SidebarLayout>
      <main className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-indigo-950 px-4 py-8 md:px-8">
        {/* Companion greeting — the emotional anchor of the page */}
        <section className="mx-auto max-w-2xl text-center" aria-live="polite">
          <LearningCompanion state={companionState} size={120} className="mx-auto" />
          <h1 className="mt-3 text-2xl md:text-3xl font-bold text-purple-100">
            {greeting}, {name} 👋
          </h1>
          <p className="mt-1 text-lg text-purple-300">{companionLine}</p>
        </section>

        {/* Level strip — gentle, non-competitive progress */}
        {game && (
          <section className="mx-auto mt-6 max-w-2xl">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between text-purple-100">
                <span className="font-semibold">
                  Level {game.level} · {game.levelName}
                </span>
                <span className="text-sm text-purple-300" aria-label={`${game.stars} of 5 stars`}>
                  {'★'.repeat(game.stars)}{'☆'.repeat(Math.max(0, 5 - game.stars))}
                </span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-violet-400 transition-all duration-700"
                  style={{
                    width: `${Math.min(100, Math.round(100 * (1 - game.nextLevelPoints / 50)))}%`,
                  }}
                  role="progressbar"
                  aria-valuenow={game.points}
                  aria-valuemin={0}
                  aria-valuemax={game.level * 50}
                  aria-label="Points to next level"
                />
              </div>
              <p className="mt-1.5 text-xs text-purple-300">
                {game.nextLevelPoints} points to Level {game.level + 1}
              </p>
            </div>
          </section>
        )}

        {/* The few big choices — one primary action, tablet-first targets */}
        <section className="mx-auto mt-8 grid max-w-2xl gap-4 pb-20 md:pb-0" aria-label="Your learning choices">
          {currentLesson && (
            <Link
              href={`/lesson/${currentLesson.id}`}
              className="group flex min-h-[92px] items-center gap-4 rounded-3xl bg-gradient-to-r from-fuchsia-600 to-violet-600 p-5 shadow-xl shadow-purple-950/40 outline-none transition hover:from-fuchsia-500 hover:to-violet-500 focus-visible:ring-4 focus-visible:ring-fuchsia-300 active:scale-[0.99]"
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 text-3xl" aria-hidden="true">▶</span>
              <span className="flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-fuchsia-200">Continue learning</span>
                <span className="mt-0.5 block text-lg font-bold text-white">{currentLesson.title}</span>
              </span>
              <span className="text-2xl text-white/70 transition group-hover:translate-x-1" aria-hidden="true">→</span>
            </Link>
          )}

          <div className="grid grid-cols-2 gap-4">
            <BigChoice
              href="/student-lessons"
              emoji="🧭"
              title="Explore"
              subtitle="Discover new worlds"
              tone="bg-white/10 hover:bg-white/15"
            />
            <BigChoice
              href="/student-quizzes"
              emoji="🎯"
              title="Play"
              subtitle="Try a challenge"
              tone="bg-white/10 hover:bg-white/15"
            />
            <BigChoice
              href="/progress"
              emoji="🌟"
              title="My Journey"
              subtitle="See how far you've come"
              tone="bg-white/10 hover:bg-white/15"
            />
            <BigChoice
              href="/learner/preferences"
              emoji="🎨"
              title="How I Learn"
              subtitle="Make Elekeza yours"
              tone="bg-white/10 hover:bg-white/15"
            />
          </div>
        </section>
      </main>
    </SidebarLayout>
  );
}

function BigChoice({
  href,
  emoji,
  title,
  subtitle,
  tone,
}: {
  href: string;
  emoji: string;
  title: string;
  subtitle: string;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[112px] flex-col justify-center rounded-3xl p-5 outline-none transition focus-visible:ring-4 focus-visible:ring-fuchsia-300 active:scale-[0.98] ${tone}`}
    >
      <span className="text-3xl" aria-hidden="true">{emoji}</span>
      <span className="mt-2 text-base font-bold text-purple-100">{title}</span>
      <span className="text-sm text-purple-300">{subtitle}</span>
    </Link>
  );
}
