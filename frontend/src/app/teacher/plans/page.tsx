'use client';

import { useState } from 'react';
import { Plus, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface LessonPlan {
  id: number;
  title: string;
  subject: string;
  lessons: unknown[];
}

export default function LessonPlans() {
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');

  const createPlan = (e: React.FormEvent) => {
    e.preventDefault();
    setPlans(prev => [...prev, { id: Date.now(), title, subject, lessons: [] }]);
    setTitle('');
    setSubject('');
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-purple-200">Lesson Plans</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <Plus size={18} /> New Plan
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-purple-200 mb-4">Create Lesson Plan</h2>
          <form onSubmit={createPlan} className="space-y-4">
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Plan Title" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" required />
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" />
            <button type="submit" className="bg-purple-600 text-white px-6 py-2 rounded-lg">Save</button>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {plans.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <BookOpen size={48} className="text-purple-400 mx-auto mb-4" />
            <p className="text-purple-200">No lesson plans yet.</p>
          </div>
        ) : (
          plans.map(plan => (
            <div key={plan.id} className="glass-card p-4 flex justify-between items-center">
              <div>
                <h3 className="text-purple-200 font-semibold">{plan.title}</h3>
                <p className="text-purple-300 text-sm">{plan.subject}</p>
              </div>
              <Link href="/teacher/lessons" className="text-purple-300 hover:text-white">Manage Lessons</Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}