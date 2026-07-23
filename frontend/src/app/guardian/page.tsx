'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { User, TrendingUp, BookOpen, Award, CalendarCheck } from 'lucide-react';
import Link from 'next/link';

export default function GuardianDashboard() {
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/guardian/wards')
      .then(res => setChildren(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-purple-200">Parent Dashboard</h1>
      {loading ? (
        <p className="text-purple-300">Loading…</p>
      ) : children.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <User size={48} className="text-purple-400 mx-auto mb-4" />
          <p className="text-purple-200">No linked children yet.</p>
          <p className="text-purple-300 text-sm">Contact your school to link your child's account.</p>
        </div>
      ) : (
        children.map(child => (
          <div key={child.id} className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <User size={32} className="text-blue-400" />
              <div>
                <h2 className="text-xl font-semibold text-purple-200">{child.name}</h2>
                <p className="text-purple-300 text-sm">{child.sneType || 'No SNE profile'}</p>
              </div>
              <Link
                href={'/guardian/wards/' + child.id}
                className="ml-auto text-purple-300 hover:text-white text-sm underline"
              >
                View Details
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 p-3 rounded text-center">
                <BookOpen size={20} className="text-blue-400 mx-auto mb-1" />
                <p className="text-purple-300 text-xs">Completed Lessons</p>
                <p className="text-lg font-bold text-purple-100">{child.lessonsCompleted || 0}</p>
              </div>
              <div className="bg-white/5 p-3 rounded text-center">
                <CalendarCheck size={20} className="text-green-400 mx-auto mb-1" />
                <p className="text-purple-300 text-xs">Pending</p>
                <p className="text-lg font-bold text-purple-100">{child.lessonsPending || 0}</p>
              </div>
              <div className="bg-white/5 p-3 rounded text-center">
                <TrendingUp size={20} className="text-purple-400 mx-auto mb-1" />
                <p className="text-purple-300 text-xs">Avg Score</p>
                <p className="text-lg font-bold text-purple-100">{child.averageScore || 0}%</p>
              </div>
              <div className="bg-white/5 p-3 rounded text-center">
                <Award size={20} className="text-yellow-400 mx-auto mb-1" />
                <p className="text-purple-300 text-xs">Last Active</p>
                <p className="text-lg font-bold text-purple-100">{child.lastActive || 'N/A'}</p>
              </div>
            </div>

            {child.recentQuizzes && Object.keys(child.recentQuizzes).length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-purple-200 mb-2">Recent Quizzes</h3>
                <div className="space-y-1">
                  {Object.entries(child.recentQuizzes).map(([key, val]: any) => (
                    <div key={key} className="flex justify-between text-purple-300 text-xs">
                      <span>{key}</span>
                      <span>{val}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}