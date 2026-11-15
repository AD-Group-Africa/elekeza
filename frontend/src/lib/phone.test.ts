import { describe, expect, it } from 'vitest';
import { toMsisdn } from './phone';

describe('toMsisdn', () => {
  it.each([
    ['0712345678', '254712345678'],
    ['0712 345 678', '254712345678'],
    ['712345678', '254712345678'],
    ['+254712345678', '254712345678'],
    ['254712345678', '254712345678'],
    ['0110345678', '254110345678'],
  ])('normalises %s', (input, expected) => {
    expect(toMsisdn(input)).toBe(expected);
  });

  it.each(['', '12345', '0812345678', '07123456789', 'abc'])('rejects %s', (input) => {
    expect(toMsisdn(input)).toBeNull();
  });
});
