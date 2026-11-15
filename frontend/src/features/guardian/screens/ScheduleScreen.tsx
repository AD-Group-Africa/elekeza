'use client';

import { useQuery } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';
import { ButtonLink, Card, EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { upcoming, useDeadlines } from '@/features/calendar/api';
import { DeadlineList } from '@/features/calendar/components/DeadlineList';
import { guardianApi, guardianKeys } from '../api';

/** What each child still has to do (pending lessons). */
export default function ScheduleScreen() {
  const { data: schedule = [], isLoading } = useQuery({
    queryKey: guardianKeys.schedule,
    queryFn: guardianApi.schedule,
  });

  const deadlines = useDeadlines();
  const dates = upcoming(deadlines.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule" description="School dates and the lessons your children still have to finish." />
      {dates.length > 0 && (
        <Card title="School dates">
          <DeadlineList deadlines={dates} />
        </Card>
      )}
      <h2 className="text-lg font-semibold text-purple-200">Lessons to finish</h2>
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
