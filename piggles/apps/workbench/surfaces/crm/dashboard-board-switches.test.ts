// Only a shared board can be the one Dashboards opens on (persona issue 264), so
// the two switches move together instead of letting the form ask for what the
// server refuses.

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { withOpensFirst, withShared } from './dashboard-board-switches';

const draft = {
  mode: 'new' as const,
  name: 'Monday',
  description: '',
  isDefault: false,
  shared: false,
};

describe('the board form switches', () => {
  it('shares a board that is made the one Dashboards opens on', () => {
    expect(withOpensFirst(draft, true)).toMatchObject({ isDefault: true, shared: true });
  });

  it('stops a board opening first when it is made private', () => {
    expect(withShared({ ...draft, isDefault: true, shared: true }, false)).toMatchObject({
      isDefault: false,
      shared: false,
    });
  });

  it('leaves the other switch alone otherwise', () => {
    expect(withOpensFirst({ ...draft, shared: true }, false)).toMatchObject({ shared: true });
    expect(withShared(draft, true)).toMatchObject({ isDefault: false, shared: true });
  });

  it('is what the form uses', () => {
    const dir = fileURLToPath(new URL('.', import.meta.url));
    const form = readdirSync(dir)
      .filter((n) => /^dashboard.*\.tsx$/.test(n))
      .map((n) => readFileSync(`${dir}/${n}`, 'utf8'))
      .join('\n');
    expect(form).toContain('withOpensFirst(');
    expect(form).toContain('withShared(');
  });
});
