'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await register(email, password, fullName)
      router.push('/onboarding/profile')
    } catch (err: any) {
      console.error('Registration error', err)
      const message = err?.response?.data?.message || 'Registration failed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo p-6">
      <form
        onSubmit={handleRegister}
        className="bg-white/90 backdrop-blur-lg p-10 rounded-2xl shadow-xl border border-white/50 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-elekeza-deep-blue mb-2">Elekeza</h1>
          <p className="text-elekeza-indigo text-sm">Where learning finds direction</p>
        </div>

        <h2 className="text-2xl font-bold mb-2 text-center text-gray-800">
          Create Account
        </h2>
        <p className="text-center text-gray-500 mb-8 text-sm">
          Start your learning journey
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="text-gray-900 placeholder:text-gray-600 w-full mb-4 p-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-elekeza-indigo transition"
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="text-gray-900 placeholder:text-gray-600 w-full mb-4 p-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-elekeza-indigo transition"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="text-gray-900 placeholder:text-gray-600 w-full mb-6 p-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-elekeza-indigo transition"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-elekeza-deep-blue hover:bg-elekeza-indigo text-white py-3 rounded-lg font-semibold transition duration-200 disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Register'}
        </button>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <a
            href="/login"
            className="text-elekeza-indigo font-semibold hover:underline"
          >
            Login
          </a>
        </p>
      </form>
    </div>
  )
}
