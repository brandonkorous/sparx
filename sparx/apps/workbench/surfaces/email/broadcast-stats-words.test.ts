import { describe, expect, it } from 'vitest';
import {
  CONFIRMATION_WINDOW_MS,
  achievedTone,
  confirmationStillExpected,
  deliveredTile,
  shareOfLabel,
  engagementCell,
  anythingCameBack,
} from './broadcast-stats-words';

/**
 * THREE FIXES THAT NEVER TRAVELLED, AND ONE PROMISE WITH NO CLOCK IN IT.
 *
 * This screen exists twice, once per console, and until now only the other copy
 * had been looked at. Everything below had been found and closed there while the
 * version here went on shipping the original:
 *
 *   246  "Delivered 0" a minute after twenty-three emails went out. Nothing had
 *        failed; nothing had been CONFIRMED yet. Here the tile showed the bare
 *        zero with no sentence under it at all.
 *   251  "Opened 0" in success green. Here Opened and Clicked were hard-coded to
 *        success whatever the number was.
 *   ---  "0% of delivered" while delivered was zero. The share was computed
 *        against what went OUT and then labelled as a share of what LANDED.
 *
 * The fourth was found on the other copy and is the reason this is a file rather
 * than a paste. The sentence that replaced 246 read "Confirmations arrive over
 * the next few minutes" and had no clock in it, so it went on saying so for
 * ever. It was read on a broadcast sent twenty days earlier.
 *
 * A sentence about what happens NEXT is a contract. The contract has a deadline
 * in it now, and a deadline is a thing a test can hold you to.
 */
const SENT = '2026-08-26T09:20:07.947Z';
const sent = { accepted: 23, delivered: 0 };

describe('the Delivered tile', () => {
  it('stops promising confirmations once they are plainly not coming', () => {
    const twentyDaysLater = new Date('2026-09-15T09:20:07.947Z');
    const tile = deliveredTile(sent, SENT, twentyDaysLater);
    expect(tile.value).toBe(23);
    expect(tile.hint).not.toMatch(/next few minutes/);
    // Asserted as an absence AND as a presence. Dropping the sentence would
    // satisfy the line above while leaving a bare number.
    expect(tile.hint).toBe('These went out. Nothing has come back since to confirm they landed.');
    // Not a verdict. Two different things look like this from here, and the
    // screen cannot tell which, so it may not color it as either.
    expect(tile.tone).toBe('plain');
  });

  it('still says it while it is still true', () => {
    const aMinuteLater = new Date(Date.parse(SENT) + 60 * 1000);
    const tile = deliveredTile(sent, SENT, aMinuteLater);
    expect(tile.hint).toMatch(/next few minutes/);
    expect(tile.tone).toBe('info');
  });

  it('turns over exactly at the window, not vaguely near it', () => {
    const at = Date.parse(SENT);
    const justInside = new Date(at + CONFIRMATION_WINDOW_MS - 1);
    const justOutside = new Date(at + CONFIRMATION_WINDOW_MS);
    expect(confirmationStillExpected(SENT, justInside)).toBe(true);
    expect(confirmationStillExpected(SENT, justOutside)).toBe(false);
  });

  it('keeps the gentler sentence when the send time is missing or unreadable', () => {
    // Being vague is survivable. Announcing that the mail did not land because a
    // timestamp was absent is not.
    const now = new Date('2026-09-15T09:20:07.947Z');
    expect(confirmationStillExpected(null, now)).toBe(true);
    expect(confirmationStillExpected('not a date', now)).toBe(true);
    expect(deliveredTile(sent, null, now).hint).toMatch(/next few minutes/);
  });

  it('prefers a confirmed delivery over anything the clock says', () => {
    const long = new Date('2027-01-01T00:00:00.000Z');
    const tile = deliveredTile({ accepted: 23, delivered: 23 }, SENT, long);
    expect(tile.value).toBe(23);
    expect(tile.tone).toBe('success');
    expect(tile.hint).toBe('Confirmed by the receiving mail server');
  });

  it('says nothing has gone out when nothing has', () => {
    const tile = deliveredTile({ accepted: 0, delivered: 0 }, null, new Date());
    expect(tile.value).toBe(0);
    expect(tile.hint).toBe('Nothing has gone out yet');
    expect(tile.tone).toBe('plain');
  });
});

describe('the other tiles', () => {
  it('never paints a zero in the color of good news', () => {
    // Issue 251. "Opened 0" in success green says the opposite of the sentence
    // under it.
    expect(achievedTone(0)).toBe('plain');
    expect(achievedTone(1)).toBe('success');
  });

  it('never calls a share "of delivered" while nothing is delivered', () => {
    expect(shareOfLabel(0)).toBe('of those sent');
    expect(shareOfLabel(23)).toBe('of delivered');
  });
});

/**
 * A SHARE NOBODY MEASURED, ON THE LIST.
 *
 * "Autumn drop announcement · Sent to 23 · Opened 0% · Clicked 0%" reads as
 * twenty-three people getting her newsletter and not one opening it — a fact
 * about her writing. The truth is that her mail service has never reported an
 * open to this platform at all: measured 2026-09-16, every one of the 153
 * `email_events` rows on this platform is `accepted`, with no `delivered`,
 * `opened`, `clicked` or `bounced` among them.
 *
 * The DETAIL screen was given four honest states for exactly this in issue 531.
 * The list kept `Math.round((opened / base) * 100)` over the same numbers, so
 * the fix reached one of the two places it lives — for the third time on this
 * screen family (246, 251, 531).
 */
describe('engagementCell', () => {
  const nothingBack = {
    accepted: 23,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    complained: 0,
    unsubscribed: 0,
  };

  it('does NOT print 0% when nothing has come back at all', () => {
    const cell = engagementCell(0, nothingBack, 23);
    expect(cell.text).toBe('—');
    expect(cell.title).toContain('nothing has come back');
    expect(cell.title).toContain('not zero, it is unknown');
  });

  it('prints a real zero once the service HAS reported something', () => {
    // 23 delivered and no opens is a measurement, and an unwelcome one. It is
    // hers to see.
    const delivered = { ...nothingBack, delivered: 23 };
    const cell = engagementCell(0, delivered, 23);
    expect(cell.text).toBe('0%');
    expect(cell.title).toBe('0 of 23 delivered.');
  });

  it('counts a bounce as something coming back', () => {
    // The service reports, so a zero for opens means what it says.
    const bounced = { ...nothingBack, bounced: 2 };
    expect(engagementCell(0, bounced, 23).text).toBe('0%');
  });

  it('works the share out against what landed, when anything did', () => {
    const stats = { ...nothingBack, delivered: 20, opened: 5 };
    const cell = engagementCell(5, stats, 23);
    expect(cell.text).toBe('25%');
    expect(cell.title).toBe('5 of 20 delivered.');
  });

  it('falls back to what went out when nothing is confirmed but opens are reported', () => {
    const stats = { ...nothingBack, opened: 6 };
    const cell = engagementCell(6, stats, 23);
    expect(cell.text).toBe('26%');
    expect(cell.title).toBe('6 of 23 sent.');
  });

  it('says nothing has gone out yet rather than dividing by zero', () => {
    const none = { ...nothingBack, accepted: 0 };
    const cell = engagementCell(0, none, 0);
    expect(cell.text).toBe('—');
    expect(cell.title).toBe('Nothing has gone out yet.');
  });
});

describe('anythingCameBack', () => {
  const none = {
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    complained: 0,
    unsubscribed: 0,
  };

  it('is false when the service has reported nothing', () => {
    expect(anythingCameBack(none)).toBe(false);
  });

  it('counts every kind of report, not just the welcome ones', () => {
    // An unsubscribe is somebody acting on the mail, so the pipe works.
    for (const key of Object.keys(none)) {
      expect(anythingCameBack({ ...none, [key]: 1 })).toBe(true);
    }
  });
});
