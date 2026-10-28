'use client';

/**
 * School finance — admin dashboard.
 *
 * Shows billing/collection/outstanding (all figures computed server-side),
 * fee setup (periods, items, structures), learner charges, manual payment
 * recording and receipts. M-Pesa initiation shows the honest mock/live mode.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, Field, LoadingState, PageHeader, Select, TextInput } from '@/components/ui';
import { getErrorStatus } from '@/lib/api';
import { formatKes } from '@/lib/format';
import { cn } from '@/lib/cn';
import { financeApi, financeKeys, type PaymentInfo, type ReceiptInfo } from '../api';
import { ChargeStatusBadge } from '../components/ChargeStatusBadge';
import { ReceiptDialog } from '../components/ReceiptDialog';

type Tab = 'overview' | 'setup' | 'charges' | 'payments';
type Notice = { tone: 'success' | 'error'; text: string } | null;

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'setup', label: 'Fee setup' },
  { key: 'charges', label: 'Invoices' },
  { key: 'payments', label: 'Payments' },
];

async function loadOverview() {
  const [summary, charges, periods, items, structures, mode] = await Promise.all([
    financeApi.summary(),
    financeApi.charges(),
    financeApi.periods(),
    financeApi.feeItems(),
    financeApi.structures(),
    financeApi.mpesaMode(),
  ]);
  return { summary, charges, periods, items, structures, mpesaMock: mode.mock };
}

export default function FinanceScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: financeKeys.overview, queryFn: loadOverview });
  const [tab, setTab] = useState<Tab>('overview');
  const [notice, setNotice] = useState<Notice>(null);
  const [receipt, setReceipt] = useState<ReceiptInfo | null>(null);

  // Manual payment form
  const [payLearner, setPayLearner] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'BANK'>('CASH');
  const [payNote, setPayNote] = useState('');

  // Learners who can be paid for: everyone with an invoice.
  const learners = useMemo(() => {
    const seen = new Map<number, string>();
    data?.charges.forEach((c) => seen.set(c.learnerId, c.learnerName));
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [data?.charges]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: financeKeys.all });

  const recordPayment = useMutation({
    mutationFn: financeApi.manualPayment,
    onSuccess: async (payment) => {
      setNotice({ tone: 'success', text: `Payment ${payment.paymentNumber} recorded. Balance updated automatically.` });
      setPayAmount('');
      setPayNote('');
      await refresh();
    },
    onError: (err) =>
      setNotice({
        tone: 'error',
        text:
          getErrorStatus(err) === 403
            ? 'Not authorized.'
            : 'Could not record the payment. Check the details and try again.',
      }),
  });

  const billLearners = useMutation({
    mutationFn: financeApi.applyStructure,
    onSuccess: async (res) => {
      setNotice({ tone: 'success', text: `Charges created: ${res.created}. Already billed: ${res.skippedExisting}.` });
      await refresh();
    },
    onError: () => setNotice({ tone: 'error', text: 'Could not apply the fee structure.' }),
  });

  const submitPayment = () => {
    const learnerId = Number(payLearner);
    const amount = Number(payAmount);
    if (!learnerId || !amount || amount <= 0) {
      setNotice({ tone: 'error', text: 'Choose a learner and a positive amount.' });
      return;
    }
    setNotice(null);
    recordPayment.mutate({ learnerId, amount, method: payMethod, note: payNote || undefined });
  };

  const showReceipt = async (payment: PaymentInfo) => {
    try {
      setReceipt(await financeApi.receipt(payment.id));
    } catch {
      setNotice({ tone: 'error', text: 'Could not open the receipt.' });
    }
  };

  const summary = data?.summary;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Finance"
        description={`School fees and payments${summary?.periodName ? ` — ${summary.periodName}` : ''}.`}
      />
      {data && (
        <p className="-mt-4 mb-6 text-xs">
          <Badge tone={data.mpesaMock ? 'warning' : 'success'}>
            M-Pesa: {data.mpesaMock ? 'test/mock mode' : 'live mode'}
          </Badge>
        </p>
      )}

      {isError && (
        <Alert tone="error" className="mb-4">
          Could not load finance data. Are you a school administrator?
        </Alert>
      )}
      {notice && (
        <Alert tone={notice.tone} className="mb-4">
          {notice.text}
        </Alert>
      )}

      <div role="tablist" aria-label="Finance sections" className="mb-6 flex flex-wrap gap-2">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`finance-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`finance-panel-${key}`}
            onClick={() => setTab(key)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              tab === key
                ? 'bg-accent text-accent-contrast'
                : 'border border-line bg-surface text-fg hover:bg-surface-hover',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState label="Loading finance data…" />
      ) : (
        data && (
          <div role="tabpanel" id={`finance-panel-${tab}`} aria-labelledby={`finance-tab-${tab}`}>
            {tab === 'overview' && summary && (
              <section aria-label="Finance overview" className="space-y-6">
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(
                    [
                      ['Total billed', summary.totalBilled],
                      ['Total collected', summary.totalCollected],
                      ['Outstanding', summary.outstanding],
                    ] as const
                  ).map(([label, value]) => (
                    <Card key={label}>
                      <dt className="text-sm text-fg-muted">{label}</dt>
                      <dd className="mt-1 text-2xl font-bold text-fg">{formatKes(value)}</dd>
                    </Card>
                  ))}
                </dl>
                <p className="text-sm text-fg-muted">
                  {summary.chargeCount} invoices · {summary.paymentCount} payments recorded.
                </p>
              </section>
            )}

            {tab === 'setup' && (
              <section aria-label="Fee setup" className="space-y-6">
                <Card title="Academic periods">
                  {data.periods.length === 0 ? (
                    <p className="text-sm text-fg-subtle">No periods yet.</p>
                  ) : (
                    <ul className="text-sm text-fg">
                      {data.periods.map((p) => (
                        <li key={p.id} className="border-b border-line py-1.5 last:border-0">
                          {p.name}{' '}
                          {p.isCurrent && (
                            <Badge tone="success" className="ml-2">
                              current
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card title="Fee items">
                  {data.items.length === 0 ? (
                    <p className="text-sm text-fg-subtle">No fee items yet.</p>
                  ) : (
                    <ul className="text-sm text-fg">
                      {data.items.map((it) => (
                        <li key={it.id} className="flex justify-between border-b border-line py-1.5 last:border-0">
                          <span>
                            {it.name}
                            {!it.active && ' (inactive)'}
                          </span>
                          <span className="font-medium">{formatKes(it.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card title="Fee structures">
                  {data.structures.length === 0 ? (
                    <p className="text-sm text-fg-subtle">No structures yet.</p>
                  ) : (
                    <ul className="text-sm text-fg">
                      {data.structures.map((s) => (
                        <li
                          key={s.id}
                          className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-1.5 last:border-0"
                        >
                          <span>
                            {s.feeItemName} — {formatKes(s.amount)} {s.classId ? '(class)' : '(whole school)'}
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => billLearners.mutate(s.id)}
                            loading={billLearners.isPending && billLearners.variables === s.id}
                          >
                            Bill learners
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </section>
            )}

            {tab === 'charges' && (
              <section aria-label="Invoices">
                {data.charges.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-line-strong p-8 text-center text-fg-muted">
                    No invoices yet — create a fee structure, then press “Bill learners”.
                  </div>
                ) : (
                  <Card padding="none" className="overflow-x-auto">
                    <table className="w-full text-sm text-fg">
                      <caption className="sr-only">Learner invoices</caption>
                      <thead>
                        <tr className="border-b border-line text-left text-fg-muted">
                          {['Invoice', 'Learner', 'Item', 'Amount', 'Paid', 'Balance', 'Status'].map((h) => (
                            <th key={h} scope="col" className="px-3 py-2 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.charges.map((c) => (
                          <tr key={c.id} className="border-b border-line last:border-0">
                            <td className="px-3 py-2 font-mono text-xs">{c.chargeNumber}</td>
                            <td className="px-3 py-2">{c.learnerName}</td>
                            <td className="px-3 py-2">{c.feeItemName}</td>
                            <td className="px-3 py-2">{formatKes(c.amount)}</td>
                            <td className="px-3 py-2">{formatKes(c.paidAmount)}</td>
                            <td className="px-3 py-2 font-medium">{formatKes(c.balance)}</td>
                            <td className="px-3 py-2">
                              <ChargeStatusBadge status={c.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}
              </section>
            )}

            {tab === 'payments' && (
              <section aria-label="Payments" className="space-y-6">
                <Card title="Record a manual payment">
                  <form
                    className="grid grid-cols-1 gap-3 sm:grid-cols-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitPayment();
                    }}
                  >
                    <Field id="pay-learner" label="Learner" className="sm:col-span-2">
                      <Select id="pay-learner" value={payLearner} onChange={(e) => setPayLearner(e.target.value)}>
                        <option value="">Choose…</option>
                        {learners.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field id="pay-amount" label="Amount (KES)">
                      <TextInput
                        id="pay-amount"
                        type="number"
                        min="1"
                        step="0.01"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                      />
                    </Field>
                    <Field id="pay-method" label="Method">
                      <Select
                        id="pay-method"
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value as 'CASH' | 'BANK')}
                      >
                        <option value="CASH">Cash</option>
                        <option value="BANK">Bank transfer</option>
                      </Select>
                    </Field>
                    <Field id="pay-note" label="Note (optional)" className="sm:col-span-3">
                      <TextInput
                        id="pay-note"
                        value={payNote}
                        onChange={(e) => setPayNote(e.target.value)}
                        placeholder="e.g. Term 1 tuition at office"
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button type="submit" variant="success" className="w-full" loading={recordPayment.isPending}>
                        {recordPayment.isPending ? 'Saving…' : 'Record payment'}
                      </Button>
                    </div>
                  </form>
                  <p className="mt-2 text-xs text-fg-subtle">
                    Balances and invoice statuses are recalculated on the server — allocations are applied automatically
                    to the oldest dues first.
                  </p>
                </Card>

                {!summary || summary.recentPayments.length === 0 ? (
                  <p className="text-sm text-fg-subtle">No payments recorded yet.</p>
                ) : (
                  <Card padding="none" className="overflow-x-auto">
                    <table className="w-full text-sm text-fg">
                      <caption className="sr-only">Recent payments</caption>
                      <thead>
                        <tr className="border-b border-line text-left text-fg-muted">
                          {['Receipt', 'Learner', 'Amount', 'Method', 'Reference', 'Actions'].map((h) => (
                            <th key={h} scope="col" className="px-3 py-2 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {summary.recentPayments.map((p) => (
                          <tr key={p.id} className="border-b border-line last:border-0">
                            <td className="px-3 py-2 font-mono text-xs">{p.paymentNumber}</td>
                            <td className="px-3 py-2">{p.learnerName}</td>
                            <td className="px-3 py-2 font-medium">{formatKes(p.amount)}</td>
                            <td className="px-3 py-2">{p.method}</td>
                            <td className="px-3 py-2 font-mono text-xs">{p.providerRef ?? p.note ?? '—'}</td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => showReceipt(p)}
                                className="text-xs text-accent-strong underline underline-offset-2"
                              >
                                Receipt
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}
              </section>
            )}
          </div>
        )
      )}

      {receipt && <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
