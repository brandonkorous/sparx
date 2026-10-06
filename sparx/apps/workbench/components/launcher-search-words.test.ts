import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blindSpot, recordSearchLine, SEARCH_MOST_CHARS } from './launcher-search-words';

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

  /* ── The sentence may only describe rows that are there ──────────── */

  it('does not promise screens below it when no screen matched', () => {
    // SEEN ON SCREEN 2026-09-25 in the other console, whose launcher is this
    // one's twin: typing a customer's name returned her, two invoices, a quote
    // and two orders. Six rows, every one a record, and the box finished "The
    // rest are screens." There was no rest.
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
  it.each(['sparx/apps/workbench/components/launcher-entries.ts'])(
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

// Both search backends cap what they send. The count used to be of the rows the
// box was handed, so a name matching forty records said "12 records matched"
// and offered nothing more.
describe('records that matched and were not sent', () => {
  const base = { searching: false, screens: 0, query: 'Wasatch', gaps: NOTHING_MISSING };

  it('says how many more there are when the box can fetch them', () => {
    expect(recordSearchLine({ ...base, found: 12, more: 30, canShowMore: true })).toBe(
      '12 records matched. 30 more match and are not shown yet.'
    );
  });

  it('says one more in the singular', () => {
    expect(recordSearchLine({ ...base, found: 32, more: 1, canShowMore: true })).toBe(
      '32 records matched. 1 more matches and is not shown yet.'
    );
  });

  it('asks for another word once nothing more can be fetched', () => {
    expect(recordSearchLine({ ...base, found: 250, more: 9, canShowMore: false })).toBe(
      '250 records matched. 9 more match. Add another word to narrow it down.'
    );
  });

  it('keeps the screens ending after it', () => {
    expect(recordSearchLine({ ...base, screens: 2, found: 12, more: 3, canShowMore: true })).toBe(
      '12 records matched. 3 more match and are not shown yet. The rest are screens.'
    );
  });

  it('says nothing extra when everything that matched is on screen', () => {
    expect(recordSearchLine({ ...base, found: 12, more: 0, canShowMore: false })).toBe(
      '12 records matched.'
    );
  });

  it('says nothing extra when the server did not say', () => {
    // null is "not measured", which is silence, never a claim either way.
    expect(recordSearchLine({ ...base, found: 12, more: null })).toBe('12 records matched.');
  });
});

describe('a search that did not answer', () => {
  // MEASURED 2026-10-06 on Gillett Diesel Service, with the API restarting:
  // "O-0000" said "Nothing in your records matches" over fifteen orders that do.
  const base = { searching: false, screens: 0, query: 'O-0000', gaps: NOTHING_MISSING };

  it('does not say nothing matched', () => {
    expect(recordSearchLine({ ...base, found: 0, failed: true })).toBe(
      'The search could not reach your records just now, so this is not an answer. Try again in a moment.'
    );
  });

  it('does not say nothing matched even when it knows of a blind spot', () => {
    expect(
      recordSearchLine({
        ...base,
        found: 0,
        failed: true,
        gaps: { ...NOTHING_MISSING, ordersMissing: 3 },
      })
    ).toBe(
      'The search could not reach your records just now, so this is not an answer. Try again in a moment.'
    );
  });

  it('shows what did come back without promising it is all', () => {
    expect(recordSearchLine({ ...base, found: 5, failed: true, more: 0 })).toBe(
      '5 records came back, but part of the search did not answer, so there may be more. Try again in a moment.'
    );
  });

  it('still says it is looking while it asks again', () => {
    expect(recordSearchLine({ ...base, found: 0, failed: true, searching: true })).toBe(
      'Looking through your records…'
    );
  });
});

describe('a search too long to send', () => {
  // A 24,000-character paste made a request the server refused every time, so
  // "try again in a moment" could never work. Past the most, the box says so.
  const base = { searching: false, screens: 0, found: 0, gaps: NOTHING_MISSING };

  it('says it is too long instead of asking to try again', () => {
    expect(recordSearchLine({ ...base, query: 'Wasatch '.repeat(200), failed: true })).toBe(
      'That is too long to search. Try a few words from it.'
    );
  });

  it('still searches right up to the most', () => {
    expect(recordSearchLine({ ...base, query: 'a'.repeat(SEARCH_MOST_CHARS) })).toBe(
      `Nothing in your records matches “${'a'.repeat(SEARCH_MOST_CHARS)}”.`
    );
  });
});
