// The refresh control names its action in a word true on every pane (persona
// issue 256). Record panes use it too, and one order offered "Refresh this list".

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./refresh-button.tsx', import.meta.url)),
  'utf8'
);
const words = source.replace(/^\s*(\/\/|\/\*|\*).*$/gm, '');

describe('the refresh control', () => {
  it('does not call a record pane a list', () => {
    expect(words).not.toMatch(/this list/);
  });

  it('says Refresh in the menu row and in its spoken name', () => {
    expect(words).toContain('<span>Refresh</span>');
    expect(words).toContain('aria-label="Refresh"');
  });
});
