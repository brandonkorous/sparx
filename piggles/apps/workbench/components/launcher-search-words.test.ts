import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blindSpot, recordSearchLine } from './launcher-search-words';

const NOTHING_MISSING = { productsMissing: 0, customersMissing: 0, ordersMissing: 0 };
const NOT_MEASURED = { productsMissing: null, customersMissing: null, ordersMissing: null };
// Juniper Row as measured on 2026-09-18.
const JUNIPER = { productsMissing: 31, customersMissing: 36, ordersMissing: 16 };

describe('what the box cannot see', () => {
  it('is silence when nothing is missing', () => {
    expect(blindSpot(NOTHING_MISSING)).toBeNull();
  });

  it('is silence when nothing could be measured', () => {
    // null is "the collection is not there, so we could not look". Reading it
    // as a gap would put a warning on every shop whose indexer is still booting.
    expect(blindSpot(NOT_MEASURED)).toBeNull();
  });

  it('is silence before the status has arrived', () => {
    expect(blindSpot(undefined)).toBeNull();
  });

  it('names each kind, because a number she can check beats a shrug', () => {
    expect(blindSpot(JUNIPER)).toEqual({
      total: 83,
      label: '31 products, 36 customers and 16 orders',
    });
  });

  it('leaves out the kinds that are fine', () => {
    expect(blindSpot({ productsMissing: 0, customersMissing: 2, ordersMissing: null })).toEqual({
      total: 2,
      label: '2 customers',
    });
  });

  it('says one of a kind in the singular', () => {
    expect(blindSpot({ productsMissing: 1, customersMissing: 1, ordersMissing: 0 })?.label).toBe(
      '1 product and 1 customer'
    );
  });
});

describe('the record half of the search box', () => {
  it('says nothing matched when it really has looked at everything', () => {
    expect(
      recordSearchLine({
        searching: false,
        found: 0,
        screens: 3,
        query: 'zzz',
        gaps: NOTHING_MISSING,
      })
    ).toBe('Nothing in your records matches “zzz”. Everything below is a screen.');
  });

  it('refuses to blame her records for what it never read', () => {
    // The defect in one assertion: typing a product she sells in ten sizes was
    // answered "Nothing in your records matches Marlow".
    const line = recordSearchLine({
      searching: false,
      found: 0,
      screens: 3,
      query: 'Marlow',
      gaps: JUNIPER,
    });
    expect(line).not.toContain('Nothing in your records matches');
    expect(line).toContain('Nothing the box can see matches “Marlow”');
    expect(line).toContain('31 products, 36 customers and 16 orders are not in this box yet');
  });

  it('still warns when some records DID match', () => {
    // Two hits out of thirty-four is as misleading as none, and the empty state
    // never fires for it.
    const line = recordSearchLine({
      searching: false,
      found: 2,
      screens: 3,
      query: 'tee',
      gaps: JUNIPER,
    });
    expect(line).toContain('2 records matched');
    expect(line).toContain('are not in this box yet');
  });

  it('keeps the plain sentence when the index is whole', () => {
    expect(
      recordSearchLine({
        searching: false,
        found: 1,
        screens: 3,
        query: 'tee',
        gaps: NOTHING_MISSING,
      })
    ).toBe('1 record matched. The rest are screens.');
  });

  it('agrees with itself when only one record is out of reach', () => {
    // SEEN ON SCREEN 2026-09-18, Juniper Row: typing into the launcher answered
    // "4 records matched. The rest are screens. 1 customer are not in this box
    // yet, so it cannot look at them."
    //
    // `blindSpot` already said "1 customer" rather than "1 customers" — the
    // singular was learned for the NOUN and for nothing else. The verb and the
    // pronoun around it stayed written for a crowd, so the one sentence an owner
    // reads about her own missing records was the one that read as broken
    // software. [[feedback_a_fix_leaves_its_neighbour_behind]]
    const line = recordSearchLine({
      searching: false,
      found: 4,
      screens: 3,
      query: 'Edit a lot at once',
      gaps: { productsMissing: 0, customersMissing: 1, ordersMissing: 0 },
    });
    expect(line).toBe(
      '4 records matched. The rest are screens. 1 customer is not in this box yet, so it cannot look at that one.'
    );
  });

  it('still speaks to a crowd when there is one', () => {
    // The guard above must not be satisfied by making everything singular.
    const line = recordSearchLine({
      searching: false,
      found: 0,
      screens: 3,
      query: 'x',
      gaps: JUNIPER,
    });
    expect(line).toContain('are not in this box yet, so it cannot look at them.');
  });

  /* ── The sentence may only describe rows that are there ──────────────── */

  it('does not promise screens below it when no screen matched', () => {
    // SEEN ON SCREEN 2026-09-25, Juniper Row: typing the customer name "Tamsin"
    // returned her, two invoices, a quote and two orders. Six rows, every one a
    // record, and the box finished "The rest are screens." There was no rest.
    const line = recordSearchLine({
      searching: false,
      found: 6,
      screens: 0,
      query: 'Tamsin',
      gaps: NOTHING_MISSING,
    });
    expect(line).toBe('6 records matched.');
    expect(line).not.toContain('The rest are screens');
  });

  it('still names the screens when there are some', () => {
    // The guard above must not be satisfied by dropping the sentence for good.
    expect(
      recordSearchLine({
        searching: false,
        found: 6,
        screens: 1,
        query: 'Tamsin',
        gaps: NOTHING_MISSING,
      })
    ).toBe('6 records matched. The rest are screens.');
  });

  it('does not point at an empty list', () => {
    // Nothing matched at all, so the list shows its own empty state. "Everything
    // below is a screen" sat directly above nothing.
    const line = recordSearchLine({
      searching: false,
      found: 0,
      screens: 0,
      query: 'zzqqxx',
      gaps: NOTHING_MISSING,
    });
    expect(line).toBe('Nothing in your records matches “zzqqxx”.');
    expect(line).not.toContain('below');
  });

  it('does not point at an empty list when it cannot see her records either', () => {
    const line = recordSearchLine({
      searching: false,
      found: 0,
      screens: 0,
      query: 'zzqqxx',
      gaps: JUNIPER,
    });
    expect(line).toContain('Nothing the box can see matches');
    expect(line).toContain('are not in this box yet');
    expect(line).not.toContain('below');
  });

  it('says it is still looking before it answers', () => {
    expect(
      recordSearchLine({ searching: true, found: 0, screens: 3, query: 'tee', gaps: JUNIPER })
    ).toBe('Looking through your records…');
  });
});

/* ── A group heading is a NAME, not a function's source ──────────────────── */

describe('the group a record hit sits under', () => {
  function repoRoot(): string {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 12; i += 1) {
      try {
        readFileSync(join(dir, 'pnpm-workspace.yaml'));
        return dir;
      } catch {
        dir = dirname(dir);
      }
    }
    throw new Error('pnpm-workspace.yaml not found above this test');
  }

  // This console only — reading the other one's tree would make either product
  // undeletable (`check:boundaries`). The same test lives over there.
  it.each(['piggles/apps/workbench/components/launcher-entries.ts'])(
    '%s resolves a title rather than stringifying the field',
    (file) => {
      // A surface may title itself with a FUNCTION of its params — the till reads
      // "Take a sale" or "Enter an order" depending which door opened it (issue
      // 748) — and `.toString()` on one prints the arrow function's SOURCE as a
      // heading. It also skips this brand's own word for the screen.
      const body = readFileSync(join(repoRoot(), file), 'utf8');
      expect(body).not.toContain('.title.toString()');
      expect(body).toContain('resolveTitle(surface, {})');
    }
  );
});
