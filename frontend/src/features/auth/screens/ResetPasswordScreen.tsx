'use client';

/**
 * Password reset completion. The reset email links here with a single-use
 * token (?token=...), validated server-side: unknown, expired or used tokens
 * all return the same neutral message, so nothing leaks.
 */

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Alert, Button, ButtonLink, Field } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { authApi } from '../api';
import { AuthCard } from '../components/AuthCard';
import { PasswordInput } from '../components/PasswordInput';

function validate(token: string, password: string, confirm: string): string | null {
  if (!token) return 'This password reset link is invalid or has expired. Please request a new one.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))
    return 'Password must contain at least one letter and one number.';
  if (password !== confirm) return 'The two passwords do not match.';
  return null;
}

function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate(token, password, confirm);
    setError(problem ?? '');
    if (problem) return;
    setBusy(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Something went wrong. Please try again or contact your school administrator.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Choose a New Password">
      {done ? (
        <div className="space-y-4 text-center text-purple-200" role="status">
          <p>Your password has been reset. You can now sign in with your new password.</p>
          <ButtonLink href="/login" size="lg" className="w-full" data-testid="reset-success-signin">
            Back to sign in
          </ButtonLink>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" data-testid="reset-password-form">
          {!token && (
            <Alert tone="warning">
              This link is missing its reset token. Please use the link from your reset email, or request a new one.
            </Alert>
          )}
          <Field
            id="new-password"
            label="New password"
            hint="At least 8 characters, with at least one letter and one number."
          >
            <PasswordInput
              id="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              aria-describedby="new-password-hint"
            />
          </Field>
          <Field id="confirm-password" label="Confirm new password">
            <PasswordInput
              id="confirm-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" size="lg" className="w-full" loading={busy} data-testid="reset-submit">
            {busy ? 'Resetting…' : 'Reset password'}
          </Button>
          <p className="text-center">
            <Link href="/login" className="text-sm text-purple-300 underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
}

export default function ResetPasswordScreen() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
