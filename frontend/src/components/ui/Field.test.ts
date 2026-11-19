import { describe, expect, it } from 'vitest';
import { controlClass, inputClass } from './Field';

describe('controlClass', () => {
  it('returns the base classes when nothing is passed', () => {
    expect(controlClass()).toBe(inputClass);
  });

  it('drops the default width and padding when the caller overrides them', () => {
    const cls = controlClass('w-auto py-1.5 text-sm').split(' ');
    expect(cls).not.toContain('w-full');
    expect(cls).not.toContain('py-2.5');
    expect(cls).toContain('px-3');
    expect(cls).toEqual(expect.arrayContaining(['w-auto', 'py-1.5', 'text-sm']));
  });
});
