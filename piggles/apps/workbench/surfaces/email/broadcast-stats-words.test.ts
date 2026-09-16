import { describe, expect, it } from 'vitest';
import {
  CONFIRMATION_WINDOW_MS,
  achievedTone,
  confirmationStillExpected,
  deliveredTile,
  shareOfLabel,
} from './broadcast-stats-words';

/**
 * A PROMISE WITH NO CLOCK IN IT.
 *
 * "Delivered 0" a minute after a send was issue 246: nothing had failed, nothing
 * had been CONFIRMED yet. The fix put a sentence under the number —
 *
 *     23   On their way. Confirmations arrive over the next few minutes.
 *
 * — and that sentence had no clock in it, so it went on saying so for ever. On
 * 2026-09-15 Devi opened her autumn newsletter, sent 2026-08-26, and read it
 * twenty days late. The confirmations were not arriving over the next few
 * minutes. They were never arriving.
 *
 * A sentence about what happens NEXT is a contract. This file is here because
 * the contract has a deadline in it now, and a deadline is a thing a test can
 * hold you to.
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
    // satisfy the line above while leaving her with a bare number.
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
    // Being vague is survivable. Announcing that her mail did not land because a
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
