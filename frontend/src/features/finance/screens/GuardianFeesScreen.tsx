'use client';

/**
 * Guardian fees — ward charges, balances, payment history and receipts.
 * M-Pesa initiation is available; when the deployment runs in mock mode the
 * status is shown honestly instead of pretending a live STK push happened.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, LoadingState, PageHeader } from '@/components/ui';
import { getErrorStatus } from '@/lib/api';
import { formatKes } from '@/lib/format';
import { financeApi, financeKeys, type ChargeInfo, type PaymentInfo, type ReceiptInfo } from '../api';
import { ChargeStatusBadge } from '../components/ChargeStatusBadge';
import { ReceiptDialog } from '../components/ReceiptDialog';

type Notice = { tone: 'success' | 'error'; text: string } | null;

async function loadFees() {
  const [charges, payments] = await Promise.all([financeApi.charges(), financeApi.payments()]);
  return { charges, payments };
}

export default function GuardianFeesScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: financeKeys.guardian, queryFn: loadFees });
  const [notice, setNotice] = useState<Notice>(null);
  const [receipt, setReceipt] = useState<ReceiptInfo | null>(null);

  const payWithMpesa = useMutation({
    mutationFn: (charge: ChargeInfo) =>
      financeApi.initiateMpesa({ learnerId: charge.learnerId, amount: charge.balance }),
    onSuccess: async (res) => {
      setNotice({
        tone: 'success',
        text: res.mock
          ? `Test mode: payment request ${res.checkoutRequestId} created locally. In live mode, ${res.message.toLowerCase()}`
          : `${res.message} (request ${res.checkoutRequestId})`,
      });
      await queryClient.invalidateQueries({ queryKey: financeKeys.guardian });
    },
    onError: (err) =>
      setNotice({
        tone: 'error',
        text:
          getErrorStatus(err) === 503
            ? 'M-Pesa is not configured for this deployment yet.'
            : 'Could not start the M-Pesa payment. Please try again.',
      }),
  });

  const openReceipt = async (p: PaymentInfo) => {
    try {
      setReceipt(await financeApi.receipt(p.id));
    } catch {
      setNotice({ tone: 'error', text: 'Could not open the receipt.' });
    }
  };

  const charges = data?.charges ?? [];
  const payments = data?.payments ?? [];
  const totalDue = charges.reduce((s, c) => s + c.balance, 0);
  const byWard = charges.reduce<Record<string, ChargeInfo[]>>((acc, c) => {
    (acc[c.learnerName] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Fees"
        description={`School fees for your children${totalDue > 0 ? ` — total balance ${formatKes(totalDue)}` : ''}.`}
      />

      {error && (
        <Alert tone="error" className="mb-4">
          {getErrorStatus(error) === 403 ? 'Not authorized.' : 'Could not load fees. Please try again later.'}
        </Alert>
      )}
      {notice && (
        <Alert tone={notice.tone} className="mb-4">
          {notice.text}
        </Alert>
      )}

      {isLoading ? (
        <LoadingState label="Loading fees…" />
      ) : (
        <div className="space-y-8">
          {Object.keys(byWard).length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong p-8 text-center text-fg-muted">
              No fee invoices yet. Once the school bills fees, they will appear here.
            </div>
          ) : (
            Object.entries(byWard).map(([ward, wardCharges]) => {
              const balance = wardCharges.reduce((s, c) => s + c.balance, 0);
              return (
                <Card key={ward} padding="none" role="region" aria-label={`Fees for ${ward}`}>
                  <header className="flex items-center justify-between border-b border-line px-4 py-3">
                    <h2 className="font-semibold text-fg">{ward}</h2>
                    <Badge tone={balance <= 0 ? 'success' : 'warning'}>Balance {formatKes(balance)}</Badge>
                  </header>
                  <ul>
                    {wardCharges.map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium text-fg">
                            {c.feeItemName} <span className="ml-1 text-xs text-fg-subtle">{c.periodName}</span>
                          </p>
                          <p className="text-xs text-fg-subtle">
                            {c.chargeNumber} · {formatKes(c.amount)} · paid {formatKes(c.paidAmount)}
                            {c.dueDate ? ` · due ${c.dueDate}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <ChargeStatusBadge status={c.status} />
                          {c.balance > 0 && (
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => {
                                setNotice(null);
                                payWithMpesa.mutate(c);
                              }}
                              loading={payWithMpesa.isPending && payWithMpesa.variables?.id === c.id}
                            >
                              {payWithMpesa.isPending && payWithMpesa.variables?.id === c.id
                                ? 'Starting…'
                                : `Pay ${formatKes(c.balance)} via M-Pesa`}
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })
          )}

          <section aria-labelledby="payment-history-heading">
            <h2 id="payment-history-heading" className="mb-2 font-semibold text-fg">
              Payment history
            </h2>
            {payments.length === 0 ? (
              <p className="text-sm text-fg-subtle">No payments recorded yet.</p>
            ) : (
              <Card padding="none">
                <ul>
                  {payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between border-b border-line px-4 py-2.5 text-sm text-fg last:border-0"
                    >
                      <div>
                        <span className="font-medium">{p.learnerName}</span> — {formatKes(p.amount)}
                        <span className="ml-2 text-xs text-fg-subtle">
                          {p.method}
                          {p.providerRef ? ` · ${p.providerRef}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openReceipt(p)}
                        className="text-xs text-accent-strong underline underline-offset-2"
                      >
                        Receipt
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>
        </div>
      )}

      {receipt && <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
