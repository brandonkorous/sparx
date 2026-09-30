// Nothing is still due on an order that was called off (issue 884).
//
// `outstandingUnits` read ordered-minus-received and nothing else, so a
// CANCELLED purchase order reported its whole quantity as outstanding for ever.
// On the development database PO-000003 sat in the list as:
//
//     PO-000003   Ashcombe Mills   $288.00   Still due 12   Canceled
//
// and the supplier's own pane and the order's header agreed with it. The number
// a buyer uses to decide who to chase was loudest about the one order nobody
// should chase.
//
// The server never had this wrong. `reorder.ts` and `planning-reports.ts` both
// count stock on its way with `po.status IN ('draft','submitted','partial')`,
// so the console was doing its own arithmetic and reaching a different answer
// on the same screen the planner's suggestion appears on.
//
// These cases are the full state list on purpose. A fix that special-cased
// `cancelled` alone would leave `closed` — an order somebody finished short and
// wrote off — still reporting the shortfall as due.

import { describe, expect, it } from 'vitest';
import { outstandingUnits } from './purchase-orders-data';

const po = (status: string, ordered: number, received: number) => ({
  status,
  quantityOrdered: ordered,
  quantityReceived: received,
});

describe('outstandingUnits - what is genuinely still coming', () => {
  it('counts what has not arrived on an order that was placed', () => {
    expect(outstandingUnits(po('submitted', 24, 0))).toBe(24);
    expect(outstandingUnits(po('partial', 24, 10))).toBe(14);
  });

  it('counts a draft, because the planner does', () => {
    // Broader than "can goods be booked against it". A draft cannot receive
    // anything yet, but it is stock the business has decided to bring in and
    // `reorder.ts` includes it — the two must agree or the suggestion and the
    // screen above it describe different worlds.
    expect(outstandingUnits(po('draft', 12, 0))).toBe(12);
  });

  it('says nothing is due on an order that was called off', () => {
    // THE DEFECT. 12 ordered, none received, and none ever will be.
    expect(outstandingUnits(po('cancelled', 12, 0))).toBe(0);
  });

  it('says nothing is due on an order that was closed short', () => {
    // Closed means somebody decided the rest is not coming. The shortfall is a
    // fact about the past, not a chase.
    expect(outstandingUnits(po('closed', 40, 30))).toBe(0);
  });

  it('says nothing is due on an order that fully arrived', () => {
    expect(outstandingUnits(po('received', 40, 40))).toBe(0);
  });

  it('never reports a negative when more arrived than was ordered', () => {
    // An over-delivery is a real thing and it is not negative debt.
    expect(outstandingUnits(po('partial', 10, 12))).toBe(0);
  });

  it('treats a state it does not recognize as nothing to chase', () => {
    // Fail closed. A status added later that nobody taught this function about
    // must not start claiming units are on their way.
    expect(outstandingUnits(po('some_future_state', 99, 0))).toBe(0);
  });
});
