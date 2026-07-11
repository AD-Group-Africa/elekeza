'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await login(email, password);
      // Route based on role — each role gets its own dashboard
      switch (user.role) {
        case 'TEACHER':
        case 'SCHOOL_ADMIN':
          router.push('/teacher');
          break;
        case 'GUARDIAN':
          router.push('/guardian');
          break;
        case 'ADMIN':
          router.push('/admin');
          break;
        default:
          router.push('/student-home');
      }
    } catch {
      setError('Invalid email or password.');
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="card bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Image src="/Elekeza Logo.png" alt="Elekeza Logo" width={180} height={60} priority />
        </div>
        <h2 className="text-xl font-semibold text-gray-700 text-center mb-6">Welcome Back</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter your email" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 pr-12"
                placeholder="Enter your password" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full text-white font-semibold py-3 rounded-lg shadow-md transition"
            style={{ background: 'linear-gradient(90deg, #3B6DE5 0%, #8B45F5 100%)' }}>
            Login
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Don&apos;t have an account? <a href="/register" className="text-purple-600 hover:underline">Register</a>
        </p>
      </div>
      <p className="mt-8 text-gray-300 text-xs">&copy; {new Date().getFullYear()} Elekeza. All rights reserved.</p>
    </main>
  );
}

