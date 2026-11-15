'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, LoadingState } from '@/components/ui';
import { teacherApi, teacherKeys } from '../api';

/** Learners whose lessons currently need support, most first (mastery engine). */
export function SupportQueue() {
  const { data = [], isLoading } = useQuery({ queryKey: teacherKeys.supportQueue, queryFn: teacherApi.supportQueue });
  const needing = data.filter((r) => r.needsSupportCount > 0);

  return (
    <Card title="Learners who need help with a lesson">
      {isLoading ? (
        <LoadingState />
      ) : needing.length === 0 ? (
        <p className="text-sm text-purple-300">
          No lesson currently needs support. Mastery is recalculated after every quiz.
        </p>
      ) : (
        <ul className="space-y-2">
          {needing.map((r) => (
            <li key={r.learnerId} className="rounded-lg bg-white/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-purple-100">{r.learnerName}</p>
                <p className="text-xs text-purple-300">
                  {r.needsSupportCount} of {r.lessonsAssessed} assessed lesson{r.lessonsAssessed === 1 ? '' : 's'} need
                  support · {r.masteredCount} mastered
                </p>
              </div>
              <ul className="mt-1 list-inside list-disc text-sm text-purple-200">
                {r.needsSupport.map((l) => (
                  <li key={l.contentId}>
                    {l.title}: <span className="text-purple-300">{l.reason}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
