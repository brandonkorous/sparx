import { describe, expect, it } from 'vitest';
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
      recordSearchLine({ searching: false, found: 0, query: 'zzz', gaps: NOTHING_MISSING })
    ).toBe('Nothing in your records matches “zzz”. Everything below is a screen.');
  });

  it('refuses to blame her records for what it never read', () => {
    // The defect in one assertion: typing a product she sells in ten sizes was
    // answered "Nothing in your records matches Marlow".
    const line = recordSearchLine({ searching: false, found: 0, query: 'Marlow', gaps: JUNIPER });
    expect(line).not.toContain('Nothing in your records matches');
    expect(line).toContain('Nothing the box can see matches “Marlow”');
    expect(line).toContain('31 products, 36 customers and 16 orders are not in this box yet');
  });

  it('still warns when some records DID match', () => {
    // Two hits out of thirty-four is as misleading as none, and the empty state
    // never fires for it.
    const line = recordSearchLine({ searching: false, found: 2, query: 'tee', gaps: JUNIPER });
    expect(line).toContain('2 records matched');
    expect(line).toContain('are not in this box yet');
  });

  it('keeps the plain sentence when the index is whole', () => {
    expect(
      recordSearchLine({ searching: false, found: 1, query: 'tee', gaps: NOTHING_MISSING })
    ).toBe('1 record matched. The rest are screens.');
  });

  it('says it is still looking before it answers', () => {
    expect(recordSearchLine({ searching: true, found: 0, query: 'tee', gaps: JUNIPER })).toBe(
      'Looking through your records…'
    );
  });
});
