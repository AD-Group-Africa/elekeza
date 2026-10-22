'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Select, TextInput } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { useAuth } from '../AuthProvider';
import { AuthCard } from '../components/AuthCard';
import { PasswordInput } from '../components/PasswordInput';

/** Public learner sign-up. Staff and parents get accounts from their school. */
export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('MALE');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!termsAccepted) {
      setError('You must accept the Terms of Service and Privacy Policy.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      await register({ email, password, name: fullName, phone: phone || undefined, gender, termsAccepted });
      router.push('/onboarding/profile');
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Create a learner account"
      subtitle="Teachers, parents and school staff receive their accounts from their school."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field id="reg-fullName" label="Full name">
          <TextInput
            id="reg-fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full Name"
            autoComplete="name"
            required
          />
        </Field>
        <Field id="reg-email" label="Email">
          <TextInput
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
          />
        </Field>
        <Field id="reg-phone" label="Phone (optional)">
          <TextInput
            id="reg-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07XX XXX XXX"
            autoComplete="tel"
          />
        </Field>
        <Field id="reg-gender" label="Gender">
          <Select id="reg-gender" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </Select>
        </Field>
        <Field id="reg-password" label="Password (min 8 characters)">
          <PasswordInput
            id="reg-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        <div className="flex items-start gap-2">
          <input
            id="terms"
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 rounded"
          />
          <label htmlFor="terms" className="text-sm text-purple-200/80">
            I accept the Terms of Service and Privacy Policy.
          </label>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {busy ? 'Creating account…' : 'Register'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-purple-200/70">
        Already have an account?{' '}
        <Link href="/login" className="text-purple-300 hover:underline">
          Login
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-purple-200/70">
        Registering a school?{' '}
        <Link href="/school/onboarding" className="text-purple-300 hover:underline">
          Start here
        </Link>
      </p>
    </AuthCard>
  );
}
