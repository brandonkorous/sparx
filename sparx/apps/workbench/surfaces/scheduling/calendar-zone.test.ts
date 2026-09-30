// Where a block sits in the diary, on the booking's own clock.
//
// Pinned because the defect was invisible from inside one zone: the grid read
// the viewer's clock, so for everyone sitting in the business's zone it was
// right, and for anyone else a 10:00 appointment drew at 3 AM under text that
// said 10:00. Tokyo is used because no machine running this is likely to be
// there, so reverting to the viewer's clock turns these red wherever they run.

import { describe, expect, it } from 'vitest';

import { placeEvents, windowForEvents } from './calendar-grid';
import { inRange, zoned } from './calendar-zone';

/** 10:00 to 11:00 in Tokyo on 7 August 2026 (01:00 to 02:00 UTC). */
const TOKYO_TEN = {
  startAt: '2026-08-07T01:00:00.000Z',
  endAt: '2026-08-07T02:00:00.000Z',
  timezone: 'Asia/Tokyo',
};

describe('zoned', () => {
  it('reads the day and minute on the named clock', () => {
    expect(zoned(TOKYO_TEN.startAt, 'Asia/Tokyo')).toEqual({ dayKey: '2026-08-07', minutes: 600 });
  });

  it('knows midnight is the start of a day, not minute 1440', () => {
    expect(zoned('2026-08-06T15:00:00.000Z', 'Asia/Tokyo')).toEqual({
      dayKey: '2026-08-07',
      minutes: 0,
    });
  });
});

describe('placing a block', () => {
  it('puts a 10:00 booking at 10:00 whatever the viewer clock says', () => {
    const window = windowForEvents([TOKYO_TEN]);
    expect(window.startMin).toBe(8 * 60);
    const [placed] = placeEvents([TOKYO_TEN], window);
    // Two hours below an 8:00 top: eight slots of 16px.
    expect(placed?.placement.topClass).toBe('top-[128px]');
    expect(placed?.placement.slots).toBe(4);
  });

  it('files it under its own day', () => {
    const day = (d: number) => ({
      from: new Date(2026, 7, d).toISOString(),
      to: new Date(2026, 7, d + 1).toISOString(),
    });
    expect(inRange([TOKYO_TEN], day(7))).toHaveLength(1);
    expect(inRange([TOKYO_TEN], day(6))).toHaveLength(0);
  });
});
