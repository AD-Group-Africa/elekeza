'use client';

/**
 * School finance — admin dashboard.
 *
 * Shows billing/collection/outstanding (all figures computed server-side),
 * fee setup (periods, items, structures), learner charges, manual payment
 * recording and receipts. M-Pesa initiation shows the honest mock/live mode.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  financeAPI,
  type FinanceSummary,
  type ChargeInfo,
  type PeriodInfo,
  type FeeItemInfo,
  type FeeStructureInfo,
  type ReceiptInfo,
  type PaymentInfo,
} from '@/lib/api';
import api from '@/lib/axios';

interface LearnerRow { id: number; name: string }

const STATUS_TONE: Record<string, string> = {
  PAID: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-800 border-amber-300',
  PENDING: 'border-gray-300 bg-gray-50 text-gray-700',
  VOID: 'bg-rose-100 text-rose-800 border-rose-300',
};

const fmt = (n: number) => `KES ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

export default function FinancePage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [charges, setCharges] = useState<ChargeInfo[]>([]);
  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [items, setItems] = useState<FeeItemInfo[]>([]);
  const [structures, setStructures] = useState<FeeStructureInfo[]>([]);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [mpesaMock, setMpesaMock] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'overview' | 'setup' | 'charges' | 'payments'>('overview');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  // Manual payment form
  const [payLearner, setPayLearner] = useState<string>('');
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'BANK'>('CASH');
  const [payNote, setPayNote] = useState('');
  const [paying, setPaying] = useState(false);

  // Receipt modal
  const [receipt, setReceipt] = useState<ReceiptInfo | null>(null);

  const reload = useCallback(async () => {
    try {
      const [s, c, p, it, st, mode] = await Promise.all([
        financeAPI.summary(),
        financeAPI.charges(),
        financeAPI.periods(),
        financeAPI.feeItems(),
        financeAPI.structures(),
        financeAPI.mpesaMode(),
      ]);
      setSummary(s.data);
      setCharges(c.data);
      setPeriods(p.data);
      setItems(it.data);
      setStructures(st.data);
      setMpesaMock(mode.data.mock);
    } catch {
      setNotice({ tone: 'error', text: 'Could not load finance data. Are you a school administrator?' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Learner options for the payment form: derive from charges (no admin roster endpoint here).
  useEffect(() => {
    const seen = new Map<number, string>();
    charges.forEach((c) => seen.set(c.learnerId, c.learnerName));
    setLearners([...seen.entries()].map(([id, name]) => ({ id, name })));
  }, [charges]);

  const submitPayment = async () => {
    const learnerId = Number(payLearner);
    const amount = Number(payAmount);
    if (!learnerId || !amount || amount <= 0) {
      setNotice({ tone: 'error', text: 'Choose a learner and a positive amount.' });
      return;
    }
    setPaying(true);
    setNotice(null);
    try {
      const res = await financeAPI.manualPayment({ learnerId, amount, method: payMethod, note: payNote || undefined });
      setNotice({ tone: 'ok', text: `Payment ${res.data.paymentNumber} recorded. Balance updated automatically.` });
      setPayAmount(''); setPayNote('');
      await reload();
      setTab('payments');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setNotice({ tone: 'error', text: status === 403 ? 'Not authorized.' : 'Could not record the payment. Check the details and try again.' });
    } finally {
      setPaying(false);
    }
  };

  const applyStructure = async (id: number) => {
    try {
      const res = await financeAPI.applyStructure(id);
      setNotice({ tone: 'ok', text: `Charges created: ${res.data.created}. Already billed: ${res.data.skippedExisting}.` });
      await reload();
    } catch {
      setNotice({ tone: 'error', text: 'Could not apply the fee structure.' });
    }
  };

  const showReceipt = async (payment: PaymentInfo) => {
    try {
      const res = await financeAPI.receipt(payment.id);
      setReceipt(res.data);
    } catch {
      setNotice({ tone: 'error', text: 'Could not open the receipt.' });
    }
  };

  const tabBtn = (key: typeof tab, label: string) => (
    <button
      key={key}
      type="button"
      role="tab"
      aria-selected={tab === key}
      onClick={() => setTab(key)}
      className={`rounded-lg px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
        tab === key ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Finance</h1>
      <p className="text-gray-600 mb-2">School fees and payments{summary?.periodName ? ` — ${summary.periodName}` : ''}.</p>
      {mpesaMock != null && (
        <p className="mb-6 text-xs">
          <span className={`rounded-full border px-2 py-0.5 font-medium ${mpesaMock ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`}>
            M-Pesa: {mpesaMock ? 'test/mock mode' : 'live mode'}
          </span>
        </p>
      )}

      {notice && (
        <div role="status" className={`mb-4 rounded-lg border px-4 py-3 text-sm ${notice.tone === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-rose-300 bg-rose-50 text-rose-800'}`}>
          {notice.text}
        </div>
      )}

      <div role="tablist" aria-label="Finance sections" className="mb-6 flex flex-wrap gap-2">
        {tabBtn('overview', 'Overview')}
        {tabBtn('setup', 'Fee setup')}
        {tabBtn('charges', 'Invoices')}
        {tabBtn('payments', 'Payments')}
      </div>

      {loading ? (
        <p className="py-10 text-center text-gray-500" role="status">Loading finance data…</p>
      ) : (
        <>
          {tab === 'overview' && summary && (
            <section aria-label="Finance overview" className="space-y-6">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  ['Total billed', summary.totalBilled],
                  ['Total collected', summary.totalCollected],
                  ['Outstanding', summary.outstanding],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-xl border border-gray-200 bg-white p-4">
                    <dt className="text-sm text-gray-500">{label as string}</dt>
                    <dd className="mt-1 text-2xl font-bold">{fmt(value as number)}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-gray-600">
                {summary.chargeCount} invoices · {summary.paymentCount} payments recorded.
              </p>
            </section>
          )}

          {tab === 'setup' && (
            <section aria-label="Fee setup" className="space-y-6">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h2 className="mb-2 font-semibold">Academic periods</h2>
                {periods.length === 0 ? <p className="text-sm text-gray-500">No periods yet.</p> : (
                  <ul className="text-sm">
                    {periods.map((p) => (
                      <li key={p.id} className="border-b py-1.5 last:border-0">
                        {p.name} {p.isCurrent && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">current</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h2 className="mb-2 font-semibold">Fee items</h2>
                {items.length === 0 ? <p className="text-sm text-gray-500">No fee items yet.</p> : (
                  <ul className="text-sm">
                    {items.map((it) => (
                      <li key={it.id} className="flex justify-between border-b py-1.5 last:border-0">
                        <span>{it.name}{!it.active && ' (inactive)'}</span>
                        <span className="font-medium">{fmt(it.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h2 className="mb-2 font-semibold">Fee structures</h2>
                {structures.length === 0 ? <p className="text-sm text-gray-500">No structures yet.</p> : (
                  <ul className="text-sm">
                    {structures.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-1.5 last:border-0">
                        <span>{s.feeItemName} — {fmt(s.amount)} {s.classId ? '(class)' : '(whole school)'}</span>
                        <button
                          type="button"
                          onClick={() => applyStructure(s.id)}
                          className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                        >
                          Bill learners
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {tab === 'charges' && (
            <section aria-label="Invoices">
              {charges.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
                  No invoices yet — create a fee structure, then press “Bill learners”.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Learner invoices</caption>
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th scope="col" className="px-3 py-2 font-medium">Invoice</th>
                        <th scope="col" className="px-3 py-2 font-medium">Learner</th>
                        <th scope="col" className="px-3 py-2 font-medium">Item</th>
                        <th scope="col" className="px-3 py-2 font-medium">Amount</th>
                        <th scope="col" className="px-3 py-2 font-medium">Paid</th>
                        <th scope="col" className="px-3 py-2 font-medium">Balance</th>
                        <th scope="col" className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {charges.map((c) => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="px-3 py-2 font-mono text-xs">{c.chargeNumber}</td>
                          <td className="px-3 py-2">{c.learnerName}</td>
                          <td className="px-3 py-2">{c.feeItemName}</td>
                          <td className="px-3 py-2">{fmt(c.amount)}</td>
                          <td className="px-3 py-2">{fmt(c.paidAmount)}</td>
                          <td className="px-3 py-2 font-medium">{fmt(c.balance)}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[c.status] ?? 'border-gray-300'}`}>{c.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {tab === 'payments' && (
            <section aria-label="Payments" className="space-y-6">
              <form
                className="rounded-xl border border-gray-200 bg-white p-4"
                onSubmit={(e) => { e.preventDefault(); submitPayment(); }}
              >
                <h2 className="mb-3 font-semibold">Record a manual payment</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <label className="text-sm font-medium sm:col-span-2">
                    Learner
                    <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={payLearner} onChange={(e) => setPayLearner(e.target.value)}>
                      <option value="">Choose…</option>
                      {learners.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Amount (KES)
                    <input type="number" min="1" step="0.01" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                  </label>
                  <label className="text-sm font-medium">
                    Method
                    <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={payMethod} onChange={(e) => setPayMethod(e.target.value as 'CASH' | 'BANK')}>
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bank transfer</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium sm:col-span-3">
                    Note (optional)
                    <input type="text" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="e.g. Term 1 tuition at office" />
                  </label>
                  <div className="flex items-end">
                    <button type="submit" disabled={paying} className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                      {paying ? 'Saving…' : 'Record payment'}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">Balances and invoice statuses are recalculated on the server — allocations are applied automatically to the oldest dues first.</p>
              </form>

              {summary && summary.recentPayments.length === 0 ? (
                <p className="text-sm text-gray-500">No payments recorded yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Recent payments</caption>
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th scope="col" className="px-3 py-2 font-medium">Receipt</th>
                        <th scope="col" className="px-3 py-2 font-medium">Learner</th>
                        <th scope="col" className="px-3 py-2 font-medium">Amount</th>
                        <th scope="col" className="px-3 py-2 font-medium">Method</th>
                        <th scope="col" className="px-3 py-2 font-medium">Reference</th>
                        <th scope="col" className="px-3 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary?.recentPayments.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="px-3 py-2 font-mono text-xs">{p.paymentNumber}</td>
                          <td className="px-3 py-2">{p.learnerName}</td>
                          <td className="px-3 py-2 font-medium">{fmt(p.amount)}</td>
                          <td className="px-3 py-2">{p.method}</td>
                          <td className="px-3 py-2 font-mono text-xs">{p.providerRef ?? p.note ?? '—'}</td>
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => showReceipt(p)} className="text-xs text-emerald-700 underline underline-offset-2">Receipt</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setReceipt(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Receipt ${receipt.receiptNumber}`}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
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
              {receipt.recordedByName && <div className="flex justify-between"><dt className="text-gray-500">Recorded by</dt><dd>{receipt.recordedByName}</dd></div>}
              <div className="flex justify-between"><dt className="text-gray-500">Date</dt><dd>{new Date(receipt.paidAt).toLocaleString()}</dd></div>
            </dl>
            <table className="w-full text-sm">
              <caption className="sr-only">Applied to invoices</caption>
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th scope="col" className="py-1 font-medium">Invoice</th>
                  <th scope="col" className="py-1 font-medium">Item</th>
                  <th scope="col" className="py-1 text-right font-medium">Applied</th>
                </tr>
              </thead>
              <tbody>
                {receipt.lines.map((l, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1 font-mono text-xs">{l.chargeNumber}</td>
                    <td className="py-1">{l.feeItemName}</td>
                    <td className="py-1 text-right">{fmt(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={() => window.print()} className="mt-5 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
              Print receipt
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
