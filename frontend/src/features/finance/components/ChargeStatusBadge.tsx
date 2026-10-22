import { Badge, type BadgeTone } from '@/components/ui';

const TONE: Record<string, BadgeTone> = {
  PAID: 'success',
  COMPLETED: 'success',
  PARTIALLY_PAID: 'warning',
  PENDING: 'neutral',
  VOID: 'danger',
};

const LABEL: Record<string, string> = {
  PAID: 'Paid',
  COMPLETED: 'Completed',
  PARTIALLY_PAID: 'Partly paid',
  PENDING: 'Unpaid',
  VOID: 'Cancelled',
};

/** Invoice / payment status with a readable label. */
export function ChargeStatusBadge({ status }: { status: string }) {
  return <Badge tone={TONE[status] ?? 'neutral'}>{LABEL[status] ?? status}</Badge>;
}
