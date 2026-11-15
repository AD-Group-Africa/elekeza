import type { CompetencyProgress } from '../api';

/**
 * Competency evidence as plain rows with a labelled score bar. `unit` names
 * what the count column means ("lessons" for a learner, "learners" for a class).
 */
export function CompetencyList({
  rows,
  unit,
  empty,
}: {
  rows: CompetencyProgress[];
  unit: 'lessons' | 'learners';
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-purple-300">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const pct = Math.max(0, Math.min(100, Math.round(r.averageScore)));
        const count = unit === 'lessons' ? r.lessonsMapped : (r.learnersAssessed ?? r.lessonsMapped);
        return (
          <li key={r.competencyId}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-purple-100">
                {r.competency}
                <span className="ml-2 text-xs text-purple-400">
                  {[r.learningArea, r.strand].filter(Boolean).join(' › ')}
                </span>
              </span>
              <span className="text-xs text-purple-300">
                {pct}% average · {count ?? 0} {unit} · {r.attempts} attempt{r.attempts === 1 ? '' : 's'}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-400"
                style={{ width: `${pct}%` }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${r.competency} average score`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
