'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { AlertTriangle, Check, X, Plus } from 'lucide-react';

interface SupportSignal {
  id: number;
  learnerId: number;
  learnerName: string;
  signalType: string;
  status: string;
  reasons: string[];
}

interface Intervention {
  id: number;
  learnerId: number;
  type: string;
  target: string;
  status: string;
  startDate: string;
  reviewDate: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function TeacherSupport() {
  const [signals, setSignals] = useState<SupportSignal[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    learnerId: '',
    type: 'EXTRA_PRACTICE',
    target: '',
    startDate: today(),
    reviewDate: '',
  });

  const load = () => {
    api.get('/teacher/support-signals')
      .then(res => setSignals(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
    api.get('/teacher/interventions')
      .then(res => setInterventions(res.data || []))
      .catch(() => {});
  };

  useEffect(load, []);

  const act = (id: number, action: 'acknowledge' | 'dismiss') => {
    api.post(`/teacher/support-signals/${id}/${action}`)
      .then(() => { load(); setMessage(action === 'acknowledge' ? 'Signal acknowledged.' : 'Signal dismissed.'); })
      .catch(() => setMessage('Action failed.'));
  };

  const createIntervention = () => {
    if (!form.learnerId || !form.target.trim()) {
      setMessage('Select a learner and describe the support action.');
      return;
    }
    api.post('/teacher/interventions', {
      learnerId: Number(form.learnerId),
      type: form.type,
      target: form.target,
      startDate: form.startDate,
      reviewDate: form.reviewDate || null,
    })
      .then(() => {
        setMessage('Intervention created.');
        setShowForm(false);
        setForm({ learnerId: '', type: 'EXTRA_PRACTICE', target: '', startDate: today(), reviewDate: '' });
        load();
      })
      .catch(() => setMessage('Failed to create intervention.'));
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-purple-200">Support Signals</h1>
            <p className="text-purple-300 text-sm mt-1">Potential support required — review and act, never a final diagnosis.</p>
          </div>
          <button
            onClick={() => setShowForm(s => !s)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus size={18} /> Create Intervention
          </button>
        </div>

        {message && (
          <div className="glass-card p-3 text-sm text-purple-200 border border-purple-300/20">{message}</div>
        )}

        {showForm && (
          <div className="glass-card p-4 space-y-3">
            <h2 className="text-purple-200 font-semibold">New Intervention</h2>
            <select
              value={form.learnerId}
              onChange={e => setForm({ ...form, learnerId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border text-purple-200"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            >
              <option value="" className="bg-gray-800">Select learner…</option>
              {signals.map(s => (
                <option key={s.learnerId} value={s.learnerId} className="bg-gray-800">{s.learnerName}</option>
              ))}
            </select>
            <select
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border text-purple-200"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            >
              <option value="EXTRA_PRACTICE" className="bg-gray-800">Extra practice</option>
              <option value="REVIEW_SESSION" className="bg-gray-800">Review session</option>
              <option value="PEER_SUPPORT" className="bg-gray-800">Peer support</option>
              <option value="PARENT_CONTACT" className="bg-gray-800">Parent contact</option>
              <option value="OTHER" className="bg-gray-800">Other</option>
            </select>
            <input
              value={form.target}
              onChange={e => setForm({ ...form, target: e.target.value })}
              placeholder="Support action (e.g. weekly review of water-cycle strand with extra practice quiz)"
              className="w-full px-3 py-2 rounded-lg border text-purple-200 placeholder-purple-400/60"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            />
            <div className="flex gap-3">
              <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                className="flex-1 px-3 py-2 rounded-lg border text-purple-200"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }} />
              <input type="date" value={form.reviewDate} onChange={e => setForm({ ...form, reviewDate: e.target.value })}
                className="flex-1 px-3 py-2 rounded-lg border text-purple-200"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }} />
            </div>
            <button onClick={createIntervention} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg">
              Save Intervention
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-purple-300">Loading…</p>
        ) : signals.length === 0 ? (
          <div className="glass-card p-6 text-center text-purple-300">
            No open support signals. Signals are generated from learning data (low scores, declining performance, repeated failures, inactivity).
          </div>
        ) : (
          <div className="space-y-3">
            {signals.map(s => (
              <div key={s.id} className="glass-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-yellow-400 mt-1" />
                    <div>
                      <p className="text-purple-100 font-semibold">{s.learnerName}</p>
                      <p className="text-xs text-purple-300">{s.signalType.replace(/_/g, ' ')} · {s.status}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => act(s.id, 'acknowledge')}
                      className="flex items-center gap-1 text-xs bg-white/10 px-3 py-1.5 rounded-lg text-purple-200 hover:bg-white/20">
                      <Check size={14} /> Acknowledge
                    </button>
                    <button onClick={() => act(s.id, 'dismiss')}
                      className="flex items-center gap-1 text-xs bg-white/10 px-3 py-1.5 rounded-lg text-purple-200 hover:bg-white/20">
                      <X size={14} /> Dismiss
                    </button>
                  </div>
                </div>
                <div className="mt-3 pl-8">
                  <p className="text-sm text-purple-300">Why:</p>
                  <ul className="mt-1 space-y-1">
                    {s.reasons.map((r: string, i: number) => (
                      <li key={i} className="text-sm text-purple-200">• {r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}

        {interventions.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-purple-200 pt-2">Interventions</h2>
            <div className="space-y-3">
              {interventions.map(iv => (
                <div key={iv.id} className="glass-card p-4">
                  <div className="flex justify-between items-center">
                    <p className="text-purple-100 font-semibold">{iv.type.replace(/_/g, ' ')} · learner #{iv.learnerId}</p>
                    <span className="text-xs text-purple-300">{iv.status}</span>
                  </div>
                  <p className="text-sm text-purple-300 mt-1">{iv.target}</p>
                  <p className="text-xs text-purple-400 mt-1">
                    Start {iv.startDate}{iv.reviewDate ? ` · Review ${iv.reviewDate}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </SidebarLayout>
  );
}
