'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Select } from '@/components/ui';
import { curriculumApi } from '@/features/curriculum/api';
import { lessonKeys } from '../api';

/** Links a lesson to one curriculum objective (or none). Saves on change. */
export function LessonObjectiveSelect({
  lessonId,
  lessonTitle,
  objectiveId,
  objectives,
}: {
  lessonId: number;
  lessonTitle: string;
  objectiveId: number | null;
  objectives: Array<{ id: number; label: string }>;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const save = useMutation({
    mutationFn: (next: number | null) => curriculumApi.mapLesson(lessonId, next),
    onSuccess: async () => {
      setStatus('Saved');
      await queryClient.invalidateQueries({ queryKey: lessonKeys.list });
      await queryClient.invalidateQueries({ queryKey: ['curriculum'] });
    },
    onError: () => setStatus('Could not save'),
  });

  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label={`Curriculum objective for ${lessonTitle}`}
        value={objectiveId ?? ''}
        disabled={save.isPending}
        onChange={(e) => {
          setStatus('');
          save.mutate(e.target.value ? Number(e.target.value) : null);
        }}
        className="max-w-xs py-1.5 text-sm"
      >
        <option value="">Not linked to the curriculum</option>
        {objectives.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>
      {status && (
        <span className="text-xs text-purple-300" role="status">
          {status}
        </span>
      )}
    </div>
  );
}
