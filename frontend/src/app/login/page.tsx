'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Eye, EyeOff } from 'lucide-react';

const INPUT =
  'w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500';

function loginErrorMessage(err: unknown): string {
  const res = (err as { response?: { status?: number; data?: { message?: string } } })?.response;
  if (!res) return 'Could not reach Elekeza. Check your connection and try again.';
  if (res.status === 401 || res.status === 400) return 'Invalid email or password.';
  return res.data?.message || 'Sign-in failed. Please try again.';
}

function LoginForm() {
  const params = useSearchParams();
  const welcome = params.get('welcome') === '1';
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md w-full">
        <Image
          src="/Elekeza Logo.png"
          alt="Elekeza"
          width={260}
          height={260}
          priority
          className="mx-auto h-auto w-auto max-w-[240px] object-contain"
        />
        <h1 className="sr-only">Elekeza</h1>
        <h2 className="text-xl font-semibold text-purple-200 text-center mb-6">Welcome Back</h2>

        {welcome && (
          <p role="status" className="mb-4 rounded-lg bg-green-600/20 px-4 py-3 text-sm text-green-200">
            Your school is registered. Sign in with the admin account you just created.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-purple-200 mb-1">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
              placeholder="Enter your email"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-purple-200 mb-1">Password</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${INPUT} pr-12`}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-purple-300 hover:text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-purple-300 hover:text-purple-200">Forgot password?</Link>
          </div>
          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 rounded-lg shadow-md hover:opacity-90 transition disabled:opacity-60"
          >
            Login
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-purple-200/70">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-purple-300 hover:underline">Register</Link>
        </p>
      </div>
      <p className="mt-8 text-purple-200/50 text-xs">&copy; {new Date().getFullYear()} Elekeza. All rights reserved.</p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <LoginForm />
    </Suspense>
  );
}
