'use client';

import { useEffect } from 'react';
import { formatDateTime, formatKes } from '@/lib/format';
import type { ReceiptInfo } from '../api';

/**
 * Printable payment receipt (modal). Always dark text on white so it reads
 * and prints the same in every theme. Escape or a backdrop click closes it.
 */
export function ReceiptDialog({ receipt, onClose }: { receipt: ReceiptInfo; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Receipt ${receipt.receiptNumber}`}
        className="w-full max-w-md rounded-2xl bg-white p-6 text-gray-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Receipt {receipt.receiptNumber}</h2>
            <p className="text-sm text-gray-600">{receipt.institutionName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            ✕
          </button>
        </div>
        <dl className="mb-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Learner</dt>
            <dd className="font-medium">{receipt.learnerName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Amount</dt>
            <dd className="font-bold">{formatKes(receipt.amount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Method</dt>
            <dd>{receipt.method}</dd>
          </div>
          {receipt.providerRef && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Reference</dt>
              <dd className="font-mono text-xs">{receipt.providerRef}</dd>
            </div>
          )}
          {receipt.recordedByName && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Recorded by</dt>
              <dd>{receipt.recordedByName}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-500">Date</dt>
            <dd>{formatDateTime(receipt.paidAt)}</dd>
          </div>
        </dl>
        {receipt.lines.length > 0 && (
          <table className="w-full text-sm">
            <caption className="sr-only">Applied to invoices</caption>
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th scope="col" className="py-1 font-medium">
                  Invoice
                </th>
                <th scope="col" className="py-1 font-medium">
                  Item
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Applied
                </th>
              </tr>
            </thead>
            <tbody>
              {receipt.lines.map((l, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1 font-mono text-xs">{l.chargeNumber}</td>
                  <td className="py-1">{l.feeItemName}</td>
                  <td className="py-1 text-right">{formatKes(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="mt-5 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          Print receipt
        </button>
      </div>
    </div>
  );
}
