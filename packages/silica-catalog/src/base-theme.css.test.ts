// base-theme.css must stay a faithful projection of BASE_SILICA_THEME.
//
// The CSS file exists because Tailwind needs the color keys declared at BUILD time
// (see its header). That makes it a second copy of values whose source of truth is
// the TS constant — so this test is the thing that makes the copy safe: it fails
// loudly, naming the exact key, the moment the two disagree.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BASE_SILICA_THEME } from './base-theme';

const CSS = readFileSync(fileURLToPath(new URL('./base-theme.css', import.meta.url)), 'utf8');

/** The `--key: value` pairs inside the file's single `@theme { … }` block. */
function parseThemeBlock(css: string): Record<string, string> {
  const block = /@theme\s*\{([\s\S]*)\}/.exec(css);
  if (!block) throw new Error('base-theme.css has no @theme block');
  const out: Record<string, string> = {};
  for (const match of block[1]!.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[match[1]!] = match[2]!.trim();
  }
  return out;
}

/** Every `--color-*` the TS base theme declares for light. */
function baseColorTokens(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(BASE_SILICA_THEME.tokens).filter(([k]) => k.startsWith('--color-'))
  );
}

describe('base-theme.css', () => {
  const css = parseThemeBlock(CSS);
  const ts = baseColorTokens();

  it('declares a non-empty @theme block', () => {
    expect(Object.keys(css).length).toBeGreaterThan(0);
  });

  it('covers every --color-* key the TS base theme declares', () => {
    // A key added to base-theme.ts and forgotten here would silently stop
    // `ring-<name>` / `from-<name>` from generating — nothing errors, the utility
    // just never appears.
    expect(Object.keys(css).sort()).toEqual(Object.keys(ts).sort());
  });

  it('matches the TS base theme value for every key', () => {
    for (const [key, value] of Object.entries(ts)) {
      expect(css[key], `base-theme.css ${key} drifted from BASE_SILICA_THEME`).toBe(value);
    }
  });

  it('never reintroduces the retired --st-* bridge', () => {
    // Scoped to the DECLARATIONS — the header prose names `--st-*` to explain what
    // this file replaced, which is documentation, not a bridge.
    expect(Object.entries(css).flat().join(' ')).not.toContain('--st-');
  });
});
