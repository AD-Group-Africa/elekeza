/** Display formatters shared across pages. All tolerate empty or invalid input. */

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "21 Oct 2026, 14:03" — or '' when there is no valid date. */
export function formatDateTime(value: DateInput): string {
  const d = toDate(value);
  return d ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

/** "21 Oct 2026" — or '' when there is no valid date. */
export function formatDate(value: DateInput): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString(undefined, { dateStyle: 'medium' }) : '';
}

/** "KES 1,500" */
export function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}
