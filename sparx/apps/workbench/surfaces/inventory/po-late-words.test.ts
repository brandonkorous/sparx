// A placed order past its day says so (persona issue 280): PO-000002, due
// October 7, said only "Waiting for it to arrive" on October 14.

import { describe, expect, it } from 'vitest';

import { lateBadge, lateWords } from './po-late-words';

const now = new Date('2026-10-14T15:00:00');
const po = (status: string, expectedArrivalAt: string | null) => ({ status, expectedArrivalAt });

describe('an order that is late', () => {
  it('says how late, and from when', () => {
    expect(lateWords(po('submitted', '2026-10-07T00:00:00.000Z'), now)).toBe(
      'It is 7 days late: it was due October 7.'
    );
  });

  it('says yesterday for one day', () => {
    expect(lateWords(po('partial', '2026-10-13T00:00:00.000Z'), now)).toBe(
      'It was due yesterday, October 13.'
    );
  });

  it('says nothing when it is not late, has no day, or is not still coming', () => {
    expect(lateWords(po('submitted', '2026-10-14T00:00:00.000Z'), now)).toBeNull();
    expect(lateWords(po('submitted', null), now)).toBeNull();
    expect(lateWords(po('received', '2026-10-07T00:00:00.000Z'), now)).toBeNull();
    expect(lateWords(po('draft', '2026-10-07T00:00:00.000Z'), now)).toBeNull();
  });
});

describe('the late badge on a list row', () => {
  it('says how many days', () => {
    expect(lateBadge(po('submitted', '2026-10-07T00:00:00.000Z'), now)).toBe('7 days late');
    expect(lateBadge(po('partial', '2026-10-13T00:00:00.000Z'), now)).toBe('1 day late');
    expect(lateBadge(po('received', '2026-10-07T00:00:00.000Z'), now)).toBeNull();
  });
});
