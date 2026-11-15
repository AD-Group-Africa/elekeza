/**
 * Normalises a Kenyan mobile number (07XX…, 01XX…, 7XX…, +2547XX…, 2547XX…)
 * into the 2547XXXXXXXX / 2541XXXXXXXX form M-Pesa expects, or null if the
 * input is not a valid mobile number.
 */
export function toMsisdn(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const local = digits.startsWith('254') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  return /^[17]\d{8}$/.test(local) ? '254' + local : null;
}
