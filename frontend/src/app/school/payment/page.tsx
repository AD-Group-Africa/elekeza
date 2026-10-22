'use client';

import { useState } from 'react';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';

/** Normalises 07XX / 7XX / +2547XX / 2547XX into 2547XXXXXXXX, or null. */
function toMsisdn(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const local = digits.startsWith('254') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  return /^[17]\d{8}$/.test(local) ? '254' + local : null;
}

export default function PaymentPage() {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handlePay = async () => {
    const msisdn = toMsisdn(phone);
    const kes = Number(amount);
    if (!msisdn) {
      setStatus('Enter a Safaricom number like 0712 345 678.');
      return;
    }
    if (!Number.isInteger(kes) || kes < 1) {
      setStatus('Enter an amount in whole shillings.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/payments/stkpush', { phone: msisdn, amount: kes });
      setStatus('STK push sent. Check your phone to complete payment.');
    } catch {
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
            <label htmlFor="pay-phone" className="block text-sm text-purple-300 mb-1">Phone Number (07XX XXX XXX)</label>
            <input id="pay-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0712 345 678" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" />
          </div>
          <div>
            <label htmlFor="pay-amount" className="block text-sm text-purple-300 mb-1">Amount (KES)</label>
            <input id="pay-amount" type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)} placeholder="1000" className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white" />
          </div>
          <button onClick={handlePay} disabled={loading} className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50">
            {loading ? 'Processing…' : 'Pay with M‑Pesa'}
          </button>
          {status && <p className="text-purple-300 text-sm" role="status">{status}</p>}
        </div>
      </div>
    </SidebarLayout>
  );
}