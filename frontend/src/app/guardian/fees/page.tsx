'use client';

/**
 * Guardian fees — ward charges, balances, payment history and receipts.
 * M-Pesa initiation is available; when the deployment runs in mock mode the
 * status is shown honestly instead of pretending a live STK push happened.
 */

import { useCallback, useEffect, useState } from 'react';
import { financeAPI, type ChargeInfo, type PaymentInfo, type PeriodInfo, type ReceiptInfo } from '@/lib/api';

const STATUS_TONE: Record<string, string> = {
  PAID: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-800 border-amber-300',
  PENDING: 'border-gray-300 bg-gray-50 text-gray-700',
  COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

const fmt = (n: number) => `KES ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

export default function GuardianFeesPage() {
  const [charges, setCharges] = useState<ChargeInfo[]>([]);
  const [payments, setPayments] = useState<PaymentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [receipt, setReceipt] = useState<ReceiptInfo | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([financeAPI.charges(), financeAPI.payments()]);
      setCharges(c.data);
      setPayments(p.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setNotice({ tone: 'error', text: status === 403 ? 'Not authorized.' : 'Could not load fees. Please try again later.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const payWithMpesa = async (charge: ChargeInfo) => {
    setPayingId(charge.id);
    setNotice(null);
    try {
      const res = await financeAPI.initiateMpesa({ learnerId: charge.learnerId, amount: charge.balance });
      setNotice({
        tone: 'ok',
        text: res.data.mock
          ? `Test mode: payment request ${res.data.checkoutRequestId} created locally. In live mode, ${res.data.message.toLowerCase()}`
          : `${res.data.message} (request ${res.data.checkoutRequestId})`,
      });
      await load();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setNotice({
        tone: 'error',
        text: status === 503 ? 'M-Pesa is not configured for this deployment yet.' : 'Could not start the M-Pesa payment. Please try again.',
      });
    } finally {
      setPayingId(null);
    }
  };

  const openReceipt = async (p: PaymentInfo) => {
    try {
      const res = await financeAPI.receipt(p.id);
      setReceipt(res.data);
    } catch {
      setNotice({ tone: 'error', text: 'Could not open the receipt.' });
    }
  };

  const totalDue = charges.reduce((s, c) => s + c.balance, 0);
  const byWard = charges.reduce<Record<string, ChargeInfo[]>>((acc, c) => {
    (acc[c.learnerName] ??= []).push(c);
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Fees</h1>
      <p className="mb-6 text-gray-600">
        School fees for your children{totalDue > 0 ? ` — total balance ${fmt(totalDue)}` : ''}.
      </p>

      {notice && (
        <div role="status" className={`mb-4 rounded-lg border px-4 py-3 text-sm ${notice.tone === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-rose-300 bg-rose-50 text-rose-800'}`}>
          {notice.text}
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-gray-500" role="status">Loading fees…</p>
      ) : (
        <div className="space-y-8">
          {Object.keys(byWard).length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
              No fee invoices yet. Once the school bills fees, they will appear here.
            </div>
          ) : (
            Object.entries(byWard).map(([ward, wardCharges]) => {
              const balance = wardCharges.reduce((s, c) => s + c.balance, 0);
              return (
                <section key={ward} aria-label={`Fees for ${ward}`} className="rounded-xl border border-gray-200 bg-white">
                  <header className="flex items-center justify-between border-b px-4 py-3">
                    <h2 className="font-semibold">{ward}</h2>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${balance <= 0 ? STATUS_TONE.PAID : STATUS_TONE.PARTIALLY_PAID}`}>
                      Balance {fmt(balance)}
                    </span>
                  </header>
                  <ul>
                    {wardCharges.map((c) => (
                      <li key={c.id} className="flex flex-col gap-2 border-b px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium">{c.feeItemName} <span className="ml-1 text-xs text-gray-500">{c.periodName}</span></p>
                          <p className="text-xs text-gray-500">
                            {c.chargeNumber} · {fmt(c.amount)} · paid {fmt(c.paidAmount)}
                            {c.dueDate ? ` · due ${c.dueDate}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[c.status] ?? 'border-gray-300'}`}>{c.status}</span>
                          {c.balance > 0 && (
                            <button
                              type="button"
                              onClick={() => payWithMpesa(c)}
                              disabled={payingId === c.id}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                            >
                              {payingId === c.id ? 'Starting…' : `Pay ${fmt(c.balance)} via M-Pesa`}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}

          <section aria-label="Payment history">
            <h2 className="mb-2 font-semibold">Payment history</h2>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-500">No payments recorded yet.</p>
            ) : (
              <ul className="rounded-xl border border-gray-200 bg-white">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between border-b px-4 py-2.5 text-sm last:border-0">
                    <div>
                      <span className="font-medium">{p.learnerName}</span> — {fmt(p.amount)}
                      <span className="ml-2 text-xs text-gray-500">{p.method}{p.providerRef ? ` · ${p.providerRef}` : ''}</span>
                    </div>
                    <button type="button" onClick={() => openReceipt(p)} className="text-xs text-emerald-700 underline underline-offset-2">Receipt</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setReceipt(null)}>
          <div role="dialog" aria-modal="true" aria-label={`Receipt ${receipt.receiptNumber}`} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">Receipt {receipt.receiptNumber}</h2>
                <p className="text-sm text-gray-600">{receipt.institutionName}</p>
              </div>
              <button type="button" onClick={() => setReceipt(null)} aria-label="Close receipt" className="rounded p-1 text-gray-400 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">✕</button>
            </div>
            <dl className="mb-4 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Learner</dt><dd className="font-medium">{receipt.learnerName}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Amount</dt><dd className="font-bold">{fmt(receipt.amount)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Method</dt><dd>{receipt.method}</dd></div>
              {receipt.providerRef && <div className="flex justify-between"><dt className="text-gray-500">Reference</dt><dd className="font-mono text-xs">{receipt.providerRef}</dd></div>}
              <div className="flex justify-between"><dt className="text-gray-500">Date</dt><dd>{new Date(receipt.paidAt).toLocaleString()}</dd></div>
            </dl>
            <button type="button" onClick={() => window.print()} className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50">Print receipt</button>
          </div>
        </div>
      )}
    </main>
  );
}
