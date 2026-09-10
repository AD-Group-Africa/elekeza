'use client';

/**
 * Celebration — the reward moment when a learner completes an activity.
 *
 * Deterministic, lightweight (emoji + CSS, no animation library), respects
 * prefers-reduced-motion, and centres the achievement ("I did it") rather
 * than comparison with others.
 */

import LearningCompanion from './LearningCompanion';

export interface CelebrationData {
  score: number; // 0..100
  stars: number; // 0..5
  xpEarned: number;
  newAchievements?: string[];
  levelUp?: { level: number; levelName: string } | null;
  companionMessage: string;
}

export default function Celebration({ data }: { data: CelebrationData }) {
  const great = data.score >= 80;
  return (
    <div
      className="celebration-overlay fixed inset-0 z-50 grid place-items-center bg-indigo-950/80 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-live="assertive"
      aria-label="Quiz complete"
    >
      <div className="celebration-card w-full max-w-md rounded-3xl bg-gradient-to-b from-violet-900 to-indigo-950 p-8 text-center shadow-2xl outline outline-1 outline-white/10">
        <LearningCompanion state="celebrating" size={130} className="mx-auto" />
        <h2 className="mt-3 text-2xl font-extrabold text-purple-50">
          {great ? 'Amazing work!' : 'You did it!'}
        </h2>
        <p className="mt-2 text-lg text-purple-200">{data.companionMessage}</p>

        <div
          className="mt-5 text-4xl tracking-widest"
          role="img"
          aria-label={`${data.stars} of 5 stars`}
        >
          {'★'.repeat(data.stars)}
          <span className="opacity-30">{'★'.repeat(Math.max(0, 5 - data.stars))}</span>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 text-purple-200">
          <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold">
            Score {Math.round(data.score)}%
          </span>
          {data.xpEarned > 0 && (
            <span className="rounded-full bg-amber-400/20 px-4 py-1.5 text-sm font-semibold text-amber-200">
              +{data.xpEarned} XP
            </span>
          )}
        </div>

        {data.levelUp && (
          <p className="mt-4 rounded-2xl bg-fuchsia-500/20 px-4 py-2 text-fuchsia-100">
            🎉 Level {data.levelUp.level} — {data.levelUp.levelName}!
          </p>
        )}

        {data.newAchievements && data.newAchievements.length > 0 && (
          <p className="mt-3 text-sm text-purple-300">
            New badge{data.newAchievements.length > 1 ? 's' : ''}:{' '}
            {data.newAchievements.join(' · ')}
          </p>
        )}
      </div>
      <style jsx>{`
        @keyframes celebration-pop {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .celebration-card {
          animation: celebration-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .celebration-card { animation: none; }
        }
      `}</style>
    </div>
  );
}
