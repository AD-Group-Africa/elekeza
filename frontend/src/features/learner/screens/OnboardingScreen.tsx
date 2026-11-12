'use client';

/**
 * Learner onboarding — persisted against the real backend (profile, optional
 * placement, optional guardian link, then "complete"). The placement step is
 * a short reading-check score, NOT a clinical diagnostic. Identity is
 * server-side: nothing here sends a learner id.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Field, Select, TextInput } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { getErrorMessage } from '@/lib/api';
import { roleHome } from '@/lib/roles';
import { learnerApi } from '../api';

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

export default function OnboardingScreen() {
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

  // Onboarding is learner-only; everyone else goes to their role home.
  useEffect(() => {
    if (!authLoading && user && user.role !== 'STUDENT') router.replace(roleHome(user.role));
  }, [authLoading, user, router]);

  const handleFinish = async () => {
    setError('');
    // The reading check is optional: validate it only when a score was entered,
    // and before anything is saved so a typo never leaves a half-saved profile.
    const hasPlacement = placementScore.trim() !== '';
    const score = Number(placementScore);
    const total = Number(placementTotal);
    if (
      hasPlacement &&
      (!Number.isInteger(score) || score < 0 || !Number.isInteger(total) || total < 1 || score > total)
    ) {
      setError('Enter a valid score (e.g. 6 out of 10), or leave the score empty to skip it.');
      return;
    }
    setSaving(true);
    try {
      await learnerApi.saveProfile({
        preferredLanguage,
        ageGroup,
        learningGoal: learningGoal.trim() || null,
        cognitiveProfiles: supportProfile === 'none' ? [] : [supportProfile],
      });
      if (hasPlacement) await learnerApi.savePlacement(score, total);
      if (guardianName.trim() && guardianContact.trim()) {
        const isEmail = guardianContact.includes('@');
        await learnerApi.linkGuardian({
          fullName: guardianName.trim(),
          relationship: guardianRelationship,
          phone: isEmail ? null : guardianContact.trim(),
          email: isEmail ? guardianContact.trim() : null,
        });
      }
      await learnerApi.completeOnboarding();
      router.push('/student-home');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save your profile. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6" aria-live="polite">
      <div>
        <h1 className="text-2xl font-bold text-purple-200">Set Up Your Learning</h1>
        <p className="text-sm text-purple-300">Step {step} of 3 · you can change these anytime in Settings.</p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}

      {step === 1 && (
        <Card padding="lg" className="space-y-4">
          <Field id="ob-lang" label="Preferred language">
            <Select id="ob-lang" value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="ob-age" label="Your age">
            <Select id="ob-age" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
              {AGE_GROUPS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="ob-goal" label="What do you want to get better at? (optional)">
            <TextInput
              id="ob-goal"
              value={learningGoal}
              onChange={(e) => setLearningGoal(e.target.value)}
              placeholder="e.g. Reading longer stories"
            />
          </Field>
          <Button size="lg" className="w-full" onClick={() => setStep(2)}>
            Next
          </Button>
        </Card>
      )}

      {step === 2 && (
        <Card padding="lg" className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="font-semibold text-purple-200">How do you learn best?</legend>
            <p className="text-sm text-purple-300">
              This changes how lessons look and sound for you. It is not a diagnosis — just your preferences.
            </p>
            {SUPPORT_PROFILES.map((p) => (
              <label key={p.value} className="flex cursor-pointer items-center gap-3 text-purple-200">
                <input
                  type="radio"
                  name="support-profile"
                  value={p.value}
                  checked={supportProfile === p.value}
                  onChange={(e) => setSupportProfile(e.target.value)}
                  className="h-4 w-4"
                />
                {p.label}
              </label>
            ))}
          </fieldset>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button size="lg" className="flex-1" onClick={() => setStep(3)}>
              Next
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card padding="lg" className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="font-semibold text-purple-200">Quick reading check (optional)</legend>
            <p className="text-sm text-purple-300">
              If your teacher gave you a short check, enter your score. We use it only to suggest a starting level — it
              is not a test you can fail.
            </p>
            <div className="flex items-center gap-3">
              <label htmlFor="ob-score" className="text-purple-200">
                Score
              </label>
              <TextInput
                id="ob-score"
                type="number"
                min={0}
                value={placementScore}
                onChange={(e) => setPlacementScore(e.target.value)}
                placeholder="e.g. 6"
                className="w-24"
              />
              <label htmlFor="ob-total" className="text-purple-300">
                out of
              </label>
              <TextInput
                id="ob-total"
                type="number"
                min={1}
                value={placementTotal}
                onChange={(e) => setPlacementTotal(e.target.value)}
                className="w-24"
              />
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="pt-2 font-semibold text-purple-200">Parent / guardian (optional)</legend>
            <Field id="ob-gname" label="Guardian name">
              <TextInput
                id="ob-gname"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                placeholder="e.g. Mama Ali"
              />
            </Field>
            <Field id="ob-gcontact" label="Phone or email">
              <TextInput
                id="ob-gcontact"
                value={guardianContact}
                onChange={(e) => setGuardianContact(e.target.value)}
                placeholder="07XX XXX XXX or parent@email.com"
              />
            </Field>
            <Field id="ob-grel" label="Relationship">
              <Select
                id="ob-grel"
                value={guardianRelationship}
                onChange={(e) => setGuardianRelationship(e.target.value)}
              >
                <option value="PARENT">Parent</option>
                <option value="GUARDIAN">Guardian</option>
                <option value="SIBLING">Sibling</option>
                <option value="OTHER">Other family</option>
              </Select>
            </Field>
          </fieldset>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button size="lg" className="flex-1" onClick={handleFinish} loading={saving}>
              {saving ? 'Saving…' : 'Finish'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
