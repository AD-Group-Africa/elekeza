'use client';

import Link from 'next/link';
import { User } from 'lucide-react';
import { EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { useWards } from '../api';

export default function WardsScreen() {
  const { data: children = [], isLoading } = useWards();

  return (
    <div className="space-y-6">
      <PageHeader title="My Children" />
      {isLoading ? (
        <LoadingState />
      ) : children.length === 0 ? (
        <EmptyState
          icon={<User size={48} />}
          title="No linked children yet."
          description="Contact your school to link a learner to your account."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((child) => (
            <Link
              key={child.id}
              href={ROUTES.ward(child.id)}
              className="glass-card flex items-center gap-3 p-4 transition hover:bg-white/5"
            >
              <User size={24} className="text-blue-400" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-semibold opacity-90">{child.name}</h2>
                <p className="text-sm text-fg-muted">
                  {child.lessonsCompleted ?? 0} lessons completed · average score {Math.round(child.averageScore ?? 0)}%
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
