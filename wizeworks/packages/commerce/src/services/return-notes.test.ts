// A note read by a shop owner must never name a row by its id.
//
// Two guards, because the wording and the CALLER can regress separately. The
// first pair checks the sentence. The last one checks that the service still
// builds it here, and is the one that would have caught the original bug: the
// wording was never wrong, the call site simply interpolated the uuid itself.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { replacementStockNote } from './return-notes';

describe('replacementStockNote', () => {
  it('names the order the return came from', () => {
    expect(replacementStockNote('O-000016')).toBe(
      'Replacement sent for the return on order O-000016'
    );
  });

  it('still says what happened when the order is gone', () => {
    // A hard-deleted order leaves the return without a name. Saying less is
    // right; falling back to the id is what this module exists to stop.
    expect(replacementStockNote(null)).toBe('Replacement sent for a return');
    expect(replacementStockNote('   ')).toBe('Replacement sent for a return');
  });
});

describe('the return service', () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'return-service.ts'),
    'utf8'
  );

  it('builds its stock notes here, rather than interpolating an id', () => {
    // `note:` is the field a shop owner reads on "Every change". Every one the
    // return service writes must be a call, not a template carrying an id.
    const notes = [...source.matchAll(/note:\s*([^\n]*)/g)].map((m) => m[1]);
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) {
      expect(note).not.toMatch(/\$\{[^}]*(\bid\b|Id\b|\.id\b)[^}]*\}/);
    }
    expect(source).toContain('replacementStockNote(');
  });
});
