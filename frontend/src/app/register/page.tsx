'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Eye, EyeOff } from 'lucide-react';

const ROLES = [
  { value: 'STUDENT', label: 'Learner' },
  { value: 'TEACHER', label: 'Teacher' },
  { value: 'GUARDIAN', label: 'Parent / Guardian' },
  { value: 'SCHOOL_ADMIN', label: 'School Administrator' },
];

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('MALE');
  const [role, setRole] = useState('STUDENT');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setError('You must accept the Terms of Service and Privacy Policy.');
      return;
    }
    try {
      await register(email, password, fullName, phone, role, termsAccepted, gender);
      router.push('/onboarding/profile');
    } catch (err) {
      setError((err as Error)?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-purple-200 text-center mb-2">Elekeza</h1>
        <h2 className="text-xl font-semibold text-purple-200 text-center mb-6">Create Account</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <label htmlFor="reg-fullName" className="block text-sm font-medium text-purple-200 mb-1">Full Name</label>
          <input id="reg-fullName" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500" required />
          <label htmlFor="reg-email" className="block text-sm font-medium text-purple-200 mb-1">Email</label>
          <input id="reg-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500" required />
          <label htmlFor="reg-phone" className="block text-sm font-medium text-purple-200 mb-1">Phone (optional)</label>
          <input id="reg-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XX XXX XXX" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500" />
          
          <label htmlFor="reg-gender" className="block text-sm font-medium text-purple-200 mb-1">Gender</label>
          <select id="reg-gender" value={gender} onChange={e => setGender(e.target.value)} className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option value="MALE" className="bg-gray-800">Male</option>
            <option value="FEMALE" className="bg-gray-800">Female</option>
          </select>

          <label htmlFor="reg-role" className="block text-sm font-medium text-purple-200 mb-1">I am a</label>
          <select id="reg-role" value={role} onChange={e => setRole(e.target.value)} className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
            {ROLES.map(r => <option key={r.value} value={r.value} className="bg-gray-800">{r.label}</option>)}
          </select>

          <div className="relative">
            <label htmlFor="reg-password" className="block text-sm font-medium text-purple-200 mb-1">Password (min 8 chars)</label>
            <input id="reg-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-200/50 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500" required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-purple-300 hover:text-white" aria-label="Toggle password">
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="flex items-start space-x-2">
            <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-1 h-4 w-4 rounded border-purple-400 bg-white/10 text-purple-600 focus:ring-purple-500" id="terms" />
            <label htmlFor="terms" className="text-sm text-purple-200/80">I accept the <a href="/terms" className="text-purple-300 underline">Terms</a> and <a href="/privacy" className="text-purple-300 underline">Privacy Policy</a>.</label>
          </div>

          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
          <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 rounded-lg shadow-md hover:opacity-90 transition">Register</button>
        </form>

        <p className="mt-6 text-center text-sm text-purple-200/70">Already have an account? <a href="/login" className="text-purple-300 hover:underline">Login</a></p>
      </div>
      <p className="mt-8 text-purple-200/50 text-xs">&copy; {new Date().getFullYear()} Elekeza. All rights reserved.</p>
    </main>
  );
}
