import { describe, expect, it } from 'vitest';

import { blockedError, keptSpan, type BlockReason } from './slot-guards';
import { localWallToUtc } from './time';

// A Sacramento salon: 9:00–13:00 and 13:45–17:30, so 13:15 is the lunch break.
const TZ = 'America/Los_Angeles';
const at = (day: number, minutes: number) => localWallToUtc(2026, 9, day, minutes, TZ);
const SPAN = { start: at(2, 13 * 60 + 15), end: at(2, 13 * 60 + 45) };

const NIA_OPEN = [
  { start: at(2, 9 * 60), end: at(2, 13 * 60) },
  { start: at(2, 13 * 60 + 45), end: at(2, 17 * 60 + 30) },
];

const hours = (resourceName: string, open = NIA_OPEN): BlockReason => ({
  kind: 'hours',
  resourceName,
  timezone: TZ,
  open,
});

// The sentence IS the fix here: the same refusal used to read "that time was
// taken while you were filling this in" whether somebody had taken it, the salon
// was shut for the week, or nobody was working (issues 149, 150). Each of the
// three sends the operator somewhere different, so each is asserted whole.
describe('blockedError', () => {
  it('names the person, the time and the hours they DO work', () => {
    const err = blockedError([hours('Nia Okafor')], SPAN, TZ);
    expect(err.code).toBe('OUTSIDE_WORKING_HOURS');
    expect(err.message).toBe(
      'Nia Okafor is not working at 1:15 PM on Wed, Sep 2, 2026. The hours that day are 9:00 AM to 1:00 PM and 1:45 PM to 5:30 PM.'
    );
  });

  it('drops the clock when the person does not work that day at all', () => {
    expect(blockedError([hours('Nia Okafor', [])], SPAN, TZ).message).toBe(
      'Nia Okafor is not working on Wed, Sep 2, 2026.'
    );
  });

  it('singles nobody out when nobody was pinned', () => {
    const err = blockedError([hours('Nia Okafor'), hours('Dara Bell', [])], SPAN, TZ);
    expect(err.message).toBe('No one is working at 1:15 PM on Wed, Sep 2, 2026.');
  });

  it('says so plainly when the whole day is nobody working', () => {
    const err = blockedError([hours('Nia Okafor', []), hours('Dara Bell', [])], SPAN, TZ);
    expect(err.message).toBe('No one is working on Wed, Sep 2, 2026.');
  });

  it('names the closure and the days it runs', () => {
    const closed: BlockReason = {
      kind: 'closed',
      label: 'Salon closed, summer week',
      start: new Date(localWallToUtc(2027, 8, 1, 0, TZ)),
      // The stored end is the last instant of Aug 8, so the text must say Aug 8
      // and not the small hours of Aug 9.
      end: new Date(localWallToUtc(2027, 8, 9, 0, TZ)),
    };
    const err = blockedError([closed], SPAN, TZ);
    expect(err.code).toBe('CLOSED_FOR_DATE');
    expect(err.message).toBe(
      'Nothing can be booked then: "Salon closed, summer week" runs from Sun, Aug 1, 2027 to Sun, Aug 8, 2027.'
    );
  });

  it('falls back to "a closure" when the owner named none', () => {
    const closed: BlockReason = {
      kind: 'closed',
      label: null,
      start: new Date(localWallToUtc(2027, 8, 1, 0, TZ)),
      end: new Date(localWallToUtc(2027, 8, 9, 0, TZ)),
    };
    expect(blockedError([closed], SPAN, TZ).message).toContain('a closure runs from');
  });

  it('lets a closure outrank being off duty — it is a fact about the whole date', () => {
    const closed: BlockReason = {
      kind: 'closed',
      label: 'Bank holiday',
      start: new Date(SPAN.start),
      end: new Date(SPAN.end),
    };
    expect(blockedError([hours('Nia Okafor'), closed], SPAN, TZ).code).toBe('CLOSED_FOR_DATE');
  });

  it('reports a mixed clash as a clash, which is the closer truth and the actionable one', () => {
    const err = blockedError([{ kind: 'busy' }, hours('Dara Bell')], SPAN, TZ);
    expect(err.code).toBe('SLOT_UNAVAILABLE');
  });

  it('is a plain clash when nothing else is wrong', () => {
    expect(blockedError([{ kind: 'busy' }], SPAN, TZ).code).toBe('SLOT_UNAVAILABLE');
  });

  // The zone is the RESOURCE'S, never the machine's. Every screen test for this
  // ran on a computer set to the same zone as the salon, which is the condition
  // under which a zone bug is invisible — so the one case that could not be seen
  // by clicking is asserted here instead.
  it("reads the clock on the resource's wall, not the machine's", () => {
    const NY = 'America/New_York';
    const span = {
      start: localWallToUtc(2026, 9, 2, 13 * 60 + 15, NY),
      end: localWallToUtc(2026, 9, 2, 13 * 60 + 45, NY),
    };
    const err = blockedError(
      [
        {
          kind: 'hours',
          resourceName: 'Sam Ortiz',
          timezone: NY,
          open: [
            {
              start: localWallToUtc(2026, 9, 2, 9 * 60, NY),
              end: localWallToUtc(2026, 9, 2, 13 * 60, NY),
            },
          ],
        },
      ],
      span,
      NY
    );
    expect(err.message).toBe(
      'Sam Ortiz is not working at 1:15 PM on Wed, Sep 2, 2026. The hours that day are 9:00 AM to 1:00 PM.'
    );
  });
});

// Gillett's bays and technicians work 7:30 AM to 5:30 PM Mountain. A 60-minute oil
// change at 4:30 PM, with 15 minutes kept free after it, runs to 5:45 PM. It was
// refused as "No one is working at 4:30 PM", when everyone is; the job only ran past
// closing (sparx persona issue 229).
describe('a job that runs past the working day', () => {
  const DENVER = 'America/Denver';
  const oct14 = (minutes: number) => localWallToUtc(2026, 10, 14, minutes, DENVER);
  const DAY = [{ start: oct14(7 * 60 + 30), end: oct14(17 * 60 + 30) }];
  const bay = (resourceName: string): BlockReason => ({
    kind: 'hours',
    resourceName,
    timezone: DENVER,
    open: DAY,
  });
  /** A job from `from` for `minutes`, with time kept free before and after it. */
  const job = (from: number, minutes: number, before = 0, after = 0) => ({
    start: oct14(from - before),
    end: oct14(from + minutes + after),
    booked: { start: oct14(from), end: oct14(from + minutes) },
  });

  it('says it would run past closing, and the latest it can start', () => {
    const err = blockedError(
      [bay('Bay 1 (light duty)'), bay('Bay 2 (light duty)')],
      job(16 * 60 + 30, 60, 0, 15),
      DENVER
    );
    expect(err.code).toBe('OUTSIDE_WORKING_HOURS');
    expect(err.message).toBe(
      'At 4:30 PM on Wed, Oct 14, 2026 it would run until 5:45 PM, counting the 15 minutes kept free after it, and the working day ends at 5:30 PM. The latest it can start is 4:15 PM.'
    );
  });

  it('names the one that was picked', () => {
    expect(
      blockedError([bay('Bay 1 (light duty)')], job(16 * 60 + 30, 60, 0, 15), DENVER).message
    ).toBe(
      'At 4:30 PM on Wed, Oct 14, 2026 it would run until 5:45 PM, counting the 15 minutes kept free after it, and Bay 1 (light duty) stops working at 5:30 PM. The latest it can start is 4:15 PM.'
    );
  });

  it('says nothing about time kept free when there is none', () => {
    expect(blockedError([bay('Kirk'), bay('Tomás')], job(17 * 60, 60), DENVER).message).toBe(
      'At 5:00 PM on Wed, Oct 14, 2026 it would run until 6:00 PM, and the working day ends at 5:30 PM. The latest it can start is 4:30 PM.'
    );
  });

  it('names the time asked for, not the start of the time kept free before it', () => {
    expect(
      blockedError([bay('Kirk'), bay('Tomás')], job(7 * 60 + 30, 60, 10), DENVER).message
    ).toBe(
      'At 7:30 AM on Wed, Oct 14, 2026 it needs the 10 minutes before it kept free, from 7:20 AM, and the working day starts at 7:30 AM. The earliest it can start is 7:40 AM.'
    );
  });

  it('is still "No one is working" when nobody works at that time', () => {
    expect(
      blockedError([bay('Kirk'), bay('Tomás')], job(18 * 60 + 30, 60, 0, 15), DENVER).message
    ).toBe('No one is working at 6:30 PM on Wed, Oct 14, 2026.');
  });

  it('is what a booking for the oil change carries', () => {
    const oilChange = { durationMinutes: 60, bufferBeforeMin: 0, bufferAfterMin: 15 };
    const span = keptSpan(new Date(oct14(16 * 60 + 30)), oilChange);
    expect(span).toEqual(job(16 * 60 + 30, 60, 0, 15));
    expect(blockedError([bay('Kirk'), bay('Tomás')], span, DENVER).message).toContain(
      'The latest it can start is 4:15 PM.'
    );
  });
});
