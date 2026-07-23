'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import SidebarLayout from '@/components/layout/SidebarLayout';

export default function OnboardingProfile() {
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [grade, setGrade] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [sneType, setSneType] = useState('NONE');

  const handleFinish = () => {
    // In a real app, POST to backend to update profile. For now, redirect.
    router.push(user?.role === 'TEACHER' ? '/teacher' : '/student-home');
  };

  return (
    <SidebarLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-purple-200">Complete Your Profile</h1>
        {step === 1 && (
          <div className="glass-card p-6 space-y-4">
            <label className="block text-purple-200">Select Grade</label>
            <select value={grade} onChange={e => { setGrade(e.target.value); setStep(2); }} className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white">
              <option value="">-- Choose --</option>
              {[4,5,6].map(g => <option key={g} value={'Grade '+g}>{'Grade '+g}</option>)}
            </select>
          </div>
        )}
        {step === 2 && (
          <div className="glass-card p-6 space-y-4">
            <p className="text-purple-200">Select Subjects</p>
            {['Mathematics','English','Kiswahili','Integrated Science','Social Studies'].map(s => (
              <label key={s} className="flex items-center gap-2 text-purple-200">
                <input type="checkbox" checked={subjects.includes(s)} onChange={e => setSubjects(prev => e.target.checked ? [...prev, s] : prev.filter(x => x!==s))} className="text-purple-600" />
                {s}
              </label>
            ))}
            <button onClick={() => setStep(3)} className="bg-purple-600 text-white px-6 py-2 rounded-lg">Next</button>
          </div>
        )}
        {step === 3 && (
          <div className="glass-card p-6 space-y-4">
            <label className="block text-purple-200">Special Educational Needs (if any)</label>
            <select value={sneType} onChange={e => setSneType(e.target.value)} className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white">
              <option value="NONE">None</option>
              <option value="DYSLEXIA">Dyslexia</option>
              <option value="ADHD">ADHD</option>
              <option value="AUTISM">Autism</option>
              <option value="INTELLECTUAL">Intellectual Disability</option>
            </select>
            <button onClick={handleFinish} className="bg-purple-600 text-white px-6 py-2 rounded-lg w-full">Finish</button>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}