'use client';

/**
 * Institutional engagement summary for school administrators, from the real
 * telemetry pipeline (tenant-checked server-side). Shows a transparent empty
 * state before there is data — never fabricated numbers.
 */

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { ButtonLink, Card, LoadingState, PageHeader } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { adminApi, adminKeys } from '../api';

export default function EngagementScreen() {
  const { user, loading: authLoading } = useAuth();
  const institutionId = user?.institutionId;
  const summary = useQuery({
    queryKey: adminKeys.engagement(institutionId ?? 0),
    queryFn: () => adminApi.engagement(institutionId!),
    enabled: institutionId != null,
  });

  if (authLoading || summary.isLoading) return <LoadingState label="Loading engagement data…" />;

  const data = summary.data;
  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Engagement" />
        <Card padding="lg" className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-1 text-purple-300" aria-hidden="true" />
          <div>
            <p className="text-purple-200">Engagement data is not available for your account.</p>
            <ButtonLink href="/admin" variant="ghost" size="sm" className="mt-2 px-0 underline">
              Back to dashboard
            </ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  const rows: Array<{ label: string; value: number }> = [
    { label: 'Active learners/staff (30d)', value: data.activeUsers },
    { label: 'Lessons started', value: data.lessonsStarted },
    { label: 'Lessons completed', value: data.lessonsCompleted },
    { label: 'Quizzes completed', value: data.quizzesCompleted },
    { label: 'Assignments submitted', value: data.assignmentsSubmitted },
    { label: 'Exams submitted', value: data.examsSubmitted },
    { label: 'AI Tutor interactions', value: data.tutorInteractions },
    { label: 'Accessibility feature uses', value: data.accessibilityFeatureUses },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Engagement — last ${data.windowDays} days`}
        description={`${data.totalEvents} recorded events`}
      />
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {rows.map((r) => (
          <Card key={r.label}>
            <dd className="text-3xl font-bold text-white">{r.value}</dd>
            <dt className="mt-1 text-xs text-purple-300">{r.label}</dt>
          </Card>
        ))}
      </dl>
    </div>
  );
}
