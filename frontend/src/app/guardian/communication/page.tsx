'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { MessageSquare, Send } from 'lucide-react';
import Toast from '@/components/Toast';

interface TeacherOption {
  id: number;
  name: string;
  email: string;
}

// NotificationDto shape from GET /api/guardian/messages: messages sent TO the
// guardian carry senderId/senderName (V17 sender attribution). Rows without a
// sender are system notifications and are excluded server-side; the mapping
// stays defensive so a malformed row can never blank the thread.
interface MessageRow {
  id?: number;
  senderId?: number | null;
  senderName?: string | null;
  message: string;
  timestamp: string;
}

function toMessageRows(data: unknown): MessageRow[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      const r = row as Record<string, unknown>;
      const body = typeof r.body === 'string' && r.body.trim() ? r.body : typeof r.message === 'string' ? r.message : '';
      const created = typeof r.createdAt === 'string' ? r.createdAt : typeof r.timestamp === 'string' ? r.timestamp : '';
      return {
        id: typeof r.id === 'number' ? r.id : undefined,
        senderId: typeof r.senderId === 'number' ? r.senderId : null,
        senderName: typeof r.senderName === 'string' ? r.senderName : null,
        message: body,
        timestamp: created,
      };
    })
    .filter((m) => m.message.trim().length > 0);
}

export default function GuardianCommunication() {
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<number | ''>('');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const fetchMessages = async () => {
    try {
      const res = await api.get('/guardian/messages');
      setMessages(toMessageRows(res.data));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    Promise.all([
      api.get('/guardian/teachers').then((res) => {
        const list: TeacherOption[] = Array.isArray(res.data) ? res.data : [];
        setTeachers(list);
        if (list.length > 0) setSelectedTeacher(list[0].id);
      }),
      fetchMessages(),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSend = async () => {
    if (!newMsg.trim() || sending || !selectedTeacher) return;
    setSending(true);
    try {
      await api.post('/guardian/messages', { recipientUserId: selectedTeacher, message: newMsg });
      setNewMsg('');
      setToast('Message sent!');
      fetchMessages();
    } catch (err) {
      setToast('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-purple-200">Communication</h1>

      <div className="glass-card p-4 space-y-3 max-h-96 overflow-y-auto">
        {loading ? (
          <p className="text-purple-300 text-center py-4">Loading…</p>
        ) : messages.length === 0 ? (
          <div className="text-center py-4">
            <MessageSquare size={48} className="text-purple-400 mx-auto mb-2" />
            <p className="text-purple-300">No messages yet.</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={m.id ?? i} className="p-3 rounded-lg bg-white/10">
              <p className="text-purple-300 text-xs font-semibold">{m.senderName || 'School'}</p>
              <p className="text-purple-200 text-sm">{m.message}</p>
              <p className="text-purple-400 text-xs mt-1">{m.timestamp}</p>
            </div>
          ))
        )}
      </div>

      <div className="glass-card p-4 space-y-3">
        <label className="block text-purple-200 text-sm">
          Send to teacher
          <select
            value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value ? Number(e.target.value) : '')}
            className="mt-1 w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={teachers.length === 0}
          >
            {teachers.length === 0 ? (
              <option value="">No teachers available at your child&apos;s school</option>
            ) : (
              teachers.map((t) => (
                <option key={t.id} value={t.id} className="bg-purple-900">
                  {t.name}
                </option>
              ))
            )}
          </select>
        </label>

        <div className="flex gap-2">
          <input
            type="text"
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            placeholder="Type a message to the teacher…"
            className="flex-1 px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={handleSend}
            disabled={sending || !newMsg.trim() || !selectedTeacher}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {sending ? 'Sending…' : <Send size={18} />}
          </button>
        </div>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
