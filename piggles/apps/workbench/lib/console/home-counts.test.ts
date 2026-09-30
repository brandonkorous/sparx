import { describe, expect, it } from 'vitest';
import { SOURCES } from './home-counts';

/**
 * "WHAT NEEDS YOU" SAID NOTHING NEEDED HER.
 *
 * Home leads with a short list of queues and then, when a queue is empty, says
 * so out loud in one run-on sentence. On 2026-09-15 it read:
 *
 *     What needs you
 *     1 item is sold out
 *     Everything else is fine: everything is sent, everyone has had a reply,
 *     no bookings are waiting, nothing is overdue and nothing is running low.
 *
 * She was owed $986.50 across EIGHT late invoices. The invoices list two panes
 * over said "Late $986.50 · 8 invoices · worst 1–30 days" on a band at the top
 * of it, and Finance said the same.
 *
 * The count asked `status=overdue`. That column is written when something is
 * DONE to a document, and a due date passing is nobody doing anything, so it
 * never said `overdue` at all for an ordinary shop (issue 522). An empty queue
 * is one kind of wrong; a confident "all clear" on the first screen of the
 * morning is the other kind, and it is worse, because nothing invites a second
 * look.
 *
 * This file guards the FILTERS, which is the half a type cannot check: every
 * value here is a string or a boolean handed to a query string, and any of them
 * would compile.
 */
describe('the counts on "what needs you"', () => {
  it('asks the invoice question of the clock, not of the status column', () => {
    const q = SOURCES.invoices.query as Record<string, unknown>;
    expect(q.pastDue).toBe(true);
    // Asserted as an absence too. Adding `pastDue` beside the old filter would
    // still return almost nothing, because `status` narrows first — so "it asks
    // pastDue" on its own is not enough to say the defect is gone.
    expect(q).not.toHaveProperty('status');
  });

  it('asks the chat question of the unread flag, not of the status column', () => {
    // The same mistake as the invoice one above, on the next row down. `open` is
    // a stored word meaning "not resolved", so a conversation answered an hour
    // ago counted as something waiting for a person — and the badge said 1 over
    // a thread that had already been replied to.
    const q = SOURCES.messages.query as Record<string, unknown>;
    expect(q.unread).toBe(true);
    // As an absence too: `status` narrows first, so adding `unread` beside it
    // would still have counted answered threads that happened to be open.
    expect(q).not.toHaveProperty('status');
  });

  it('asks for one row, because only the total is wanted', () => {
    // Fifty rows of JSON to display one integer, on every count, on every load.
    //
    // `limit` as well as `take`: the forms inbox spells its page size the other
    // way, and a loop that only knew one word would have gone on passing while
    // the newest count pulled a full window (issue 629).
    for (const [key, source] of Object.entries(SOURCES)) {
      const q = source.query as Record<string, unknown> | undefined;
      if (q && 'take' in q) expect(q.take, key).toBe(1);
      if (q && 'limit' in q) expect(q.limit, key).toBe(1);
    }
  });

  it('counts the people who wrote in from the website', () => {
    // Every other "somebody is waiting" channel had a count and this one did
    // not, so two people asking about sizing sat marked New for seventeen days
    // with nothing on Home, the rail or the app saying so.
    const forms = SOURCES.formReplies;
    expect(forms.query).toMatchObject({ status: 'new' });
    // It reads `counts.new`, which the endpoint answers beside every window —
    // NOT the length of the rows it happens to return, which is capped at one.
    expect(forms.read?.({ counts: { new: 2 }, submissions: [] })).toBe(2);
    // Unknown, never zero: a shape it does not recognise must not read as
    // "nobody is waiting".
    expect(forms.read?.({ submissions: [] })).toBeUndefined();
  });

  it('still counts a real queue for every other source', () => {
    // The denominator. An empty catalog would pass every loop above.
    expect(Object.keys(SOURCES).length).toBeGreaterThan(5);
    for (const [key, source] of Object.entries(SOURCES)) {
      expect(source.path, key).toMatch(/^\/v1\//);
      expect(source.module, key).not.toBe('');
    }
  });
});
