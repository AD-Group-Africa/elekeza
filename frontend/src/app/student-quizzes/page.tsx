'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { ClipboardCheck } from 'lucide-react';
import Link from 'next/link';

export default function StudentQuizzes() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch progress which includes upcoming quizzes
    api.get('/progress/dashboard')
      .then(res => setQuizzes(res.data?.upcomingQuizzes || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-purple-200">My Quizzes</h1>
        {loading ? (
          <p className="text-purple-300">Loading…</p>
        ) : quizzes.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <ClipboardCheck size={48} className="text-purple-400 mx-auto mb-4" />
            <p className="text-purple-200">No quizzes available.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {quizzes.map((q: any) => (
              <Link key={q.id} href={'/quiz/' + q.lessonId} className="glass-card p-4 hover:bg-white/5 transition flex justify-between items-center">
                <div>
                  <h3 className="text-purple-200 font-semibold">{q.title}</h3>
                  <p className="text-purple-300 text-sm">Ready</p>
                </div>
                <span className="text-purple-400">Start</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}