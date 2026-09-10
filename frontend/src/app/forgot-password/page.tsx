'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';

export default function ForgotPasswordPage() {
  const router = useRouter();
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
      await api.post('/api/auth/forgot-password', { email: email.trim() });
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
        <h1 className="text-3xl font-bold text-purple-200 text-center mb-6">Forgot Password</h1>
        <p className="text-purple-300 text-center mb-6">
          Enter the email address on your Elekeza account and we will send you a secure link to reset your password.
        </p>

        {done ? (
          <div className="text-center text-purple-200">
            <p className="mb-2">Check your email for a password reset link.</p>
            <p className="text-sm text-purple-300/70 mb-4">
              Did not receive it? Check your spam folder, or{' '}
              <a href="/login" className="text-purple-300 underline">sign in</a> and ask your school
              administrator to help.
            </p>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="text-purple-300 underline text-sm"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label
                id="forgot-email-label"
                className="block text-sm font-medium text-purple-200 mb-1"
              >
                Email address
              </label>
              <input
                id="forgot-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="you@school.example"
                required
                autoComplete="email"
                aria-describedby="forgot-help"
              />
              <p id="forgot-help" className="text-xs text-purple-300/70 mt-1">
                This will only work for an existing Elekeza account.
              </p>
            </div>

            {error && (
              <p role="alert" className="text-red-400 text-sm">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 rounded-lg shadow-md hover:opacity-90 transition disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-purple-300">
          Remember your password?{' '}
          <a href="/login" className="text-purple-300 underline">Sign in</a>
        </p>
      </div>
      <p className="mt-8 text-purple-200/50 text-xs text-center">© {new Date().getFullYear()} Elekeza. All rights reserved.</p>
    </main>
  );
}
