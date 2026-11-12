import { describe, expect, it } from 'vitest';
import { formatDate, formatKes } from './format';

describe('formatDate', () => {
  it('reads a bare YYYY-MM-DD as that calendar day in local time', () => {
    const expected = new Date(2026, 9, 8).toLocaleDateString(undefined, { dateStyle: 'medium' });
    expect(formatDate('2026-10-08')).toBe(expected);
  });

  it('returns an empty string for missing or invalid input', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('not a date')).toBe('');
  });
});

describe('formatKes', () => {
  it('formats whole shillings', () => {
    expect(formatKes(1500)).toBe('KES 1,500');
  });
});
