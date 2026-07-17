'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function GamificationWidget() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get('/gamification/student')
      .then(res => setData(res.data))
      .catch(() => {});
  }, []);

  if (!data) return null;

  return (
    <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl p-5 shadow-lg text-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold">🎮 Your Progress</h3>
        <div className="bg-white/20 rounded-full px-3 py-1 text-sm font-bold">
          Level {data.level}
        </div>
      </div>
      <div className="text-4xl font-extrabold mb-2">{data.points} pts</div>
      <div className="text-sm opacity-80 mb-3">{data.nextLevelPoints} pts to next level</div>
      {data.achievements?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {data.achievements.map((a: string) => (
            <span key={a} className="bg-white/20 rounded-full px-2 py-1 text-xs font-medium">🏆 {a}</span>
          ))}
        </div>
      )}
    </div>
  );
}
