'use client';

import { Fragment, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { Search, Plus, User, HeartHandshake, RefreshCw, Info } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  email: string;
  sneType: string;
}

interface SupportSummary {
  studentId?: number;
  studentName?: string;
  mastery?: number;
  respondsWellTo?: string[];
  currentlyBenefitsFrom?: { lessonId?: number; note?: string }[];
  presentation?: Record<string, string>;
  aiConfidence?: string;
  profileSource?: string[];
}

// One-line friendly render of the effective presentation values.
const PRESENTATION_LABELS: Record<string, (v: string) => string> = {
  density: (v) => ({ COMPACT: 'More at once', STANDARD: 'Balanced layout', SPACIOUS: 'Roomier layout' }[v] || v),
  explanationStyle: (v) => ({ CONCISE: 'Short and clear', STEP_BY_STEP: 'Step-by-step', EXAMPLE_FIRST: 'Examples first', DETAILED: 'Detailed' }[v] || v),
  exampleFrequency: (v) => ({ LOW: 'Few examples', MEDIUM: 'Some examples', HIGH: 'Plenty of examples' }[v] || v),
  textSize: (v) => ({ SMALL: 'Smaller text', MEDIUM: 'Standard text', LARGE: 'Larger text' }[v] || v),
  contrast: (v) => (v === 'HIGH' ? 'High contrast' : 'Standard contrast'),
  visualSupport: (v) => (v === 'true' ? 'Visual support' : ''),
  readAloud: (v) => (v === 'true' ? 'Listen button' : ''),
};

const GUIDE_OPTIONS: { key: string; value: string; label: string }[] = [
  { key: 'explanationStyle', value: 'STEP_BY_STEP', label: 'Prefer step-by-step' },
  { key: 'explanationStyle', value: 'EXAMPLE_FIRST', label: 'Prefer examples first' },
  { key: 'density', value: 'SPACIOUS', label: 'Roomier layout' },
  { key: 'exampleFrequency', value: 'HIGH', label: 'More examples' },
];

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newSneType, setNewSneType] = useState('NONE');
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [support, setSupport] = useState<Record<string, SupportSummary>>({});
  const [supportLoading, setSupportLoading] = useState<string | null>(null);
  const [supportError, setSupportError] = useState<Record<string, string>>({});
  const [guideMsg, setGuideMsg] = useState<Record<string, string>>({});

  const fetchStudents = async () => {
    try {
      const res = await api.get('/teacher/students');
      setStudents(res.data);
    } catch {
      console.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const loadSupport = async (student: Student) => {
    const id = student.id;
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (support[id]) return;
    setSupportLoading(id);
    setSupportError((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await api.get(`/teacher/student/${Number(id)}/learning-support`);
      setSupport((prev) => ({ ...prev, [id]: res.data as SupportSummary }));
    } catch (err) {
      setSupportError((prev) => ({
        ...prev,
        [id]: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not load learning support.',
      }));
    } finally {
      setSupportLoading(null);
    }
  };

  const applyGuidance = async (student: Student, key: string, value: string) => {
    const id = student.id;
    setGuideMsg((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await api.post(`/teacher/student/${Number(id)}/learning-preferences`, { key, value });
      setGuideMsg((prev) => ({ ...prev, [id]: `Guidance saved (${res.data.source}). The student can still change it.` }));
      loadSupport(student);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg = status === 409
        ? 'This learner chose this preference themselves — respect their choice. Guidance was not applied.'
        : 'Could not apply that guidance.';
      setGuideMsg((prev) => ({ ...prev, [id]: msg }));
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    if (adding) return;
    setAdding(true);
    e.preventDefault();
    try {
      await api.post('/teacher/student', {
        email: newEmail,
        fullName: newName,
        password: newPassword,
        sneType: newSneType,
      });
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewSneType('NONE');
      setShowForm(false);
      setMessage('Student added successfully!');
      fetchStudents();
    } catch {
      setMessage('Failed to add student.');
    } finally {
      setAdding(false);
    }
  };

  const filtered = students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-purple-200">Student Management</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={18} /> Add Student
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-purple-200 mb-4">Add New Student</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full Name"
              className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" required />
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email"
              className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" required />
            <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Password"
              className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" required />
            <select value={newSneType} onChange={(e) => setNewSneType(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white">
              <option value="NONE">No SNE</option>
              <option value="DYSLEXIA">Dyslexia</option>
              <option value="ADHD">ADHD</option>
              <option value="AUTISM">Autism</option>
              <option value="INTELLECTUAL">Intellectual Disability</option>
            </select>
            <button type="submit" disabled={adding}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg disabled:opacity-50">{adding ? 'Adding…' : 'Add'}</button>
          </form>
          {message && <p className="text-purple-300 text-sm mt-3">{message}</p>}
        </div>
      )}

      <div className="glass-card p-4">
        <div className="relative mb-4">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-300" />
          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white"
          />
        </div>
        {loading ? (
          <p className="text-purple-300">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <User size={48} className="text-purple-400 mx-auto mb-4" />
            <p className="text-purple-200">No students found.</p>
            <button onClick={() => setShowForm(true)} className="mt-3 bg-purple-600 text-white px-4 py-2 rounded-lg">Add Student</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-purple-200">
              <thead className="text-purple-300 text-sm">
                <tr>
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Email</th>
                  <th className="text-left py-2">SNE Type</th>
                  <th className="text-left py-2">Learning support</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const summary = support[s.id];
                  const isOpen = expanded === s.id;
                  return (
                    <Fragment key={s.id}>
                      <tr className="border-t border-purple-300/10 align-top">
                        <td className="py-3">{s.name}</td>
                        <td className="py-3 text-purple-300">{s.email}</td>
                        <td className="py-3">
                          <span className="px-2 py-1 rounded-full text-xs bg-purple-600/40">{s.sneType || 'None'}</span>
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => loadSupport(s)}
                            className="flex items-center gap-2 text-sm text-purple-200 bg-white/5 hover:bg-white/10 border border-purple-300/20 rounded-lg px-3 py-1.5"
                          >
                            <HeartHandshake size={15} /> {isOpen ? 'Hide support' : 'View support'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-t border-purple-300/10">
                          <td colSpan={4} className="py-3 pl-4">
                            {supportError[s.id] ? (
                              <p className="text-amber-300 text-sm flex items-center gap-1">
                                <Info size={14} /> {supportError[s.id]}
                              </p>
                            ) : supportLoading === s.id ? (
                              <p className="text-purple-300 text-sm flex items-center gap-2">
                                <RefreshCw size={14} className="animate-spin" /> Loading learning support…
                              </p>
                            ) : summary ? (
                              <div className="text-sm text-purple-200 space-y-3">
                                <div className="flex flex-wrap gap-6">
                                  <div>
                                    <p className="text-xs text-purple-300/80 uppercase tracking-wide">Current mastery</p>
                                    <p className="text-lg font-semibold text-purple-100">{Math.round(summary.mastery || 0)}%</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-purple-300/80 uppercase tracking-wide">AI confidence</p>
                                    <p className="text-lg font-semibold text-purple-100">{summary.aiConfidence || 'Emerging'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-purple-300/80 uppercase tracking-wide">Profile set by</p>
                                    <p className="text-lg font-semibold text-purple-100">
                                      {(summary.profileSource || ['SYSTEM']).map((src) =>
                                        ({ EXPLICIT: 'The student', TEACHER: 'Teachers', GUARDIAN: 'Parent/guardian', SYSTEM: 'Standard defaults', OBSERVED: 'Learning signals' }[src] || src)
                                      ).join(', ')}
                                    </p>
                                  </div>
                                </div>

                                <div>
                                  <p className="text-xs text-purple-300/80 uppercase tracking-wide mb-1">Responds well to</p>
                                  {summary.respondsWellTo && summary.respondsWellTo.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {summary.respondsWellTo.map((item) => (
                                        <span key={item} className="px-2.5 py-1 rounded-full text-xs bg-green-600/30 text-green-200">✓ {item}</span>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-purple-300/70">Not enough evidence yet — keep teaching as usual.</p>
                                  )}
                                </div>

                                <div>
                                  <p className="text-xs text-purple-300/80 uppercase tracking-wide mb-1">Currently benefits from</p>
                                  {summary.currentlyBenefitsFrom && summary.currentlyBenefitsFrom.length > 0 ? (
                                    <ul className="list-disc list-inside text-purple-300 space-y-0.5">
                                      {summary.currentlyBenefitsFrom.map((item, i) => (
                                        <li key={i}>{item.note}{item.lessonId ? ` (lesson ${item.lessonId})` : ''}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-purple-300/70">Nothing flagged — steady progress.</p>
                                  )}
                                </div>

                                <div>
                                  <p className="text-xs text-purple-300/80 uppercase tracking-wide mb-1">Preferred presentation</p>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(summary.presentation || {})
                                      .map(([key, value]) => ({ key, label: (PRESENTATION_LABELS[key] || ((v: string) => v))(value) }))
                                      .filter((item) => item.label.length > 0)
                                      .map(({ key, label }) => (
                                        <span key={key} className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-purple-200">
                                          {label}
                                        </span>
                                      ))}
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-purple-300/10">
                                  <p className="text-xs text-purple-300/80 uppercase tracking-wide mb-2">Add your guidance</p>
                                  <div className="flex flex-wrap gap-2">
                                    {GUIDE_OPTIONS.map((option) => (
                                      <button
                                        key={option.key + option.value}
                                        onClick={() => applyGuidance(s, option.key, option.value)}
                                        className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-purple-300/20 text-purple-200"
                                      >
                                        {option.label}
                                      </button>
                                    ))}
                                  </div>
                                  {guideMsg[s.id] && <p className="text-xs text-amber-200 mt-2">{guideMsg[s.id]}</p>}
                                  <p className="text-[11px] text-purple-300/60 mt-2">
                                    If a student chose a preference themselves, their choice always wins — Elekeza never overrides the learner.
                                  </p>
                                </div>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
