'use client';

import { useState } from 'react';
import api from '@/lib/axios';

export default function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/waitlist', { email, name, school });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md w-full">
        {submitted ? (
          <div className="text-center text-purple-200">
            <h2 className="text-2xl font-bold mb-2">Thank you!</h2>
            <p>We'll be in touch.</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-purple-200 mb-6">Join the Waitlist</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" required />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" required />
              <input type="text" value={school} onChange={e => setSchool(e.target.value)} placeholder="School Name" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" required />
              <button type="submit" className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold">Join</button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}