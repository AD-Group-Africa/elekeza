'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Field, TextInput } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { authApi } from '../api';
import { AuthCard } from '../components/AuthCard';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter the email address for your Elekeza account.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await authApi.forgotPassword(email.trim());
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Something went wrong. Please try again or contact your school administrator.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Forgot Password"
      subtitle="Enter the email address on your Elekeza account and we will send you a secure link to reset your password."
    >
      {done ? (
        <div className="space-y-3 text-center text-purple-200" role="status">
          <p>Check your email for a password reset link.</p>
          <p className="text-sm text-purple-300/70">
            Did not receive it? Check your spam folder, or ask your school administrator to help.
          </p>
          <Link href="/login" className="text-sm text-purple-300 underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field id="forgot-email" label="Email address" hint="This will only work for an existing Elekeza account.">
            <TextInput
              id="forgot-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.example"
              required
              autoComplete="email"
              aria-describedby="forgot-email-hint"
            />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-purple-300">
        Remember your password?{' '}
        <Link href="/login" className="text-purple-300 underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
