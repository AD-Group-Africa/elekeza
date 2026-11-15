import type { GamificationBadge } from '../api';

/**
 * Every badge a learner can earn: earned ones celebrate, locked ones show how
 * to get there ("3 of 5"). Locked badges keep full-contrast text; only the
 * emoji is muted, so nothing becomes hard to read.
 */
export function BadgeGallery({ badges }: { badges: GamificationBadge[] }) {
  const earned = badges.filter((b) => b.earned).length;
  return (
    <div>
      <p className="mb-3 text-sm text-purple-300">
        {earned} of {badges.length} badges earned
      </p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {badges.map((badge) => {
          const pct = Math.round((100 * badge.progress) / Math.max(1, badge.goal));
          return (
            <li
              key={badge.id}
              className={
                'flex items-start gap-3 rounded-xl border p-3 ' +
                (badge.earned ? 'border-purple-400 bg-purple-600/20' : 'border-purple-300/20 bg-white/5')
              }
            >
              <span
                className={'text-3xl leading-none ' + (badge.earned ? '' : 'grayscale')}
                aria-hidden="true"
              >
                {badge.earned ? badge.icon : '🔒'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-purple-100">
                  {badge.name}
                  <span className="sr-only">{badge.earned ? ' (earned)' : ' (not earned yet)'}</span>
                </p>
                <p className="text-xs text-purple-300">{badge.description}</p>
                {badge.earned ? (
                  <p className="mt-1 text-xs font-semibold text-emerald-300">Earned!</p>
                ) : (
                  <div className="mt-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-violet-400"
                        style={{ width: `${pct}%` }}
                        role="progressbar"
                        aria-valuenow={badge.progress}
                        aria-valuemin={0}
                        aria-valuemax={badge.goal}
                        aria-label={`${badge.name}: ${badge.progress} of ${badge.goal}`}
                      />
                    </div>
                    <p className="mt-1 text-xs text-purple-300">
                      {badge.progress} of {badge.goal}
                    </p>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
