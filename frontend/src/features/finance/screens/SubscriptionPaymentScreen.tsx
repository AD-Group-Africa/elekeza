'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Alert, Button, Card, Field, PageHeader, TextInput } from '@/components/ui';
import { toMsisdn } from '@/lib/phone';
import { financeApi } from '../api';

/** School subscription payment via M-Pesa STK push. */
export default function SubscriptionPaymentScreen() {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const pay = useMutation({
    mutationFn: ({ msisdn, kes }: { msisdn: string; kes: number }) => financeApi.subscriptionStkPush(msisdn, kes),
    onSuccess: () => setMessage({ tone: 'success', text: 'STK push sent. Check your phone to complete payment.' }),
    onError: () => setMessage({ tone: 'error', text: 'Payment failed. Please try again.' }),
  });

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    const msisdn = toMsisdn(phone);
    const kes = Number(amount);
    if (!msisdn) {
      setMessage({ tone: 'error', text: 'Enter a Safaricom number like 0712 345 678.' });
      return;
    }
    if (!Number.isInteger(kes) || kes < 1) {
      setMessage({ tone: 'error', text: 'Enter an amount in whole shillings.' });
      return;
    }
    setMessage(null);
    pay.mutate({ msisdn, kes });
  };

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="School Subscription" />
      <Card padding="lg">
        <form onSubmit={handlePay} className="space-y-4">
          <Field id="pay-phone" label="Phone number (07XX XXX XXX)">
            <TextInput
              id="pay-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712 345 678"
              autoComplete="tel"
            />
          </Field>
          <Field id="pay-amount" label="Amount (KES)">
            <TextInput
              id="pay-amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={pay.isPending}>
            {pay.isPending ? 'Processing…' : 'Pay with M‑Pesa'}
          </Button>
          {message && <Alert tone={message.tone}>{message.text}</Alert>}
        </form>
      </Card>
    </div>
  );
}
