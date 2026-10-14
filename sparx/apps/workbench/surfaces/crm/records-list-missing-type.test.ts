// A record type that is not there says so (sparx persona issue 240).
//
// A list for a type with no definition fetched the type, got "not found", and
// read nothing of it: it drew a search box, an Add button and "You made this
// record type up ... Add the first record" for a type that did not exist.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
const pane = read('./records-list.tsx');

describe('a list for a record type that is not there', () => {
  it('shows the shared not-found state before any list', () => {
    const gate = pane.indexOf('if (type.isError)');
    expect(gate).toBeGreaterThan(-1);
    expect(pane.slice(gate, gate + 600)).toMatch(
      /<PaneLoadError[\s\S]*?error=\{type\.error\}[\s\S]*?noun="record type"/
    );
    expect(gate).toBeLessThan(pane.indexOf('<PaneToolbar'));
  });

  it('stops the form for a new record of that type too', () => {
    const detail = read('./record-detail.tsx');
    const gate = detail.indexOf('if (type.isError)');
    expect(gate).toBeGreaterThan(-1);
    expect(detail.slice(gate, gate + 400)).toMatch(
      /<PaneLoadError[\s\S]*?error=\{type\.error\}[\s\S]*?noun="record type"/
    );
  });
});
