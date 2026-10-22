'use client';

/**
 * My Progress — honest learner progress from the real backend.
 *
 * Every number is from the backend (progress, gamification, analytics,
 * mastery); nothing is invented. Mastery is a bonus layer: if it fails the
 * page still tells the learner's story.
 */

import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, Download, Star, TrendingUp } from 'lucide-react';
import { Button, ButtonLink, Card, EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { downloadTextFile } from '@/lib/download';
import { useAuth } from '@/features/auth';
import { attendanceApi } from '@/features/attendance/api';
import { curriculumApi, curriculumKeys } from '@/features/curriculum/api';
import { CompetencyList } from '@/features/curriculum/components/CompetencyList';
import {
  learnerApi,
  learnerKeys,
  useGamification,
  useProgressDashboard,
  type Gamification,
  type ProgressDashboard,
} from '../api';
import { LevelProgress } from '../components/LevelProgress';
import { MASTERY_ICON, MASTERY_LABEL, MASTERY_TONE_CLASS, masteryStateOf } from '../masteryDisplay';
import { formatDate } from '@/lib/format';

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="flex flex-col items-center">
      <span aria-hidden="true">{icon}</span>
      <p className="mt-2 text-xs text-purple-300">{label}</p>
      <p className="text-lg font-bold text-purple-100">{value}</p>
    </Card>
  );
}

function buildReport(progress: ProgressDashboard | undefined, game: Gamification | undefined, streak: number): string {
  return [
    'Elekeza Student Progress Report',
    `Name: ${progress?.name || 'Student'}`,
    `Lessons Completed: ${progress?.completedLessons || 0}`,
    `Quizzes Taken: ${progress?.quizzesTaken || 0}`,
    `Average Score: ${progress?.averageScore || 0}%`,
    `Stars: ${game?.stars ?? 0} of 5`,
    `Level: ${game?.level ?? 0} (${game?.levelName ?? ''})`,
    `Points: ${game?.points ?? 0}`,
    `Learning Streak: ${streak} days`,
    `Date: ${new Date().toLocaleDateString()}`,
  ].join('\n');
}

export default function ProgressScreen() {
  const progress = useProgressDashboard();
  const game = useGamification();
  const analytics = useQuery({ queryKey: learnerKeys.analytics, queryFn: learnerApi.analytics });
  const mastery = useQuery({ queryKey: learnerKeys.mastery, queryFn: learnerApi.mastery });
  const me = useAuth().user?.learnerId;
  const competencies = useQuery({
    queryKey: curriculumKeys.learner(me ?? 0),
    queryFn: () => curriculumApi.learnerProgress(me!),
    enabled: me != null,
  });
  const attendance = useQuery({
    queryKey: ['attendance', 'learner', me ?? 0],
    queryFn: () => attendanceApi.learnerHistory(me!),
    enabled: me != null,
  });

  if (progress.isLoading || game.isLoading) {
    return <LoadingState label="Loading your progress…" />;
  }

  if (progress.isError && game.isError) {
    return (
      <EmptyState
        icon={<BookOpen size={40} />}
        title="We could not load your progress right now. Please try again."
        action={<ButtonLink href="/student-home">Back to home</ButtonLink>}
      />
    );
  }

  const p = progress.data;
  const streak = p?.learningStreak ?? analytics.data?.learningStreak ?? 0;
  const recent = p?.recentLessons ?? [];
  const weekly = analytics.data?.weeklyActivity ?? [];
  const masteryRows = mastery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Progress"
        actions={
          <Button
            icon={<Download size={18} aria-hidden="true" />}
            onClick={() => downloadTextFile('elekeza-progress-report.txt', buildReport(p, game.data, streak))}
          >
            Download report
          </Button>
        }
      />

      {game.data && <LevelProgress game={game.data} size="lg" />}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon={<BookOpen size={24} className="text-blue-400" />}
          label="Lessons completed"
          value={p?.completedLessons || 0}
        />
        <StatCard
          icon={<Star size={24} className="text-green-400" />}
          label="Quizzes taken"
          value={p?.quizzesTaken || 0}
        />
        <StatCard
          icon={<TrendingUp size={24} className="text-purple-400" />}
          label="Average score"
          value={`${p?.averageScore || 0}%`}
        />
        <StatCard
          icon={<Award size={24} className="text-yellow-400" />}
          label="Learning streak"
          value={`${streak} days`}
        />
      </div>

      {masteryRows.length > 0 && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <TrendingUp size={18} className="text-purple-400" aria-hidden="true" /> What to do next
            </span>
          }
        >
          <p className="-mt-2 mb-3 text-sm text-purple-300">
            Based on your quiz results — and you can always choose differently.
          </p>
          <ul className="space-y-2">
            {masteryRows.slice(0, 6).map((row) => {
              const state = masteryStateOf(row.state);
              return (
                <li key={row.contentId} className="rounded-xl bg-white/5 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-purple-100">{row.title}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${MASTERY_TONE_CLASS[state]}`}>
                      <span aria-hidden="true">{MASTERY_ICON[state]} </span>
                      {MASTERY_LABEL[state]}
                    </span>
                  </div>
                  {row.nextLabel && <p className="mt-1 text-sm text-purple-300">{row.nextLabel}.</p>}
                  <p className="mt-0.5 text-xs text-purple-400">{row.reason}</p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {game.data && game.data.achievements.length > 0 && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <Award size={20} className="text-yellow-400" aria-hidden="true" /> Achievements
            </span>
          }
        >
          <div className="flex flex-wrap gap-3">
            {game.data.achievements.map((label) => (
              <span key={label} className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1">
                <span aria-hidden="true">🏅</span>
                <span className="text-xs text-purple-200">{label}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {recent.length > 0 ? (
        <Card
          title={
            <span className="flex items-center gap-2">
              <BookOpen size={18} className="text-purple-400" aria-hidden="true" /> Recent lessons
            </span>
          }
        >
          <ul className="space-y-2">
            {recent.map((lesson) => (
              <li
                key={lesson.id ?? lesson.title}
                className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-purple-200">{lesson.title}</p>
                  <p className="text-xs text-purple-400">
                    {lesson.completedAt ? `Completed ${formatDate(lesson.completedAt)}` : 'Completed'}
                  </p>
                </div>
                <span className="font-semibold text-purple-200">{Math.round(lesson.quizScore ?? 0)}%</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState
          icon={<BookOpen size={40} />}
          title="You have not completed any lessons yet."
          description="Open a lesson from your home to start earning progress."
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="My skills (curriculum)">
          <CompetencyList
            rows={competencies.data?.competencies ?? []}
            unit="lessons"
            empty="Your skills appear here once your teacher links lessons to the curriculum."
          />
        </Card>
        <Card title="My attendance">
          {!attendance.data || attendance.data.sessionsMarked === 0 ? (
            <p className="text-sm text-purple-300">No attendance recorded yet.</p>
          ) : (
            <>
              <p className="text-3xl font-bold text-purple-100">{attendance.data.attendanceRate}%</p>
              <p className="text-sm text-purple-300">
                of {attendance.data.sessionsMarked} school days marked
                {attendance.data.className ? ` in ${attendance.data.className}` : ''}
              </p>
            </>
          )}
        </Card>
      </div>

      {weekly.length > 0 && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <TrendingUp size={18} className="text-purple-400" aria-hidden="true" /> This week
            </span>
          }
        >
          <div className="flex flex-wrap gap-2">
            {weekly.map((day) => (
              <div key={day.day} className="rounded-xl bg-white/5 px-3 py-2 text-sm">
                <span className="text-purple-300">{day.day}</span>
                <span className="ml-2 font-semibold text-purple-100">{day.minutes} min</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
