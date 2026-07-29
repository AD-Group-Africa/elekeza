'use client';

import { useState } from 'react';
import api from '@/lib/axios';
import { Upload, FileText, Check, ArrowRight, ArrowLeft, Send, Eye } from 'lucide-react';
import Link from 'next/link';

const STEPS = ['Details', 'Upload', 'AI Simplify', 'Preview', 'Personalize', 'Assign'];

export default function ContentPage() {
  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const handleUpload = async () => {
    setUploading(true);
    try {
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('topic', topic);
        formData.append('subject', subject);
        const res = await api.post('/content/upload/file', formData);
        setLessonId(res.data.lessonId);
      } else {
        const res = await api.post('/content/upload/text', { title: topic, text: textContent, subject });
        setLessonId(res.data.lessonId);
      }
      setStep(3);
      setMessage('AI has simplified your lesson. Review below.');
    } catch (err) {
      setMessage('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-purple-200">Create New Lesson</h1>

      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ' + (i === step ? 'bg-purple-600 text-white' : i < step ? 'bg-green-600 text-white' : 'bg-white/10 text-purple-300')}>
              {i < step ? <Check size={16} /> : i + 1}
            </div>
            <span className="text-purple-300 text-xs hidden md:block">{s}</span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-purple-300/30" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-purple-200">Lesson Details</h2>
          <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="Lesson Title / Topic" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50" />
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject (e.g., Mathematics)" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50" />
          <button onClick={() => setStep(1)} disabled={!topic.trim()} className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
            Next <ArrowRight size={18} />
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-purple-200">Upload Content</h2>
          <div className="border-2 border-dashed border-purple-300/30 rounded-lg p-8 text-center">
            <Upload size={40} className="text-purple-300 mx-auto mb-3" />
            <p className="text-purple-200">Upload a file (PDF, DOCX, TXT, image)</p>
            <input type="file" accept=".pdf,.docx,.txt,.doc,image/*" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full mt-4 text-purple-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white" />
            {file && <p className="text-purple-300 mt-2">{file.name}</p>}
          </div>
          <div className="relative">
            <p className="text-sm text-purple-300 mb-2">Or paste text:</p>
            <textarea value={textContent} onChange={e => setTextContent(e.target.value)} rows={6} className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50" placeholder="Paste lesson content here..." />
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(0)} className="text-purple-300 flex items-center gap-1"><ArrowLeft size={18} /> Back</button>
            <button onClick={handleUpload} disabled={(!file && !textContent.trim()) || uploading} className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
              {uploading ? 'Processing…' : 'Upload & Simplify'} <Check size={18} />
            </button>
          </div>
          {message && <p className="text-purple-300 text-sm">{message}</p>}
        </div>
      )}

      {step === 3 && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-purple-200">Preview</h2>
          <p className="text-purple-300">{message}</p>
          <Link href={'/lesson/' + lessonId} className="text-purple-300 hover:text-white flex items-center gap-1">
            <Eye size={18} /> Preview Lesson
          </Link>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="text-purple-300 flex items-center gap-1"><ArrowLeft size={18} /> Back</button>
            <button onClick={() => setStep(4)} className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2">
              Next <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-purple-200">Personalize</h2>
          <p className="text-purple-300">(Coming soon) Adjust difficulty, add SNE adaptations, or create multiple versions.</p>
          <div className="flex justify-between">
            <button onClick={() => setStep(3)} className="text-purple-300 flex items-center gap-1"><ArrowLeft size={18} /> Back</button>
            <button onClick={() => setStep(5)} className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2">
              Next <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-purple-200">Assign</h2>
          <p className="text-purple-300">Lesson created! Assign it to your students from the <Link href="/teacher/assignments" className="text-purple-400 underline">Assignments</Link> page.</p>
          <button onClick={() => { setStep(0); setTopic(''); setSubject(''); setFile(null); setTextContent(''); setLessonId(null); }} className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2">
            <Send size={18} /> Create Another
          </button>
        </div>
      )}
    </div>
  );
}