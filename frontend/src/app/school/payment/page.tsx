'use client';

import { useState } from 'react';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { DollarSign } from 'lucide-react';

export default function PaymentPage() {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handlePay = async () => {
    setLoading(true);
    try {
      const res = await api.post('/payments/stkpush', { phone: '254' + phone, amount: parseInt(amount) });
      setStatus('STK push sent. Check your phone to complete payment.');
    } catch (err) {
      setStatus('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="max-w-md mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-purple-200">School Subscription</h1>
        <div className="glass-card p-6 space-y-4">
          <div>
            <label className="block text-sm text-purple-300 mb-1">Phone Number (07XX XXX XXX)</label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="712345678" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" />
          </div>
          <div>
            <label className="block text-sm text-purple-300 mb-1">Amount (KES)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="1000" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" />
          </div>
          <button onClick={handlePay} disabled={loading} className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50">
            {loading ? 'Processing…' : 'Pay with M‑Pesa'}
          </button>
          {status && <p className="text-purple-300 text-sm">{status}</p>}
        </div>
      </div>
    </SidebarLayout>
  );
}