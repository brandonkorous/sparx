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

// A PROMISE WITH NO CLOCK IN IT. The fix for issue 246 said "Confirmations arrive over the next few
// minutes" for ever; Devi read it twenty days after a send. A sentence about what happens NEXT is a
// contract, and it has a deadline now that a test can hold it to.
const SENT = '2026-08-26T09:20:07.947Z';
const sent = { accepted: 23, delivered: 0 };

describe('the title on the first tile (issue 270)', () => {
  // "Delivered 6" over "Nothing has come back since to confirm they landed": the
  // title said delivered while nothing had confirmed it.
  it('says Sent until a delivery is confirmed', () => {
    const later = new Date('2026-09-15T09:20:07.947Z');
    expect(deliveredTile({ accepted: 6, delivered: 0 }, SENT, later).label).toBe('Sent');
    expect(deliveredTile({ accepted: 0, delivered: 0 }, null, later).label).toBe('Sent');
  });

  it('says Delivered once the receiving server confirms it', () => {
    expect(deliveredTile({ accepted: 6, delivered: 4 }, SENT).label).toBe('Delivered');
  });
});

describe('the Delivered tile over time', () => {
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
});

describe('the Delivered tile at the window', () => {
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
});

describe('the Delivered tile at either end', () => {
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

// A SHARE NOBODY MEASURED, ON THE LIST. "Opened 0%" reads as a fact about her writing when her mail
// service has never reported an open (2026-09-16: all 153 email_events rows were `accepted`). Issue 531
// fixed only the detail screen: the third time on this screen family (246, 251, 531).
const NOTHING_BACK = {
  accepted: 23,
  delivered: 0,
  opened: 0,
  clicked: 0,
  bounced: 0,
  complained: 0,
  unsubscribed: 0,
};

describe('engagementCell', () => {
  const nothingBack = NOTHING_BACK;

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
