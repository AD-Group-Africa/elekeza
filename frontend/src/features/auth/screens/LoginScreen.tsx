'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Alert, Button, Field, TextInput } from '@/components/ui';
import { getErrorMessage, getErrorStatus, isNetworkError } from '@/lib/api';
import { useAuth } from '../AuthProvider';
import { AuthCard } from '../components/AuthCard';
import { PasswordInput } from '../components/PasswordInput';

function loginErrorMessage(err: unknown): string {
  if (isNetworkError(err)) return 'Could not reach Elekeza. Check your connection and try again.';
  const status = getErrorStatus(err);
  if (status === 401 || status === 400) return 'Invalid email or password.';
  return getErrorMessage(err, 'Sign-in failed. Please try again.');
}

function LoginForm() {
  const params = useSearchParams();
  const welcome = params.get('welcome') === '1';
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password); // navigates to the role's home
    } catch (err) {
      setError(loginErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Welcome Back" withLogo>
      {welcome && (
        <Alert tone="success" className="mb-4">
          Your school is registered. Sign in with the admin account you just created.
        </Alert>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field id="login-email" label="Email">
          <TextInput
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            autoComplete="email"
            required
          />
        </Field>
        <Field id="login-password" label="Password">
          <PasswordInput
            id="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
        </Field>
        <div className="text-right">
          <Link href="/forgot-password" className="text-sm text-purple-300 hover:text-purple-200">
            Forgot password?
          </Link>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          Login
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-purple-200/70">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-purple-300 hover:underline">
          Register
        </Link>
      </p>
    </AuthCard>
  );
}

export default function LoginScreen() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <LoginForm />
    </Suspense>
  );
}
