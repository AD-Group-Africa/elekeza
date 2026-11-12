'use client';

import Link from 'next/link';
import { Award, BookOpen, Calendar, TrendingUp, User } from 'lucide-react';
import { EmptyState, LoadingState } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { formatDate } from '@/lib/format';
import { relationshipLabel, useWards } from '../api';
import DailyDigest from '../components/DailyDigest';

/** Time-aware greeting for the guardian "Today" home. */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white/5 p-3 text-center">
      <span className="mx-auto mb-1 block w-fit opacity-80" aria-hidden="true">
        {icon}
      </span>
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

export default function GuardianHomeScreen() {
  const { data: children = [], isLoading } = useWards();

  if (isLoading) return <LoadingState label="Loading your learners…" />;

  if (children.length === 0) {
    return (
      <EmptyState
        className="mx-auto mt-10 max-w-md"
        icon={<User size={48} />}
        title="No linked learners yet."
        description="Contact your school to link a learner to your account."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{greeting()}, here is your child&apos;s day</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Today at a glance — what they&apos;re learning, what they&apos;ve completed, and anything that needs your
          attention.
        </p>
        <p className="mt-1 text-xs text-fg-muted">
          A guardian can be a parent, caregiver, older sibling, legal guardian, or another authorized adult.
        </p>
      </div>

      <nav aria-label="Your children" className="flex gap-2 overflow-x-auto pb-2">
        {children.map((child) => (
          <Link
            key={child.id}
            href={ROUTES.ward(child.id)}
            className="glass-card whitespace-nowrap rounded-full px-4 py-2 transition hover:bg-white/10"
          >
            {child.name}
            {child.relationship && child.relationship !== 'PARENT' && (
              <span className="ml-2 text-xs text-fg-muted">{relationshipLabel(child.relationship)}</span>
            )}
          </Link>
        ))}
      </nav>

      {children.map((child) => (
        <section key={child.id} className="glass-card space-y-4 p-6" aria-labelledby={`ward-${child.id}`}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ek-moss-600)] text-lg font-bold text-white"
              aria-hidden="true"
            >
              {child.name?.charAt(0) || '?'}
            </div>
            <div>
              <h2 id={`ward-${child.id}`} className="text-xl font-semibold">
                {child.name}
              </h2>
              <p className="text-sm text-fg-muted">
                {relationshipLabel(child.relationship)}
                {child.sneType && child.sneType !== 'NONE' ? ` · ${child.sneType}` : ''}
              </p>
            </div>
            <Link
              href={ROUTES.ward(child.id)}
              className="ml-auto text-sm underline underline-offset-2 hover:no-underline"
            >
              View details<span className="sr-only"> for {child.name}</span>
            </Link>
          </div>

          <DailyDigest wardId={child.id} />

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat icon={<BookOpen size={20} />} label="Completed" value={child.lessonsCompleted || 0} />
            <Stat icon={<Calendar size={20} />} label="Pending" value={child.lessonsPending || 0} />
            <Stat icon={<TrendingUp size={20} />} label="Avg Score" value={`${Math.round(child.averageScore || 0)}%`} />
            <Stat icon={<Award size={20} />} label="Last Active" value={formatDate(child.lastActive) || 'N/A'} />
          </div>
        </section>
      ))}
    </div>
  );
}
