'use client';

import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';
import { ButtonLink, EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { useProgressDashboard } from '@/features/learner/api';

/** Practice quizzes waiting for the learner (from their progress dashboard). */
export default function LearnerQuizzesScreen() {
  const { data, isLoading } = useProgressDashboard();
  const quizzes = (data?.upcomingQuizzes ?? []).filter((q) => q.lessonId != null);

  return (
    <div className="space-y-6">
      <PageHeader title="My Quizzes" />
      {isLoading ? (
        <LoadingState />
      ) : quizzes.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck size={40} />}
          title="No quizzes here yet."
          description="Quizzes live inside each lesson. Open a lesson from “My Lessons” and start practicing there."
          action={<ButtonLink href="/student-lessons">Browse my lessons</ButtonLink>}
        />
      ) : (
        <div className="grid gap-4">
          {quizzes.map((q) => (
            <Link
              key={q.id ?? q.lessonId}
              href={ROUTES.quiz(q.lessonId!)}
              className="glass-card flex items-center justify-between p-4 transition hover:bg-white/5"
            >
              <div>
                <h2 className="font-semibold text-purple-200">{q.title}</h2>
                <p className="text-sm text-purple-300">Practice what you learned in this lesson</p>
              </div>
              <span className="text-purple-400" aria-hidden="true">
                Start →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
