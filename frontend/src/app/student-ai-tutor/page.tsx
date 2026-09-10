'use client';

import { useState } from 'react';
import Link from 'next/link';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { BrainCircuit, Send, Sparkles, Mic } from 'lucide-react';

const suggestions = [
  'Explain this concept',
  'Give me a practice problem',
  'Read this aloud',
  'Translate to Kiswahili',
  'Show me a diagram',
  'Summarize the lesson',
];

export default function AITutorPage() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    // Honest state: the conversational AI Tutor is NOT connected yet. The real
    // AI pathway in Elekeza today is content adaptation (lesson simplification)
    // — see /student-lessons. Never simulate an AI reply here.
    setMessages(prev => [...prev, { role: 'assistant', content: 'The AI Tutor is not connected yet — it\'s coming soon. Your learning preferences and adapted lessons already work today: open any assigned lesson to see your personalized view.' }]);
    setMessages(prev => [...prev, { role: 'assistant', content: '__LINK__' }]);
  };

  return (
    <SidebarLayout>
      <div className="max-w-2xl mx-auto space-y-6 h-[calc(100vh-100px)] flex flex-col">
        <div className="flex items-center gap-3">
          <BrainCircuit size={28} className="text-purple-300" />
          <h1 className="text-2xl font-bold text-purple-200">AI Tutor</h1>
          <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">Coming soon</span>
        </div>

        {/* Suggestions */}
        {messages.length === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => { setInput(s); }}
                className="glass-card p-3 text-left text-purple-200 hover:bg-white/10 transition text-sm"
                aria-label={s}
              >
                <Sparkles size={14} className="inline mr-1 text-purple-400" /> {s}
              </button>
            ))}
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 p-2">
          {messages.map((m, i) => (
            <div key={i} className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.content === '__LINK__' ? (
                <div className="max-w-[80%] p-3 rounded-lg bg-white/10 text-purple-200">
                  <Link href="/student-lessons" className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-sm inline-block">Open my lessons</Link>
                </div>
              ) : (
              <div className={'max-w-[80%] p-3 rounded-lg ' + (m.role === 'user' ? 'bg-purple-600/40 text-white' : 'bg-white/10 text-purple-200')}>
                {m.content}
              </div>
              )}
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <div className="flex gap-2">
          <button className="p-3 glass-card rounded-lg text-purple-300 hover:text-white" aria-label="AI tutor" disabled title="Coming soon"></button>
          <button className="p-3 glass-card rounded-lg text-purple-300 hover:text-white" disabled title="Voice input coming soon"><Mic size={20} aria-label="Voice input coming soon" /></button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything…"
            className="flex-1 px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button onClick={handleSend} className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
            <Send size={20} />
          </button>
        </div>
      </div>
    </SidebarLayout>
  );
}