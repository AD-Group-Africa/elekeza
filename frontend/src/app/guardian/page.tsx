'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface Ward {
  name: string; completedLessons: number; lastQuizScore: number | null;
  sneType?: string; avgQuizScore?: number;
  recentActivity?: { contentId: number; quizScore: number | null; completedAt: string | null }[];
}
interface Notif { id: number; type: string; title: string; body: string; read: boolean; createdAt: string; }

const HOME_ACTIVITIES: Record<string, string[]> = {
  DYSLEXIA: ['Read one page aloud together — take turns with sentences', 'Play a word-rhyme game using simple household objects', 'Use coloured overlays when reading printed material'],
  ADHD:     ['10-minute focused reading with a visual countdown timer', 'Break tasks into 3 steps written on sticky notes', 'Movement break: walk outside, then return to one learning task'],
  AUTISM:   ['Follow a visual picture schedule for the afternoon', 'Practice one new social exchange through simple role-play', 'Use a feelings chart to talk about the school day'],
  INTELLECTUAL_DISABILITY: ['Count everyday objects together (spoons, shoes, steps)', 'Read a picture book and describe what you see on each page', 'Sort household items by colour, shape, or size'],
  NONE:     ['Ask "what was the most interesting thing you learned today?"', 'Read together for 20 minutes — any book they enjoy', 'Review lesson notes or a completed quiz together'],
};

export default function ParentPortal() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [wards, setWards]     = useState<Ward[]>([]);
  const [notifs, setNotifs]   = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    Promise.all([
      api.get('/guardian/wards').then(r => r.data).catch(() => []),
      api.get('/notifications').then(r => r.data).catch(() => []),
    ]).then(([w, n]) => { setWards(Array.isArray(w) ? w : []); setNotifs(Array.isArray(n) ? n : []); })
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  const markRead = async (id: number) => {
    await api.post(`/notifications/${id}/read`).catch(() => {});
    setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x));
  };

  const markAll = async () => {
    await api.post('/notifications/read-all').catch(() => {});
    setNotifs(n => n.map(x => ({ ...x, read: true })));
  };

  if (authLoading || loading) return (
    <SidebarLayout><div className="text-white text-center mt-20 animate-pulse">Loading…</div></SidebarLayout>
  );

  const unread = notifs.filter(n => !n.read).length;

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Parent Dashboard</h1>
        <p className="text-blue-200 mt-1">Track your child's learning journey</p>
      </div>

      {/* Unread badge */}
      {unread > 0 && (
        <div className="card mb-6 flex items-center justify-between bg-purple-50 border border-purple-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div>
              <p className="font-semibold text-purple-900">{unread} new update{unread > 1 ? 's' : ''}</p>
              <p className="text-purple-700 text-sm">{notifs.find(n => !n.read)?.title}</p>
            </div>
          </div>
          <button onClick={markAll} className="text-sm text-purple-500 hover:text-purple-700 underline">
            Mark all read
          </button>
        </div>
      )}

      {/* Children */}
      {wards.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">👨‍👩‍👦</div>
          <p className="text-gray-600 text-lg">No children linked yet.</p>
          <p className="text-gray-400 text-sm mt-2">Ask your child's teacher to link your account.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {wards.map((ward, i) => {
            const score = ward.lastQuizScore ?? ward.avgQuizScore ?? null;
            const sneKey = ward.sneType && HOME_ACTIVITIES[ward.sneType] ? ward.sneType : 'NONE';
            const activities = HOME_ACTIVITIES[sneKey];
            return (
              <div key={i} className="card">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-blue-900">{ward.name}</h2>
                    {ward.sneType && ward.sneType !== 'NONE' && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full mt-1 inline-block">
                        {ward.sneType.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-purple-600">
                      {score != null ? `${Math.round(score)}%` : '—'}
                    </p>
                    <p className="text-xs text-gray-400">Last quiz score</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-blue-700">{ward.completedLessons}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Lessons completed</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-green-700">
                      {score == null ? 'No quiz yet' : score >= 60 ? '✓ Passing' : 'Needs support'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Status</p>
                  </div>
                </div>

                {/* Teacher message */}
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
                  <p className="text-sm font-medium text-amber-800 mb-1">📝 Teacher note</p>
                  <p className="text-sm text-amber-700">
                    {score == null
                      ? `${ward.name} hasn't completed a quiz yet. Encourage them to start their first lesson today.`
                      : score >= 80 ? `${ward.name} is doing excellently. Keep encouraging their curiosity!`
                      : score >= 60 ? `${ward.name} is making good progress. Some extra reading at home would help.`
                      : `${ward.name} may need some extra support. Try reviewing the lesson content together.`}
                  </p>
                </div>

                {/* Home activities */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">🏠 Try at home this week</p>
                  <ul className="space-y-1.5">
                    {activities.map((a, j) => (
                      <li key={j} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-purple-400 mt-0.5 flex-shrink-0">•</span>{a}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Notification feed */}
      {notifs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-blue-100 mb-3">Recent updates</h2>
          <div className="space-y-2">
            {notifs.slice(0, 15).map(n => (
              <div key={n.id} onClick={() => markRead(n.id)}
                className={`card cursor-pointer flex items-start gap-3 transition hover:shadow-md ${!n.read ? 'border-l-4 border-purple-400' : 'opacity-70'}`}>
                <span className="text-xl mt-0.5 flex-shrink-0">
                  {n.type === 'QUIZ_COMPLETED' ? '🏆' : n.type === 'LESSON_ASSIGNED' ? '📚' : '🔔'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm">{n.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{n.body}</p>
                </div>
                {!n.read && <span className="w-2 h-2 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"/>}
              </div>
            ))}
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}
