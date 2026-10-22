'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Upload, Check, ArrowRight, ArrowLeft, Send, Eye } from 'lucide-react';
import api from '@/lib/axios';

const STEPS = ['Details', 'Upload', 'Preview', 'Assign'] as const;

const INPUT = 'w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50';

export default function ContentPage() {
  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const handleUpload = async () => {
    setUploading(true);
    setMessage('');
    try {
      let res: { data?: { lessonId?: number; adapted?: boolean; message?: string } };
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        res = await api.post('/content/upload/file', formData);
      } else {
        res = await api.post('/content/upload/text', { title: topic, text: textContent });
      }
      setLessonId(res.data?.lessonId ?? null);
      setStep(2);
      // The backend reports whether AI adaptation actually ran (mock/offline
      // AI stores the raw text and flags adapted=false with a reason).
      setMessage(res.data?.adapted ? 'AI has simplified your lesson. Review it below.' : (res.data?.message || 'Content saved — review it below.'));
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage(msg || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setStep(0); setTopic(''); setFile(null); setTextContent(''); setLessonId(null); setMessage('');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-purple-200">Create New Lesson</h1>

      <ol className="flex flex-wrap items-center gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2" aria-current={i === step ? 'step' : undefined}>
            <div className={'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ' + (i === step ? 'bg-purple-600 text-white' : i < step ? 'bg-green-600 text-white' : 'bg-white/10 text-purple-300')}>
              {i < step ? <Check size={16} aria-label="done" /> : i + 1}
            </div>
            <span className="text-purple-300 text-xs hidden md:block">{s}</span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-purple-300/30" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-purple-200">Lesson Details</h2>
          <div>
            <label htmlFor="lesson-topic" className="block text-sm text-purple-300 mb-1">Lesson title / topic</label>
            <input id="lesson-topic" type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. The Water Cycle" className={INPUT} />
          </div>
          <button onClick={() => setStep(1)} disabled={!topic.trim()} className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
            Next <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-purple-200">Upload Content</h2>
          <div className="border-2 border-dashed border-purple-300/30 rounded-lg p-8 text-center">
            <Upload size={40} className="text-purple-300 mx-auto mb-3" aria-hidden="true" />
            <label htmlFor="lesson-file" className="text-purple-200">Upload a file (PDF, DOCX, TXT)</label>
            <input id="lesson-file" type="file" accept=".pdf,.docx,.txt,.doc" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full mt-4 text-purple-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white" />
            {file && <p className="text-purple-300 text-xs mt-2">File lessons are titled with the file name.</p>}
          </div>
          <div>
            <label htmlFor="lesson-text" className="block text-sm text-purple-300 mb-2">Or paste text:</label>
            <textarea id="lesson-text" value={textContent} onChange={e => setTextContent(e.target.value)} rows={6} className={INPUT} placeholder="Paste lesson content here..." disabled={!!file} />
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(0)} className="text-purple-300 flex items-center gap-1"><ArrowLeft size={18} aria-hidden="true" /> Back</button>
            <button onClick={handleUpload} disabled={(!file && !textContent.trim()) || uploading} className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
              {uploading ? 'Processing…' : 'Upload & Simplify'} <Check size={18} aria-hidden="true" />
            </button>
          </div>
          {message && <p className="text-purple-300 text-sm" role="alert">{message}</p>}
        </div>
      )}

      {step === 2 && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-purple-200">Preview</h2>
          <p className="text-purple-300" role="status">{message}</p>
          {lessonId != null && (
            <Link href={'/lesson/' + lessonId} className="text-purple-300 hover:text-white flex items-center gap-1">
              <Eye size={18} aria-hidden="true" /> Preview Lesson
            </Link>
          )}
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="text-purple-300 flex items-center gap-1"><ArrowLeft size={18} aria-hidden="true" /> Back</button>
            <button onClick={() => setStep(3)} className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2">
              Next <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-purple-200">Assign</h2>
          <p className="text-purple-300">Lesson created! Assign it to your students from the <Link href="/teacher/assignments" className="text-purple-400 underline">Assignments</Link> page.</p>
          <button onClick={reset} className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2">
            <Send size={18} aria-hidden="true" /> Create Another
          </button>
        </div>
      )}
    </div>
  );
}
