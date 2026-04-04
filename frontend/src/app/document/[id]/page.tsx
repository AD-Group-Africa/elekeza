'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const API_URL = "http://127.0.0.1:8000";

export default function DocumentViewer() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const docId = params.id;

  const [originalText, setOriginalText] = useState('');
  const [simplificationData, setSimplificationData] = useState<any>(null);
  const [termsData, setTermsData] = useState<any>(null);
  const [outputText, setOutputText] = useState('');
  const [readingScore, setReadingScore] = useState('');
  const [chatHistory, setChatHistory] = useState<{ user: string; ai: string }[]>([]);
  const [question, setQuestion] = useState('');
  const [actionStatus, setActionStatus] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  // --- Fetch extracted text ---
  useEffect(() => {
    async function fetchText() {
      try {
        const res = await fetch(`${API_URL}/get-processed-document?document_id=${docId}`);
        if (!res.ok) throw new Error('Failed to fetch document');
        const data = await res.json();
        setOriginalText(data.text || '');
      } catch (err) {
        console.error(err);
        setOriginalText("Failed to load document.");
      }
    }
    fetchText();
  }, [docId]);

  // --- Simplify ---
  async function simplifyText() {
    if (!originalText) return alert("No text to simplify.");
    setActionStatus("Simplifying...");
    try {
      const res = await fetch(`${API_URL}/simplify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: originalText })
      });
      const data = await res.json();
      setSimplificationData(data);
      setActionStatus("Simplification complete!");
      showTab('child');
    } catch (err) {
      console.error(err);
      setActionStatus("Error simplifying.");
    }
  }

  // --- Extract terms ---
  async function extractTerms() {
    if (!originalText) return alert("No text to extract terms from.");
    setActionStatus("Extracting terms...");
    try {
      const res = await fetch(`${API_URL}/extract-terms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: originalText })
      });
      const data = await res.json();
      setTermsData(data);
      setActionStatus("Terms extracted!");
      showTab('terms');
    } catch (err) {
      console.error(err);
      setActionStatus("Error extracting terms.");
    }
  }

  function showTab(tab: 'child' | 'teen' | 'adult' | 'terms') {
    if (tab === 'terms') {
      if (!termsData) return;
      setOutputText(termsData.terms.map((t: any) => `• ${t.term}: ${t.definition}`).join('\n\n'));
      setReadingScore(`Found ${termsData.count} key terms.`);
    } else {
      if (!simplificationData) return;
      setOutputText(simplificationData[tab]);
      if(simplificationData.reading_analysis?.simplified?.[tab]) {
        const stats = simplificationData.reading_analysis.simplified[tab].analysis;
        setReadingScore(`Grade Level: ${stats.grade_level} | Reading Ease: ${stats.reading_ease}`);
      }
    }
  }

  // --- Ask question ---
  async function askQuestion() {
    if (!question.trim()) return;
    const q = question.trim();
    setChatHistory(prev => [...prev, { user: q, ai: '' }]);
    setQuestion('');
    try {
      const res = await fetch(`${API_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId, question: q })
      });
      const data = await res.json();
      setChatHistory(prev => prev.map((c, i) => i === prev.length - 1 ? { ...c, ai: data.answer } : c));
    } catch (err) {
      setChatHistory(prev => prev.map((c, i) => i === prev.length - 1 ? { ...c, ai: 'Error: Failed to get answer.' } : c));
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-elekeza-indigo mx-auto mb-4"></div>
          <p className="text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-100 font-sans max-w-6xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-blue-600">Document Viewer</h1>

      {/* Extracted Text */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="font-bold mb-2">Original Text</h2>
        <textarea value={originalText} onChange={e => setOriginalText(e.target.value)} className="w-full h-64 border rounded p-2 text-sm"></textarea>
        <div className="mt-4 flex space-x-2">
          <button onClick={simplifyText} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Simplify</button>
          <button onClick={extractTerms} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">Extract Terms</button>
        </div>
        <p className="text-sm text-gray-500 mt-2">{actionStatus}</p>
      </div>

      {/* AI Output */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="font-bold mb-2">AI Output</h2>
        <div className="flex space-x-2 mb-2 border-b pb-2">
          {['child','teen','adult','terms'].map(tab => (
            <button key={tab} onClick={() => showTab(tab as any)} className={`text-sm font-bold ${tab==='terms'?'text-purple-600':'text-blue-600'}`}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <textarea value={outputText} readOnly className="w-full h-48 border rounded p-2 text-sm bg-gray-50"></textarea>
        <p className="text-xs text-gray-500 mt-2">{readingScore}</p>
      </div>

      {/* Chat */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="font-bold mb-2">Chat with Document</h2>
        <div className="h-48 border rounded p-4 overflow-y-auto bg-gray-50 text-sm space-y-2">
          {chatHistory.length === 0 ? <p className="text-gray-400 italic">Ask a question to start chatting...</p> :
            chatHistory.map((c, i) => (
              <div key={i}>
                <p><strong>You:</strong> {c.user}</p>
                <p className="text-blue-700"><strong>AI:</strong> {c.ai}</p>
              </div>
            ))
          }
        </div>
        <div className="flex space-x-2 mt-2">
          <input type="text" value={question} onChange={e => setQuestion(e.target.value)} className="flex-1 border rounded p-2" placeholder="Ask a question..." />
          <button onClick={askQuestion} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Ask</button>
        </div>
      </div>
    </div>
  )
}
