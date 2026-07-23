'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { MessageSquare, Send } from 'lucide-react';

export default function GuardianCommunication() {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');

  const fetchMessages = async () => {
    try {
      const res = await api.get('/guardian/messages');
      setMessages(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleSend = async () => {
    if (!newMsg.trim()) return;
    try {
      await api.post('/guardian/messages', { recipient: 'teacher', message: newMsg });
      setNewMsg('');
      fetchMessages();
    } catch (err) {
      console.error(err);
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
        <button onClick={handleSend} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}