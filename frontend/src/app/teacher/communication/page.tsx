'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { MessageSquare, Reply, Send } from 'lucide-react';
import Toast from '@/components/Toast';

// NotificationDto from GET /api/teacher/messages: human messages addressed to
// the teacher carry senderId/senderName (V17 sender attribution). System
// notifications are excluded server-side; mapping stays defensive.
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

interface GuardianTarget {
  id: number;
  name: string;
  guardianName: string;
}

export default function TeacherCommunication() {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [replyTo, setReplyTo] = useState<number | ''>('');
  const [guardianTargets, setGuardianTargets] = useState<GuardianTarget[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/teacher/messages').then((res) => setMessages(toMessageRows(res.data))),
      // Reply targets: guardians of the teacher's learners (same tenant,
      // enforced server-side too).
      api.get('/teacher/students').then((res) => {
        const list: GuardianTarget[] = Array.isArray(res.data)
          ? res.data
              .map((s: Record<string, unknown>) => ({
                id: typeof s.guardianUserId === 'number' ? s.guardianUserId : 0,
                name: typeof s.name === 'string' ? s.name : 'Learner',
                guardianName:
                  typeof s.guardianName === 'string' && s.guardianName.trim()
                    ? s.guardianName
                    : 'Guardian of ' + (typeof s.name === 'string' ? s.name : 'learner'),
              }))
              .filter((g: GuardianTarget) => g.id > 0)
          : [];
        const unique = new Map<number, GuardianTarget>();
        list.forEach((g) => {
          if (!unique.has(g.id)) unique.set(g.id, g);
        });
        setGuardianTargets(Array.from(unique.values()));
      }),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSend = async () => {
    if (!message.trim() || sending || !replyTo) return;
    setSending(true);
    try {
      await api.post('/notifications/send', {
        recipient: String(replyTo),
        message,
        type: 'MESSAGE',
      });
      setMessage('');
      setToast('Reply sent!');
      const res = await api.get('/teacher/messages');
      setMessages(toMessageRows(res.data));
    } catch (err) {
      setToast('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-purple-200">Communication</h1>
        <span className="text-purple-300 text-sm">{messages.length} messages</span>
      </div>

      {loading ? (
        <p className="text-purple-200">Loading…</p>
      ) : (
        <>
          <div className="glass-card p-4 space-y-3 max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-center py-4">
                <MessageSquare size={48} className="text-purple-400 mx-auto mb-2" />
                <p className="text-purple-300">No messages from guardians yet.</p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={m.id ?? i} className="p-3 rounded-lg bg-white/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-purple-300 text-xs font-semibold">{m.senderName || 'Guardian'}</p>
                    {m.senderId != null && (
                      <button
                        onClick={() => setReplyTo(m.senderId as number)}
                        className={
                          'flex items-center gap-1 text-xs px-2 py-1 rounded ' +
                          (replyTo === m.senderId
                            ? 'bg-purple-600 text-white'
                            : 'bg-white/10 text-purple-200 hover:bg-white/20')
                        }
                      >
                        <Reply size={12} /> {replyTo === m.senderId ? 'Replying' : 'Reply'}
                      </button>
                    )}
                  </div>
                  <p className="text-purple-200 text-sm">{m.message}</p>
                  <p className="text-purple-400 text-xs">{m.timestamp}</p>
                </div>
              ))
            )}
          </div>

          <div className="glass-card p-4 space-y-3">
            <label className="block text-purple-200 text-sm">
              {replyTo ? 'Reply to guardian' : 'Choose a guardian'}
              <select
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value ? Number(e.target.value) : '')}
                className="mt-1 w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {replyTo ? (
                  <option value={replyTo} className="bg-purple-900">
                    {(() => {
                      const sender = messages.find((m) => m.senderId === replyTo);
                      const target = guardianTargets.find((g) => g.id === replyTo);
                      return sender?.senderName || target?.guardianName || `Guardian #${replyTo}`;
                    })()}
                  </option>
                ) : (
                  <option value="">Select a guardian…</option>
                )}
                {guardianTargets
                  .filter((g) => g.id !== replyTo)
                  .map((g) => (
                    <option key={g.id} value={g.id} className="bg-purple-900">
                      {g.guardianName} ({g.name})
                    </option>
                  ))}
              </select>
            </label>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Type your reply…"
              className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || !replyTo || sending}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              <Send size={18} /> {sending ? 'Sending…' : 'Send Reply'}
            </button>
          </div>
        </>
      )}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
