// Adding a report to a board opens on a picker that says what to do (persona
// issue 258). It drew an empty box beside a disabled "Add it".

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const dir = fileURLToPath(new URL('.', import.meta.url));
const source = readdirSync(dir)
  .filter((name) => /^dashboard.*\.tsx$/.test(name))
  .map((name) => readFileSync(`${dir}/${name}`, 'utf8'))
  .join('\n');

describe('the board report picker', () => {
  it('says what to do while nothing is chosen', () => {
    const picker = /aria-label="Which report"[\s\S]{0,400}?\/>/.exec(source)?.[0] ?? '';
    expect(picker).not.toBe('');
    expect(picker).toContain('placeholder="Choose a report"');
  });
});
