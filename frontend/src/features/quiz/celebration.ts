import type { Gamification } from '@/features/learner/api';
import type { CelebrationData } from '@/features/learner';

/**
 * Reward moment for a finished quiz. XP, level-up and new badges are the
 * difference between the learner's gamification state before and after the
 * submit, so the dialog only celebrates what was really earned. Without a
 * "before" snapshot (it failed to load) it falls back to the backend's
 * per-quiz XP and announces no badges rather than guessing.
 */
export function celebrationFor(score: number, after: Gamification, before?: Gamification): CelebrationData {
  const known = new Set(before?.achievements ?? after.achievements);
  return {
    score,
    stars: score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : 1,
    // GamificationController: 10 points per completed quiz.
    xpEarned: before ? Math.max(0, after.points - before.points) : 10,
    newAchievements: (after.achievements ?? []).filter((name) => !known.has(name)),
    levelUp: before && after.level > before.level ? { level: after.level, levelName: after.levelName } : null,
    companionMessage:
      score >= 90
        ? 'Wow! You really know this. Shall we try another adventure?'
        : score >= 60
          ? 'Strong work! Every try makes you stronger.'
          : 'Well done for finishing — that is how learning grows!',
  };
}
