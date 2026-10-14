// After the "What do you want to do?" box opens something, the keyboard goes there.
// Rosalind opened "Write something new" with Ctrl K and Enter, and focus fell back
// to the page itself, thirty Tab stops from the form (P09).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { focusWasLost } from './pane-focus';

describe('focusWasLost', () => {
  const body = { id: 'body' } as unknown as Element;
  const field = { id: 'field' } as unknown as Element;

  it('is true when the page itself, or nothing, holds focus', () => {
    expect(focusWasLost(body, body)).toBe(true);
    expect(focusWasLost(null, body)).toBe(true);
  });

  it('is false when something already took it, like a dialog the row opened', () => {
    expect(focusWasLost(field, body)).toBe(false);
  });
});

describe('the launcher', () => {
  const source = readFileSync(join(__dirname, 'launcher.tsx'), 'utf8');

  it('sends focus to what it opened, not back to the page', () => {
    expect(source).toMatch(/finalFocus=\{/);
    expect(source).toContain('window.setTimeout(focusOpenedPane, 0)');
    expect(source).toMatch(/openedRef\.current = true;\s*entry\.run\(mods\)/);
  });
});

describe('a pane retargeted in place', () => {
  const source = readFileSync(join(__dirname, '../lib/workbench/controller.ts'), 'utf8');

  it('takes the keyboard back once its new view is in', () => {
    const replace = source.slice(source.indexOf('private replace('));
    expect(replace.slice(0, replace.indexOf('setViewParams('))).toContain(
      'setTimeout(focusOpenedPane, 0)'
    );
  });
});
