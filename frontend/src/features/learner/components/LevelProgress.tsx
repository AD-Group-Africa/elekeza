import type { Gamification } from '../api';

/** Points per level in the backend economy (GamificationController). */
const POINTS_PER_LEVEL = 50;

/** Gentle, non-competitive level + stars strip. */
export function LevelProgress({ game, size = 'md' }: { game: Gamification; size?: 'md' | 'lg' }) {
  const pct = Math.max(0, Math.min(100, Math.round(100 * (1 - game.nextLevelPoints / POINTS_PER_LEVEL))));
  const stars = Math.max(0, Math.min(5, game.stars));
  const starText = '★'.repeat(stars) + '☆'.repeat(5 - stars);

  return (
    <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
      {size === 'lg' ? (
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-purple-300">Your level</p>
            <p className="mt-0.5 text-2xl font-bold text-purple-100">
              Level {game.level} · {game.levelName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-purple-300">Stars</p>
            <p className="mt-0.5 text-2xl font-bold text-purple-100" aria-label={`${stars} of 5 stars`}>
              {starText}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between text-purple-100">
          <span className="font-semibold">
            Level {game.level} · {game.levelName}
          </span>
          <span className="text-sm text-purple-300" aria-label={`${stars} of 5 stars`}>
            {starText}
          </span>
        </div>
      )}
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-violet-400 transition-[width] duration-700"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${game.nextLevelPoints} points to Level ${game.level + 1}`}
        />
      </div>
      <p className="mt-1.5 text-xs text-purple-300">
        {game.nextLevelPoints} points to Level {game.level + 1}
      </p>
    </div>
  );
}
