'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function StudentLessons() {
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/content/list') // This returns all content; later we can filter by assigned
      .then(res => setLessons(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-purple-200">My Lessons</h1>
        {loading ? (
          <p className="text-purple-300">Loading…</p>
        ) : lessons.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <BookOpen size={48} className="text-purple-400 mx-auto mb-4" />
            <p className="text-purple-200">No lessons available.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {lessons.map((l: any) => (
              <Link key={l.id} href={'/lesson/' + l.id} className="glass-card p-4 hover:bg-white/5 transition flex justify-between items-center">
                <div>
                  <h3 className="text-purple-200 font-semibold">{l.title}</h3>
                  <p className="text-purple-300 text-sm">{l.subject} • {l.grade}</p>
                </div>
                <span className="text-purple-400">View</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}