'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Eye, EyeOff } from 'lucide-react';

const INPUT =
  'w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500';

function serverMessage(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message
    ?? (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
}

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('MALE');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
      setError(serverMessage(err) || 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-purple-200 text-center mb-2">Elekeza</h1>
        <h2 className="text-xl font-semibold text-purple-200 text-center mb-2">Create a learner account</h2>
        <p className="text-sm text-purple-300 text-center mb-6">
          Teachers, parents and school staff receive their accounts from their school.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reg-fullName" className="block text-sm font-medium text-purple-200 mb-1">Full name</label>
            <input id="reg-fullName" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" autoComplete="name" className={INPUT} required />
          </div>
          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium text-purple-200 mb-1">Email</label>
            <input id="reg-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" autoComplete="email" className={INPUT} required />
          </div>
          <div>
            <label htmlFor="reg-phone" className="block text-sm font-medium text-purple-200 mb-1">Phone (optional)</label>
            <input id="reg-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XX XXX XXX" autoComplete="tel" className={INPUT} />
          </div>
          <div>
            <label htmlFor="reg-gender" className="block text-sm font-medium text-purple-200 mb-1">Gender</label>
            <select id="reg-gender" value={gender} onChange={e => setGender(e.target.value)} className={INPUT}>
              <option value="MALE" className="bg-gray-800">Male</option>
              <option value="FEMALE" className="bg-gray-800">Female</option>
            </select>
          </div>
          <div>
            <label htmlFor="reg-password" className="block text-sm font-medium text-purple-200 mb-1">Password (min 8 characters)</label>
            <div className="relative">
              <input id="reg-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" autoComplete="new-password" minLength={8} className={`${INPUT} pr-12`} required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-purple-300 hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-1 h-4 w-4 rounded border-purple-400 bg-white/10 text-purple-600 focus:ring-purple-500" id="terms" />
            <label htmlFor="terms" className="text-sm text-purple-200/80">I accept the Terms of Service and Privacy Policy.</label>
          </div>

          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={busy} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 rounded-lg shadow-md hover:opacity-90 transition disabled:opacity-60">
            {busy ? 'Creating account…' : 'Register'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-purple-200/70">
          Already have an account? <Link href="/login" className="text-purple-300 hover:underline">Login</Link>
        </p>
        <p className="mt-2 text-center text-sm text-purple-200/70">
          Registering a school? <Link href="/school/onboarding" className="text-purple-300 hover:underline">Start here</Link>
        </p>
      </div>
      <p className="mt-8 text-purple-200/50 text-xs">&copy; {new Date().getFullYear()} Elekeza. All rights reserved.</p>
    </main>
  );
}
