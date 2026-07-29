'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { MessageSquare, Send, Users, CheckSquare, Calendar } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  guardianName: string;
  guardianEmail: string;
}

export default function TeacherCommunication() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState(false);

  useEffect(() => {
    api.get('/teacher/students').then(res => {
      // mock guardian data for now
      const list = res.data.map((s: any) => ({
        ...s,
        guardianName: s.guardianName || 'Guardian of ' + s.name,
        guardianEmail: s.guardianEmail || 'parent@example.com',
      }));
      setStudents(list);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const toggleStudent = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === students.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(students.map(s => s.id)));
  };

  const handleSend = async () => {
    if (!message.trim() || selectedIds.size === 0) return;
    try {
      await api.post('/notifications/send', {
        recipient: Array.from(selectedIds).join(','),
        message: message,
        type: meeting ? 'MEETING_REQUEST' : 'MESSAGE',
      });
      setSent(true);
      setMessage('');
      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-6 text-purple-200">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-purple-200">Communication</h1>
        <span className="text-purple-300 text-sm">{students.length} students</span>
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <label className="flex items-center gap-2 text-purple-200">
            <input type="checkbox" checked={selectedIds.size === students.length} onChange={selectAll} className="text-purple-600" />
            Select All
          </label>
          <span className="text-purple-300 text-sm">{selectedIds.size} selected</span>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {students.map(s => (
            <label key={s.id} className="flex items-center gap-2 text-purple-200 p-1 hover:bg-white/5 rounded">
              <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleStudent(s.id)} className="text-purple-600" />
              <span>{s.name}</span>
              <span className="text-purple-400 text-xs ml-auto">{s.guardianName}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setMeeting(!meeting)}
          className={'flex items-center gap-2 px-4 py-2 rounded-lg ' + (meeting ? 'bg-purple-600 text-white' : 'bg-white/10 text-purple-200 hover:bg-white/20')}
        >
          <Calendar size={18} /> Meeting Request
        </button>
      </div>

      <div className="glass-card p-4">
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={4}
          placeholder={meeting ? 'Write meeting request… (date, time, reason)' : 'Type your message…'}
          className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || selectedIds.size === 0}
          className="mt-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
        >
          <Send size={18} /> {meeting ? 'Send Meeting Request' : 'Send Message'}
        </button>
        {sent && <p className="text-green-400 text-sm mt-2">Sent successfully!</p>}
      </div>
    </div>
  );
}
