'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { MessageSquare, Send } from 'lucide-react';
import Toast from '@/components/Toast';

interface MessageRow {
  sender: string;
  message: string;
  timestamp: string;
}

// The backend returns NotificationDto rows ({type,title,body,createdAt});
// this component used to expect {sender,message,timestamp}, so every row
// rendered as an empty bubble and the thread showed "No messages yet."
// even after a successful send (audit EL-F-009). Map defensively so both
// shapes (and malformed rows) can never blank the thread again.
function toMessageRows(data: unknown): MessageRow[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      const r = row as Record<string, unknown>;
      const body = typeof r.body === 'string' && r.body.trim() ? r.body : typeof r.message === 'string' ? r.message : '';
      const created = typeof r.createdAt === 'string' ? r.createdAt : typeof r.timestamp === 'string' ? r.timestamp : '';
      const isTeacher = r.title === 'Message sent' || (typeof r.type === 'string' && r.type === 'MESSAGE' && r.title !== 'Guardian message');
      return { sender: isTeacher ? 'teacher' : 'guardian', message: body, timestamp: created };
    })
    .filter((m) => m.message.trim().length > 0);
}

export default function GuardianCommunication() {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
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
    fetchMessages();
  }, []);

  const handleSend = async () => {
    if (!newMsg.trim() || sending) return;
    setSending(true);
    try {
      await api.post('/guardian/messages', { recipient: 'teacher', message: newMsg });
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
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <MessageSquare size={48} className="text-purple-400 mx-auto mb-2" />
            <p className="text-purple-300">No messages yet.</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={'p-3 rounded-lg ' + (m.sender === 'teacher' ? 'bg-white/10' : 'bg-purple-600/20')}>
              <p className="text-purple-200 text-sm">{m.message}</p>
              <p className="text-purple-400 text-xs mt-1">{m.timestamp}</p>
            </div>
          ))
        )}
      </div>

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
          disabled={sending || !newMsg.trim()}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {sending ? 'Sending…' : <Send size={18} />}
        </button>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}