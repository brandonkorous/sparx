// A report opens from the keyboard, like every list row (sparx persona issue 246).
// The card was a bare onClick: no focus, no key, so only a mouse could open one.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./reports-library.tsx', import.meta.url)),
  'utf8'
);
const card = source.slice(source.indexOf('<Card'), source.indexOf('</Card>'));

describe('a report card', () => {
  it('takes focus as a button', () => {
    expect(card).toContain('tabIndex={0}');
    expect(card).toContain('role="button"');
  });

  it('opens on Enter or Space, but not when a button inside it is pressed', () => {
    expect(card).toMatch(/event\.target !== event\.currentTarget/);
    expect(card).toMatch(/'Enter'/);
    expect(card).toMatch(/' '/);
  });
});
