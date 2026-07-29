'use client';

import { useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { BrainCircuit, Send, Sparkles, BookOpen, Mic, Image } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Mock AI response – replace with real API call
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', content: 'I would explain it like this: ... (AI response will be connected soon)' }]);
      setLoading(false);
    }, 1500);
  };

  return (
    <SidebarLayout>
      <div className="max-w-2xl mx-auto space-y-6 h-[calc(100vh-100px)] flex flex-col">
        <div className="flex items-center gap-3">
          <BrainCircuit size={28} className="text-purple-300" />
          <h1 className="text-2xl font-bold text-purple-200">AI Tutor</h1>
        </div>

        {/* Suggestions */}
        {messages.length === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => { setInput(s); }}
                className="glass-card p-3 text-left text-purple-200 hover:bg-white/10 transition text-sm"
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
              <div className={'max-w-[80%] p-3 rounded-lg ' + (m.role === 'user' ? 'bg-purple-600/40 text-white' : 'bg-white/10 text-purple-200')}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div className="text-purple-400 text-sm animate-pulse">Thinking…</div>}
        </div>

        {/* Input Bar */}
        <div className="flex gap-2">
          <button className="p-3 glass-card rounded-lg text-purple-300 hover:text-white"><Image size={20} /></button>
          <button className="p-3 glass-card rounded-lg text-purple-300 hover:text-white"><Mic size={20} /></button>
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