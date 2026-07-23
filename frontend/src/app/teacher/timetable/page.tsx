'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = ['8:00-8:40', '8:40-9:20', '9:20-10:00', '10:20-11:00', '11:00-11:40', '11:40-12:20', '13:00-13:40', '13:40-14:20'];

export default function TimetablePage() {
  const [timetable, setTimetable] = useState<Record<string, Record<string, string>>>({});
  const [editing, setEditing] = useState({ day: '', period: '' });

  const handleChange = (day: string, period: string, value: string) => {
    setTimetable(prev => ({
      ...prev,
      [day]: { ...prev[day], [period]: value }
    }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-purple-200">Class Timetable</h1>
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-purple-200 text-sm">
          <thead>
            <tr className="border-b border-purple-300/20">
              <th className="p-2 text-left">Time</th>
              {DAYS.map(day => (
                <th key={day} className="p-2 text-left">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map(period => (
              <tr key={period} className="border-b border-purple-300/10">
                <td className="p-2 text-purple-300">{period}</td>
                {DAYS.map(day => (
                  <td key={day} className="p-2">
                    <input
                      type="text"
                      value={timetable[day]?.[period] || ''}
                      onChange={(e) => handleChange(day, period, e.target.value)}
                      className="w-full bg-white/10 border border-purple-300/20 rounded p-1 text-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      placeholder="Subject"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-purple-300 text-sm">Changes are saved locally. Backend integration coming soon.</p>
    </div>
  );
}