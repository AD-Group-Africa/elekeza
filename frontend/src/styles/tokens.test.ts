import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROLE_PALETTES } from '@/features/accessibility/rolePalette';

/**
 * static guards for the theme system. the light-mode login button vanished
 * because tokens referenced variables that only existed inside an unused
 * theme block; these checks fail the build if that ever happens again.
 */

const SRC = join(__dirname, '..');
const tokens = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8');
const remaps = readFileSync(join(SRC, 'styles/theme-remaps.css'), 'utf8');
const globals = readFileSync(join(SRC, 'app/globals.css'), 'utf8');
const tailwind = readFileSync(join(SRC, '../tailwind.config.ts'), 'utf8');

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** declarations inside the first block whose selector list contains `selector`. */
function blockFor(css: string, selector: string): string {
  const clean = stripComments(css);
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(clean); m; m = re.exec(clean)) {
    const selectors = m[1].split(',').map((s) => s.trim());
    if (selectors.includes(selector)) return m[2];
  }
  throw new Error(`no block for ${selector}`);
}

const declared = (body: string) => new Set([...body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

const SEMANTIC = [
  '--bg-primary',
  '--bg-secondary',
  '--bg-gradient',
  '--bg-card',
  '--bg-card-hover',
  '--border-color',
  '--border-strong',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--accent',
  '--accent-hover',
  '--accent-strong',
  '--accent-soft',
  '--accent-contrast',
  '--warm-accent',
  '--warm-accent-soft',
  '--focus-ring',
  '--ek-ok',
  '--ek-warn',
  '--ek-danger',
  '--ek-info',
  '--p50',
  '--p100',
  '--p200',
  '--p300',
  '--p400',
  '--p500',
  '--p600',
  '--p700',
  '--p900',
];

const HUES = ['050', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']
  .map((step) => `--hue-${step}`)
  .concat('--hue-fill', '--hue-fill-hover');

describe('theme tokens', () => {
  it.each(["[data-theme='dark']", "[data-theme='light']", "[data-theme='calm']"])(
    '%s defines every semantic token',
    (selector) => {
      const vars = declared(blockFor(tokens, selector));
      expect(SEMANTIC.filter((name) => !vars.has(name))).toEqual([]);
    },
  );

  it.each(ROLE_PALETTES.map((p) => `[data-role='${p}']`))('%s defines the whole hue ramp', (selector) => {
    const vars = declared(blockFor(tokens, selector));
    expect(HUES.filter((name) => !vars.has(name))).toEqual([]);
  });

  it('has a css block for every palette the app can set, and no extra ones', () => {
    const inCss = [...stripComments(tokens).matchAll(/\[data-role='([\w-]+)'\]/g)].map((m) => m[1]);
    expect([...new Set(inCss)].sort()).toEqual([...ROLE_PALETTES].sort());
  });

  it('never combines two values of the same attribute (such selectors can not match)', () => {
    const all = stripComments(tokens + remaps + globals);
    expect(all).not.toMatch(/\[data-theme=[^\]]+\]\[data-theme=/);
    expect(all).not.toMatch(/\[data-role=[^\]]+\]\[data-role=/);
  });

  it('only references css variables that resolve in every role and mode', () => {
    // a variable is always available only if a block that includes :root
    // declares it; one declared only inside a single theme or role block is
    // undefined everywhere else (the original light-mode bug).
    const available = new Set<string>();
    for (const css of [tokens, remaps, globals]) {
      const re = /([^{}]+)\{([^{}]*)\}/g;
      const clean = stripComments(css);
      for (let m = re.exec(clean); m; m = re.exec(clean)) {
        if (m[1].split(',').some((s) => s.trim() === ':root')) {
          for (const name of declared(m[2])) available.add(name);
        }
      }
    }
    const sources = [tokens, remaps, globals, tailwind, ...sourceFiles(SRC).map((f) => readFileSync(f, 'utf8'))];
    const missing = new Set<string>();
    for (const text of sources) {
      for (const m of stripComments(text).matchAll(/var\((--[\w-]+)/g)) {
        const name = m[1];
        // tailwind's own runtime variables are set by its utilities
        if (!name.startsWith('--tw-') && !available.has(name)) missing.add(name);
      }
    }
    expect([...missing].sort()).toEqual([]);
  });
});
