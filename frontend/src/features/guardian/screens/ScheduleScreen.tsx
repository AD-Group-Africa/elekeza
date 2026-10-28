'use client';

import { useQuery } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';
import { ButtonLink, Card, EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { guardianApi, guardianKeys } from '../api';

/** What each child still has to do (pending lessons). */
export default function ScheduleScreen() {
  const { data: schedule = [], isLoading } = useQuery({
    queryKey: guardianKeys.schedule,
    queryFn: guardianApi.schedule,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule" description="Lessons your children still have to finish." />
      {isLoading ? (
        <LoadingState />
      ) : schedule.length === 0 ? (
        <EmptyState
          icon={<Calendar size={48} />}
          title="No upcoming activities."
          action={<ButtonLink href="/guardian/wards">View your children</ButtonLink>}
        />
      ) : (
        <ul className="space-y-3">
          {schedule.map((item, i) => (
            <li key={`${item.lessonId ?? i}-${item.wardName ?? ''}`}>
              <Card className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-purple-200">{item.title}</h2>
                  <p className="text-sm text-purple-300">{[item.date, item.time].filter(Boolean).join(' • ')}</p>
                </div>
                <span className="text-xs text-purple-400">{item.type}</span>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
