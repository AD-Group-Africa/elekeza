'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/axios';

/**
 * Password reset completion page. The reset email links here with a
 * single-use token (?token=...). The token is validated server-side:
 * unknown, expired or already-used tokens all return the same neutral
 * message — no information leaks. On success the user is returned to the
 * sign-in page.
 */
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('This password reset link is invalid or has expired. Please request a new one.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain at least one letter and one number.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
    } catch (err) {
      const payload = err as { response?: { data?: { message?: string } } };
      setError(
        (payload?.response?.data?.message as string | undefined) ??
          'Something went wrong. Please try again or contact your school administrator.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-purple-200 text-center mb-6">Choose a New Password</h1>

        {done ? (
          <div className="text-center text-purple-200" role="status">
            <p className="mb-4">Your password has been reset. You can now sign in with your new password.</p>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 rounded-lg shadow-md hover:opacity-90 transition disabled:opacity-60"
              data-testid="reset-success-signin"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" data-testid="reset-password-form">
            {!token && (
              <p className="text-sm text-purple-300 mb-2" role="alert">
                This link is missing its reset token. Please use the link from your reset email, or request a new one.
              </p>
            )}
            <div>
              <label htmlFor="new-password" className="block text-sm text-purple-300 mb-1">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm text-purple-300 mb-1">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="••••••••"
              />
            </div>
            <p id="reset-help" className="text-xs text-purple-300/70">At least 8 characters, with at least one letter and one number.</p>
            {error && (
              <p className="text-red-400 text-sm" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 rounded-lg shadow-md hover:opacity-90 transition disabled:opacity-60"
              data-testid="reset-submit"
            >
              {busy ? 'Resetting…' : 'Reset password'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="text-purple-300 underline text-sm w-full text-center"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
