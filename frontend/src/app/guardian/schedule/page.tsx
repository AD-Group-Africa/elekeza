'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { Calendar } from 'lucide-react';

export default function GuardianSchedule() {
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/guardian/schedule')
      .then(res => setSchedule(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-purple-200">Schedule</h1>
      {loading ? (
        <p className="text-purple-300">Loading…</p>
      ) : schedule.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <Calendar size={48} className="text-purple-400 mx-auto mb-4" />
          <p className="text-purple-200">No upcoming activities.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedule.map((item, i) => (
            <div key={i} className="glass-card p-4 flex justify-between items-center">
              <div>
                <h3 className="text-purple-200 font-semibold">{item.title}</h3>
                <p className="text-purple-300 text-sm">{item.date} • {item.time}</p>
              </div>
              <span className="text-purple-400 text-xs">{item.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}