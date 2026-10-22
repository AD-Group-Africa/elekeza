'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Wifi, WifiOff } from 'lucide-react';
import { Alert, EmptyState, PageHeader, Select, TextInput } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAssignedLessons } from '../api';

type Filter = 'all' | 'inProgress' | 'completed';

export default function LearnerLessonsScreen() {
  const { data: lessons = [], isLoading, isError } = useAssignedLessons();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const online = useOnlineStatus();

  const filtered = lessons.filter((l) => {
    const matchFilter =
      filter === 'all' || (filter === 'inProgress' && !l.completed) || (filter === 'completed' && l.completed);
    return matchFilter && l.title.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <PageHeader title="My Lessons" />

      <div className="flex flex-wrap items-center gap-3">
        <TextInput
          type="search"
          aria-label="Search lessons"
          placeholder="Search lessons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md flex-1"
        />
        <Select
          aria-label="Filter lessons"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="w-auto"
        >
          <option value="all">All</option>
          <option value="inProgress">To do</option>
          <option value="completed">Completed</option>
        </Select>
      </div>

      {isError && <Alert tone="error">We could not load your lessons. Please try again.</Alert>}

      {isLoading ? (
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          role="status"
          aria-label="Loading lessons"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card animate-pulse p-4">
              <div className="mb-3 h-4 w-3/4 rounded bg-white/10" />
              <div className="mb-2 h-3 w-1/2 rounded bg-white/10" />
              <div className="h-2 w-full rounded bg-white/10" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={48} />}
          title="No lessons found."
          description="Check back later or ask your teacher to assign new content."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((lesson) => (
            <Link key={lesson.id} href={ROUTES.lesson(lesson.id)} className="group block">
              <div className="glass-card flex h-full flex-col p-4 transition hover:bg-white/5">
                <div
                  className="mb-3 h-1 w-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                  aria-hidden="true"
                />
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-purple-200 transition group-hover:text-white">
                    {lesson.title}
                  </h2>
                  <p className="text-sm text-purple-400">
                    {lesson.completed
                      ? `Completed · Score ${Math.round(lesson.score ?? 0)}%`
                      : 'Assigned by your teacher'}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-purple-500">{lesson.completed ? 'Completed' : 'To do'}</span>
                    {online ? (
                      <Wifi size={14} className="text-green-400" aria-label="Online" />
                    ) : (
                      <WifiOff size={14} className="text-orange-400" aria-label="Offline" />
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
