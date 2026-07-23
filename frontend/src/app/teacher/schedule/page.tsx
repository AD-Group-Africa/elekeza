'use client';

import { useState } from 'react';
import { Calendar, Plus } from 'lucide-react';

export default function TeacherSchedule() {
  const [events, setEvents] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const addEvent = (e: React.FormEvent) => {
    e.preventDefault();
    setEvents(prev => [...prev, { id: Date.now(), title, date, time }]);
    setTitle(''); setDate(''); setTime(''); setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-purple-200">Schedule & Meetings</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <Plus size={18} /> New Event
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-6">
          <form onSubmit={addEvent} className="space-y-4">
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Event Title" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" required />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" required />
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" required />
            <button type="submit" className="bg-purple-600 text-white px-6 py-2 rounded-lg">Save</button>
          </form>
        </div>
      )}

      <div className="glass-card p-4">
        <h2 className="text-lg font-semibold text-purple-200 mb-3">Upcoming Events</h2>
        {events.length === 0 ? (
          <div className="text-center py-8">
            <Calendar size={48} className="text-purple-400 mx-auto mb-2" />
            <p className="text-purple-300">No events scheduled.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map(e => (
              <div key={e.id} className="flex justify-between text-purple-200 p-2 bg-white/5 rounded">
                <span>{e.title}</span>
                <span className="text-purple-400">{e.date} {e.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card p-4">
        <h2 className="text-lg font-semibold text-purple-200 mb-2">School Calendar</h2>
        <p className="text-purple-300 text-sm">Important dates: Sports Day (June 15), Closing Day (July 5)</p>
      </div>
    </div>
  );
}