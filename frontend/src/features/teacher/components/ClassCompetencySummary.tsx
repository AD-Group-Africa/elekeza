'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, LoadingState, Select } from '@/components/ui';
import { useClasses } from '@/features/attendance/api';
import { curriculumApi, curriculumKeys } from '@/features/curriculum/api';
import { CompetencyList } from '@/features/curriculum/components/CompetencyList';

/** How a whole class is doing on each curriculum competency. */
export function ClassCompetencySummary() {
  const classes = useClasses();
  const [chosen, setChosen] = useState<number | null>(null);
  const classId = chosen ?? classes.data?.[0]?.id ?? null;
  const summary = useQuery({
    queryKey: curriculumKeys.class(classId ?? 0),
    queryFn: () => curriculumApi.classSummary(classId!),
    enabled: classId != null,
  });

  if (!classes.isLoading && (classes.data ?? []).length === 0) return null;

  return (
    <Card
      title="Class competencies"
      actions={
        <Select
          aria-label="Class"
          value={classId ?? ''}
          onChange={(e) => setChosen(Number(e.target.value))}
          className="w-auto py-1.5 text-sm"
        >
          {(classes.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      }
    >
      {summary.isLoading || classes.isLoading ? (
        <LoadingState />
      ) : (
        <CompetencyList
          rows={summary.data?.competencies ?? []}
          unit="learners"
          empty="No competency evidence for this class yet. Link lessons to curriculum objectives on the Lessons page."
        />
      )}
    </Card>
  );
}
