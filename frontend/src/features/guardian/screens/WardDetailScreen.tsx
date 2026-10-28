'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Calendar, ClipboardCheck, HeartHandshake, TrendingUp } from 'lucide-react';
import { Alert, Card, LoadingState, PageHeader } from '@/components/ui';
import { getErrorStatus } from '@/lib/api';
import { useAuth } from '@/features/auth';
import GuardianLinksPanel from '@/features/admin/components/GuardianLinksPanel';
import { formatDate } from '@/lib/format';
import { isSchoolAdmin } from '@/lib/roles';
import { guardianApi, guardianKeys } from '../api';
import DailyDigest from '../components/DailyDigest';

const CONFIGURED_BY: Record<string, string> = {
  EXPLICIT: 'your child',
  TEACHER: 'their teacher',
  GUARDIAN: 'you',
  OBSERVED: 'Elekeza’s observations',
  SYSTEM: 'standard defaults',
};

const RELATIONSHIP_LINE: Record<string, string> = {
  CAREGIVER: 'Learner you support as caregiver',
  OLDER_SIBLING: 'Learner you support as older sibling',
};

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white/5 p-4 text-center">
      <span className="mx-auto mb-2 block w-fit opacity-80" aria-hidden="true">
        {icon}
      </span>
      <p className="text-xs opacity-75">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

/** One learner in detail. School admins also manage guardian links here. */
export default function WardDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const ward = useQuery({ queryKey: guardianKeys.ward(id), queryFn: () => guardianApi.ward(id) });
  const support = useQuery({ queryKey: guardianKeys.support(id), queryFn: () => guardianApi.learningSupport(id) });

  if (ward.isLoading) return <LoadingState />;
  if (!ward.data) {
    return (
      <div>
        <PageHeader title="Learner details" />
        <Alert tone="error">
          {getErrorStatus(ward.error) === 403
            ? 'You do not have access to this learner.'
            : 'This learner could not be found.'}
        </Alert>
      </div>
    );
  }

  const w = ward.data;
  const configuredBy = (support.data?.profileConfiguredBy || []).map((src) => CONFIGURED_BY[src] || src).join(', ');

  return (
    <div className="space-y-6">
      <Link href="/guardian" className="flex items-center gap-2 underline underline-offset-2 hover:no-underline">
        <ArrowLeft size={18} aria-hidden="true" /> Back
      </Link>
      <Card padding="lg">
        <div className="mb-6 flex items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ek-moss-600)] text-2xl font-bold text-white"
            aria-hidden="true"
          >
            {w.name?.charAt(0) || '?'}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{w.name}</h1>
            <p className="opacity-75">{RELATIONSHIP_LINE[w.relationship ?? ''] ?? 'Your learner'}</p>
            {w.sneType && w.sneType !== 'NONE' && (
              <p className="mt-0.5 text-xs opacity-75">Learning profile: {w.sneType}</p>
            )}
          </div>
        </div>

        <DailyDigest wardId={id} />

        {isSchoolAdmin(user?.role) && <GuardianLinksPanel learnerId={id} />}

        <div className="my-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat icon={<BookOpen size={20} />} label="Completed Lessons" value={w.lessonsCompleted || 0} />
          <Stat icon={<Calendar size={20} />} label="Pending" value={w.lessonsPending || 0} />
          <Stat icon={<ClipboardCheck size={20} />} label="Avg Score" value={`${Math.round(w.averageScore || 0)}%`} />
          <Stat icon={<TrendingUp size={20} />} label="Last Active" value={formatDate(w.lastActive) || 'N/A'} />
        </div>

        {support.data?.summary && (
          <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <HeartHandshake size={18} className="text-amber-300" aria-hidden="true" />
              <h2 className="font-semibold">How {w.name} is learning right now</h2>
            </div>
            <p className="text-sm leading-relaxed">{support.data.summary}</p>
            {configuredBy && <p className="mt-2 text-xs opacity-60">Learning preferences set by: {configuredBy}</p>}
          </div>
        )}

        {w.recentQuizzes && w.recentQuizzes.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-2 text-lg font-semibold">Recent Quizzes</h2>
            <ul className="space-y-1">
              {w.recentQuizzes.map((q, i) => (
                <li key={i} className="flex justify-between text-sm opacity-85">
                  <span>
                    Lesson {q.lessonId ?? i + 1}
                    {q.date ? ` · ${formatDate(q.date)}` : ''}
                  </span>
                  <span>{Math.round(q.score ?? 0)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {w.progressHistory && w.progressHistory.length > 0 && (
          <div>
            <h2 className="mb-2 text-lg font-semibold">Progress History</h2>
            <ul className="space-y-1">
              {w.progressHistory.map((p, i) => (
                <li key={i} className="flex justify-between text-sm opacity-85">
                  <span>{formatDate(p.date) || `Entry ${i + 1}`}</span>
                  <span>{Math.round(p.score ?? 0)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
