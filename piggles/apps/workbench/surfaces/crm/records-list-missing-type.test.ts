// A record type that is not there says so (sparx persona issue 240).
//
// A list for a type with no definition fetched the type, got "not found", and
// read nothing of it: it drew a search box, an Add button and "You made this up
// yourself ... Add the first record" for a type that did not exist. The form for
// a new record of it would have drawn too, and failed on Save.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');

describe('a record type that is not there', () => {
  it.each(['./records-list.tsx', './record-detail.tsx'])(
    '%s shows the shared state before anything else',
    (file) => {
      const pane = read(file);
      const gate = pane.indexOf('if (type.isError)');
      expect(gate).toBeGreaterThan(-1);
      expect(pane.slice(gate, gate + 200)).toMatch(
        /<RecordTypeMissing[\s\S]*?error=\{type\.error\}/
      );
    }
  );

  it('is the not-found state, worded for a record type', () => {
    const states = read('./records-list-states.tsx');
    const at = states.indexOf('export function RecordTypeMissing');
    expect(states.slice(at, at + 700)).toMatch(
      /<PaneLoadError[\s\S]*?error=\{error\}[\s\S]*?noun="record type"/
    );
  });
});
