import { apiClient } from '@/lib/api';

export interface PeriodInfo {
  id: number;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent: boolean;
}
export interface FeeItemInfo {
  id: number;
  name: string;
  description?: string | null;
  amount: number;
  active: boolean;
}
export interface FeeStructureInfo {
  id: number;
  periodId: number;
  feeItemId: number;
  feeItemName: string;
  classId?: number | null;
  amount: number;
}
export interface ChargeInfo {
  id: number;
  chargeNumber: string;
  learnerId: number;
  learnerName: string;
  periodId: number;
  periodName: string;
  feeItemId: number;
  feeItemName: string;
  description?: string | null;
  amount: number;
  paidAmount: number;
  balance: number;
  status: string;
  dueDate?: string | null;
  createdAt: string;
}
export interface PaymentInfo {
  id: number;
  paymentNumber: string;
  learnerId: number;
  learnerName: string;
  amount: number;
  method: string;
  status: string;
  providerRef?: string | null;
  note?: string | null;
  paidAt: string;
  allocations: Array<{ chargeId: number; chargeNumber: string; amount: number }>;
}
export interface ReceiptInfo {
  receiptNumber: string;
  paymentId: number;
  learnerId: number;
  learnerName: string;
  institutionName: string;
  amount: number;
  method: string;
  providerRef?: string | null;
  recordedByName?: string | null;
  paidAt: string;
  lines: Array<{ chargeNumber: string; feeItemName: string; amount: number; chargeStatusAfter: string }>;
}
export interface FinanceSummary {
  periodId?: number | null;
  periodName?: string | null;
  totalBilled: number;
  totalCollected: number;
  outstanding: number;
  chargeCount: number;
  paymentCount: number;
  recentPayments: PaymentInfo[];
}

/** School fees: periods, fee items, structures, charges, payments, receipts. */
export const financeApi = {
  periods: () => apiClient.get<PeriodInfo[]>('/finance/periods').then((r) => r.data),
  createPeriod: (payload: { name: string; startDate?: string; endDate?: string; isCurrent?: boolean }) =>
    apiClient.post<PeriodInfo>('/finance/periods', payload).then((r) => r.data),
  feeItems: () => apiClient.get<FeeItemInfo[]>('/finance/fee-items').then((r) => r.data),
  createFeeItem: (payload: { name: string; description?: string; amount: number }) =>
    apiClient.post<FeeItemInfo>('/finance/fee-items', payload).then((r) => r.data),
  structures: (periodId?: number) =>
    apiClient.get<FeeStructureInfo[]>('/finance/structures', { params: { periodId } }).then((r) => r.data),
  createStructure: (payload: { periodId: number; feeItemId: number; classId?: number | null; amount: number }) =>
    apiClient.post<FeeStructureInfo>('/finance/structures', payload).then((r) => r.data),
  applyStructure: (id: number) =>
    apiClient
      .post<{ created: number; skippedExisting: number }>(`/finance/structures/${id}/apply`, {})
      .then((r) => r.data),
  charges: (params?: { periodId?: number; learnerId?: number }) =>
    apiClient.get<ChargeInfo[]>('/finance/charges', { params }).then((r) => r.data),
  createCharge: (payload: {
    learnerId: number;
    periodId: number;
    feeItemId: number;
    amount: number;
    dueDate?: string;
    description?: string;
  }) => apiClient.post<ChargeInfo>('/finance/charges', payload).then((r) => r.data),
  payments: (learnerId?: number) =>
    apiClient.get<PaymentInfo[]>('/finance/payments', { params: { learnerId } }).then((r) => r.data),
  manualPayment: (payload: {
    learnerId: number;
    amount: number;
    method: 'CASH' | 'BANK';
    note?: string;
    providerRef?: string;
    allocations?: Array<{ chargeId: number; amount: number }>;
  }) => apiClient.post<PaymentInfo>('/finance/payments/manual', payload).then((r) => r.data),
  initiateMpesa: (payload: { learnerId: number; amount: number; phone?: string }) =>
    apiClient
      .post<{ checkoutRequestId: string; status: string; mock: boolean; message: string }>(
        '/finance/payments/mpesa/initiate',
        payload,
      )
      .then((r) => r.data),
  mpesaMode: () => apiClient.get<{ mock: boolean }>('/finance/payments/mpesa/mode').then((r) => r.data),
  receipt: (paymentId: number) => apiClient.get<ReceiptInfo>(`/finance/receipts/${paymentId}`).then((r) => r.data),
  summary: (periodId?: number) =>
    apiClient.get<FinanceSummary>('/finance/summary', { params: { periodId } }).then((r) => r.data),
  /** School subscription via M-Pesa STK push. */
  subscriptionStkPush: (phone: string, amount: number) =>
    apiClient.post('/payments/stkpush', { phone, amount }).then((r) => r.data),
};

export const financeKeys = {
  all: ['finance'] as const,
  overview: ['finance', 'overview'] as const,
  guardian: ['finance', 'guardian'] as const,
};
