# 195 — One order had two names, "#O-000022" and "O-000022"

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · act 13 (the other side)
**Surface:** the Gillett site › Orders, an order's page, Returns, a return's page; the
console's held-payment notices
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

Renée's Orders page and an order's own page said "#O-000022" and "Order #O-000022". The
checkout confirmation, the wholesale pages and the approval notices said "O-000022".
Returns said "Order #O-000004" and "Return from #O-000004". The console's notices about a
card hold said "Order #O-000014 was approved, but…".

A return's page also named its order in the heading and gave no way to it.

## What should have happened

Order numbers here carry their own letters ("O-", "SO-"); a "#" in front adds nothing
and makes one order read as two. And a return links to the order it came from.

## Where it lives

- `wizeworks/apps/site/app/account/(authed)/orders/page.tsx`, `orders/[orderId]/page.tsx`,
  `returns/page.tsx`, `returns/[returnId]/page.tsx`
- `wizeworks/packages/commerce/src/services/held-order-payments.ts` (two notices)

## The fix

The number is printed as it is everywhere. The Orders page row is the shared `OrderRow`
(issue 193). A return's heading reads "Return from order O-000004" with the number as a
link to the order.

Tests, red first: `wizeworks/apps/site/lib/order-number-hash.test.ts` reads the site,
`packages/commerce/src` and `packages/email/src` and fails on a "#" in front of an order
number (it listed the five lines it then cleared), and fails if the return page stops
linking to its order (red against the old page). `held-order-payments.test.ts` quoted
the old notice and now quotes the new. Site 468 and commerce 538 pass; lint clean.

## Confirmed by

P01 on screen, 2026-10-09, as Brynn: Returns "Order O-000004"; the return's page "Return
from order O-000004", and the number opened the order, headed "Order O-000004". As
Renée: the Orders page and the overview list "O-000022". The console notices are not
checked on screen (they need a card hold that fails, and no business here takes cards).

## Rating effect

—

## Found later (2026-10-11)

The second pass on screen found four more: the workbench's Dropshipping › Supplier orders
list ("#O-000024", both consoles), the workbench search's order titles (`lib/api/search.ts`,
both consoles), and the three approval notes on a customer's timeline
(`packages/b2b/src/approval.ts`: "Order #O-000023 approved by …"). All print the number as it
is now. The site's guard (`lib/order-number-hash.test.ts`) also reads `packages/b2b/src`
(red on the three notes first), and each console's `own-supplier.test.ts` guards its supplier
order screens (red first). Seen: the supplier orders list reads "O-000024"; workbench search
not re-opened after the change.
