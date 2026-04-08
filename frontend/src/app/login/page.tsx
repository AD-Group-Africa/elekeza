'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import PageShell from '@/components/ui/PageShell'
import StatusBanner from '@/components/ui/StatusBanner'
import { getHomePathForRole } from '@/lib/roleAuth'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const canLogin = Boolean(email.trim() && password.trim() && !loading)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const loggedInUser = await login(email, password)
      router.push(getHomePathForRole(loggedInUser.role))
    } catch {
      setError('Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell withSidebar={false}>
      <form
        onSubmit={handleLogin}
        className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-10 shadow-xl"
      >
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Welcome Back</h1>
          <p className="mt-2 text-sm text-slate-600">Continue your focused learning.</p>
        </div>

        {error && (
          <div className="mb-4">
            <StatusBanner tone="error">{error}</StatusBanner>
          </div>
        )}

        <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 p-3 text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          required
        />

        <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
        <div className="relative mb-6">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-3 pr-11 text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
        </div>

        <button
          type="submit"
          disabled={!canLogin}
          className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Login'}
        </button>

        <p className="mt-6 text-center text-sm text-slate-600">
          Don&apos;t have an account?{' '}
          <a
            href="/register"
            className="font-semibold text-slate-900 hover:underline"
          >
            Register
          </a>
        </p>
      </form>
    </PageShell>
  )
}
