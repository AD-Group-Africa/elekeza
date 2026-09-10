'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { BookOpen, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';

interface Lesson {
  id: number;
  title: string;
  score: number;
  completed: boolean;
}

export default function StudentLessons() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'inProgress' | 'completed'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Learner-scoped endpoint: lessons the student has been assigned (LessonProgress rows)
    api.get('/progress/lessons')
      .then(res => setLessons(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = lessons.filter(l => {
    const matchFilter = filter === 'all'
      || (filter === 'inProgress' && !l.completed)
      || (filter === 'completed' && l.completed);
    const matchSearch = l.title.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  // Real connectivity status – reflects navigator.onLine, not a mock.
  const [offline, setOffline] = useState(() => typeof navigator === 'undefined' ? false : !navigator.onLine);
  useEffect(() => {
    const online = () => setOffline(false);
    const goneOffline = () => setOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', goneOffline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', goneOffline);
    };
  }, []);

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-purple-200">My Lessons</h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search lessons..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as 'all' | 'inProgress' | 'completed')}
            aria-label="Filter lessons"
            className="px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All</option>
            <option value="inProgress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-card p-4 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-3/4 mb-3" />
                <div className="h-3 bg-white/10 rounded w-1/2 mb-2" />
                <div className="h-2 bg-white/10 rounded w-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <BookOpen size={48} className="text-purple-400 mx-auto mb-4" />
            <p className="text-purple-200">No lessons found.</p>
            <p className="text-purple-300 text-sm">Check back later or ask your teacher to assign new content.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(lesson => (
              <Link key={lesson.id} href={'/lesson/' + lesson.id} className="block group">
                <div className="glass-card p-4 hover:bg-white/5 transition h-full flex flex-col">
                  {/* Subject color bar */}
                  <div className="w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mb-3" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-purple-200 group-hover:text-white transition">{lesson.title}</h3>
                    <p className="text-purple-400 text-sm">{
                      lesson.completed
                        ? 'Completed · Score ' + Math.round(lesson.score) + '%'
                        : 'In progress — assigned by your teacher'
                    }</p>
                    <div className="mt-3 w-full bg-white/10 rounded-full h-1.5">
                      <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: lesson.completed ? '100%' : '25%' }} />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-purple-500 text-xs">{lesson.completed ? 'Completed' : 'Not started'}</span>
                      {offline ? <WifiOff size={14} className="text-orange-400" /> : <Wifi size={14} className="text-green-400" />}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
