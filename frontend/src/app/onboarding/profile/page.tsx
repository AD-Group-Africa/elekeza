'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import SidebarLayout from '@/components/layout/SidebarLayout';
import api from '@/lib/axios';

/**
 * Learner onboarding — persisted against the real backend:
 *   POST /api/onboarding/profile    (language, age group, goal, cognitive profiles)
 *   POST /api/onboarding/placement  (baseline score → BEGINNER/INTERMEDIATE/ADVANCED literacy level)
 *   POST /api/onboarding/guardian-link (optional guardian contact)
 *   POST /api/onboarding/complete   (flip onboarding_complete)
 *
 * The placement step is a short reading-check score entry, NOT a clinical
 * diagnostic: results are framed as learning indicators / support level.
 * Identity is server-side (the authenticated principal); nothing here sends
 * a learner id — the backend resolves it from the session.
 */

const AGE_GROUPS = [
  { value: 'CHILD', label: 'Under 13' },
  { value: 'TEEN', label: '13–19' },
  { value: 'ADULT', label: '20+' },
];

const SUPPORT_PROFILES = [
  { value: 'none', label: 'No additional support needed' },
  { value: 'dyslexia', label: 'Reading support (dyslexia-friendly text)' },
  { value: 'adhd', label: 'Focus support (shorter sections, movement breaks)' },
  { value: 'autism', label: 'Predictable layout, reduced stimulation' },
  { value: 'intellectual_disability', label: 'Simplified language, guided steps' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'sw', label: 'Kiswahili' },
];

export default function OnboardingProfile() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [ageGroup, setAgeGroup] = useState('CHILD');
  const [learningGoal, setLearningGoal] = useState('');
  const [supportProfile, setSupportProfile] = useState('none');
  const [placementScore, setPlacementScore] = useState('');
  const [placementTotal, setPlacementTotal] = useState('10');
  const [guardianName, setGuardianName] = useState('');
  const [guardianContact, setGuardianContact] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('PARENT');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && user && user.role !== 'STUDENT') {
      // Onboarding is learner-only; everyone else goes to their role home.
      router.replace(user.role === 'TEACHER' ? '/teacher' : user.role === 'GUARDIAN' ? '/guardian' : '/admin');
    }
  }, [authLoading, user, router]);

  const csrfPost = async (url: string, body?: unknown) => {
    await api.post(url, body ?? {});
  };

  const handleFinish = async () => {
    setError('');
    setSaving(true);
    try {
      const profiles = supportProfile === 'none' ? [] : [supportProfile];
      await csrfPost('/onboarding/profile', {
        preferredLanguage,
        ageGroup,
        learningGoal: learningGoal.trim() || null,
        cognitiveProfiles: profiles,
      });
      const score = Number(placementScore);
      const total = Number(placementTotal);
      if (
        !placementScore.trim() ||
        !Number.isInteger(score) || score < 0 ||
        !Number.isInteger(total) || total < 1 || score > total
      ) {
        setError('Enter a valid baseline score (e.g. 6 out of 10). This is optional guidance — you can leave it and finish.');
        setSaving(false);
        return;
      }
      await csrfPost('/onboarding/placement', { score, totalQuestions: total });
      if (guardianName.trim() && guardianContact.trim()) {
        const isEmail = guardianContact.includes('@');
        await csrfPost('/onboarding/guardian-link', {
          fullName: guardianName.trim(),
          relationship: guardianRelationship,
          phone: isEmail ? null : guardianContact.trim(),
          email: isEmail ? guardianContact.trim() : null,
        });
      }
      await csrfPost('/onboarding/complete');
      router.push('/student-home');
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="max-w-lg mx-auto space-y-6" aria-live="polite">
        <h1 className="text-2xl font-bold text-purple-200">Set Up Your Learning</h1>
        <p className="text-purple-300 text-sm">Step {step} of 3 · you can change these anytime in Settings.</p>
        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

        {step === 1 && (
          <div className="glass-card p-6 space-y-4">
            <label htmlFor="ob-lang" className="block text-purple-200">Preferred language</label>
            <select id="ob-lang" value={preferredLanguage} onChange={e => setPreferredLanguage(e.target.value)} className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white">
              {LANGUAGES.map(l => <option key={l.value} value={l.value} className="bg-gray-800">{l.label}</option>)}
            </select>
            <label htmlFor="ob-age" className="block text-purple-200">Your age</label>
            <select id="ob-age" value={ageGroup} onChange={e => setAgeGroup(e.target.value)} className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white">
              {AGE_GROUPS.map(a => <option key={a.value} value={a.value} className="bg-gray-800">{a.label}</option>)}
            </select>
            <label htmlFor="ob-goal" className="block text-purple-200">What do you want to get better at? (optional)</label>
            <input id="ob-goal" type="text" value={learningGoal} onChange={e => setLearningGoal(e.target.value)} placeholder="e.g. Reading longer stories" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50" />
            <button onClick={() => setStep(2)} className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg">Next</button>
          </div>
        )}

        {step === 2 && (
          <div className="glass-card p-6 space-y-4">
            <p className="text-purple-200 font-semibold">How do you learn best?</p>
            <p className="text-purple-300 text-sm">This changes how lessons look and sound for you. It is not a diagnosis — just your preferences.</p>
            <fieldset className="space-y-2">
              <legend className="sr-only">Learning support preference</legend>
              {SUPPORT_PROFILES.map(p => (
                <label key={p.value} className="flex items-center gap-3 text-purple-200 cursor-pointer">
                  <input
                    type="radio"
                    name="support-profile"
                    value={p.value}
                    checked={supportProfile === p.value}
                    onChange={e => setSupportProfile(e.target.value)}
                    className="h-4 w-4"
                  />
                  {p.label}
                </label>
              ))}
            </fieldset>
            <button onClick={() => setStep(3)} className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg">Next</button>
          </div>
        )}

        {step === 3 && (
          <div className="glass-card p-6 space-y-4">
            <p className="text-purple-200 font-semibold">Quick reading check (optional)</p>
            <p className="text-purple-300 text-sm">If your teacher gave you a short check, enter your score. We use it only to suggest a starting level — it is not a test you can fail.</p>
            <div className="flex items-center gap-3">
              <label htmlFor="ob-score" className="text-purple-200">Score</label>
              <input id="ob-score" type="number" min={0} value={placementScore} onChange={e => setPlacementScore(e.target.value)} placeholder="e.g. 6" className="w-24 px-3 py-2 bg-white/10 border border-purple-300/30 rounded-lg text-white" />
              <span className="text-purple-300">out of</span>
              <input id="ob-total" type="number" min={1} value={placementTotal} onChange={e => setPlacementTotal(e.target.value)} className="w-24 px-3 py-2 bg-white/10 border border-purple-300/30 rounded-lg text-white" />
            </div>
            <p className="text-purple-200 font-semibold pt-2">Parent / guardian (optional)</p>
            <label htmlFor="ob-gname" className="block text-purple-200 text-sm">Guardian name</label>
            <input id="ob-gname" type="text" value={guardianName} onChange={e => setGuardianName(e.target.value)} placeholder="e.g. Mama Ali" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50" />
            <label htmlFor="ob-gcontact" className="block text-purple-200 text-sm">Phone or email</label>
            <input id="ob-gcontact" type="text" value={guardianContact} onChange={e => setGuardianContact(e.target.value)} placeholder="07XX XXX XXX or parent@email.com" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50" />
            <label htmlFor="ob-grel" className="block text-purple-200 text-sm">Relationship</label>
            <select id="ob-grel" value={guardianRelationship} onChange={e => setGuardianRelationship(e.target.value)} className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white">
              <option value="PARENT" className="bg-gray-800">Parent</option>
              <option value="GUARDIAN" className="bg-gray-800">Guardian</option>
              <option value="SIBLING" className="bg-gray-800">Sibling</option>
              <option value="OTHER" className="bg-gray-800">Other family</option>
            </select>
            <button onClick={handleFinish} disabled={saving} className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg disabled:opacity-60">
              {saving ? 'Saving…' : 'Finish'}
            </button>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
