// The shaded hours in the diary. Issue 084.
//
// Pinned because a wrong band is invisible to every check but looking: a band
// in the wrong place is still a valid class string, and a band that never draws
// is an empty array, which renders exactly like a business that is open all day.
// Also pins the one rule this console adds over the other one: a weekly window
// bounded by season dates (issue 866) does not open the business outside them,
// because the booking page will refuse everyone on that day.

import { describe, expect, it } from 'vitest';

import { closedBandsFor, worksOn } from './calendar-hours';
import type { TimeWindow } from './calendar-grid';
import type { AvailabilityException, AvailabilityWindow } from './setup-data';

const CHAIR = 'res-chair';
/** 08:00 to 18:00, the diary's default span: forty 15-minute slots. */
const VIEW: TimeWindow = { startMin: 8 * 60, endMin: 18 * 60, slots: 40 };

/** Wednesday 4 March 2026, local time. */
const WEDNESDAY = new Date(2026, 2, 4);
/** Thursday 5 March 2026. */
const THURSDAY = new Date(2026, 2, 5);

function window(partial: Partial<AvailabilityWindow>): AvailabilityWindow {
  return {
    id: 'w1',
    resourceId: CHAIR,
    dayOfWeek: 3,
    startMinute: 9 * 60,
    endMinute: 17 * 60,
    validFrom: null,
    validTo: null,
    ...partial,
  };
}

function closure(partial: Partial<AvailabilityException>): AvailabilityException {
  return {
    id: 'x1',
    resourceId: null,
    locationId: null,
    kind: 'closed',
    startAt: new Date(2026, 2, 4).toISOString(),
    endAt: new Date(2026, 2, 5).toISOString(),
    reason: null,
    meta: {},
    ...partial,
  };
}

describe('closedBandsFor', () => {
  it('shades before opening and after closing on a working day', () => {
    const bands = closedBandsFor(WEDNESDAY, CHAIR, [window({})], [], VIEW);
    // 08:00 to 09:00 is four slots from the top; 17:00 to 18:00 is four more.
    expect(bands.map((b) => [b.topClass, b.heightClass])).toEqual([
      ['top-[0px]', 'h-[64px]'],
      ['top-[576px]', 'h-[64px]'],
    ]);
  });

  it('shades the whole column on a day they do not work', () => {
    const bands = closedBandsFor(THURSDAY, CHAIR, [window({})], [], VIEW);
    expect(bands).toHaveLength(1);
    expect(bands[0]?.heightClass).toBe('h-[640px]');
    expect(worksOn(THURSDAY, CHAIR, [window({})], [])).toBe(false);
  });

  it('shades the whole day under a business-wide closure, named by its reason', () => {
    const bands = closedBandsFor(
      WEDNESDAY,
      CHAIR,
      [window({})],
      [closure({ reason: 'Staff training' })],
      VIEW
    );
    expect(bands).toHaveLength(1);
    expect(bands[0]?.title).toBe('Staff training');
  });

  it('does not let a closure that ENDS at midnight shut the next day too', () => {
    const tuesdayOnly = closure({
      startAt: new Date(2026, 2, 3).toISOString(),
      endAt: new Date(2026, 2, 4).toISOString(),
    });
    expect(worksOn(WEDNESDAY, CHAIR, [window({})], [tuesdayOnly])).toBe(true);
  });

  it("ignores somebody else's hours", () => {
    const theirs = window({ resourceId: 'res-other' });
    expect(worksOn(WEDNESDAY, CHAIR, [theirs], [])).toBe(false);
  });

  it('keeps a seasonal window shut outside its dates', () => {
    const summerOnly = window({ validFrom: '2026-06-01', validTo: '2026-08-31' });
    expect(worksOn(WEDNESDAY, CHAIR, [summerOnly], [])).toBe(false);
    expect(worksOn(new Date(2026, 6, 1), CHAIR, [summerOnly], [])).toBe(true);
  });

  it("reads a closure on the business's clock, not the viewer's", () => {
    // Thursday 5 March in Tokyo, midnight to midnight. On a viewer's clock hours
    // behind, the same instants also cover most of Wednesday.
    const tokyoThursday = closure({
      startAt: '2026-03-04T15:00:00.000Z',
      endAt: '2026-03-05T15:00:00.000Z',
    });
    const week = [window({}), window({ id: 'w2', dayOfWeek: 4 })];
    expect(worksOn(WEDNESDAY, CHAIR, week, [tokyoThursday], 'Asia/Tokyo')).toBe(true);
    expect(worksOn(THURSDAY, CHAIR, week, [tokyoThursday], 'Asia/Tokyo')).toBe(false);
  });
});
