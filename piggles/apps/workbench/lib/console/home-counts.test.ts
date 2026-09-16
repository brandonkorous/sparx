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

  it('asks for one row, because only the total is wanted', () => {
    // Fifty rows of JSON to display one integer, on every count, on every load.
    for (const [key, source] of Object.entries(SOURCES)) {
      const q = source.query as Record<string, unknown> | undefined;
      if (q && 'take' in q) expect(q.take, key).toBe(1);
    }
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
