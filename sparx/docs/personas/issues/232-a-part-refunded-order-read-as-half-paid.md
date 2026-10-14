# 232 — A part-refunded order read as if half of it was paid

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · pane ratings (Order O-000033)
**Surface:** an order's money block, both consoles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** P01, 2026-10-13, Order O-000033 in Doty's workbench
**Blocked on:** —

## What happened

Brynn O'Hara-Løvdal paid $1,587.00 for O-000033 at the counter and sent one of its two
injectors back; Doty gave her $793.50. The order's money block then read:

> Order total $1,587.00 · Paid so far **$793.50** · Given back $793.50

She paid $1,587.00. Read top to bottom, the block says she paid half and was then
given all of that back. Nothing on it is "still owed", so it also disagrees with
itself.

The order keeps what is paid net of refunds (`amountPaid`, issue 222 keeps it in step),
and the block prints that net figure under the label "Paid so far", then lists the
refund again under it.

## What should have happened

"Paid" is what came in: $1,587.00. "Given back" is $793.50. What the shop kept follows
from the two.

## How to reproduce

1. Any paid order with a refund on it (O-000033, O-000004).
2. Open it in Orders. "Paid so far" is the paid amount minus the refund.

## Why it matters

The money block is where Doty answers "did they pay, and what did we give back". On
every part-refunded order it gives the wrong first answer, the one a person reads
first and repeats to the customer.

## Where it lives

- `sparx/apps/workbench/surfaces/commerce/order-detail.tsx`: `MoneyRow label="Paid so
  far" amount={order.amountPaid}`.
- `piggles/apps/workbench/surfaces/commerce/order-detail-lines.tsx` `OrderTotals`: the
  same.
- `amountDue` in `data.ts` already reads `amountPaid` as net (`total − amountPaid −
  refundTotal`); only the label and figure of the paid row are wrong.

## The fix

The paid row shows what came in: the net paid amount plus what was given back.

- `sparx/apps/workbench/surfaces/commerce/data.ts` and
  `piggles/apps/workbench/surfaces/commerce/order-format.ts`: new `paidIn(order)`,
  beside `amountDue`, which already reads `amountPaid` as net.
- `order-detail.tsx` (sparx) and `order-detail-lines.tsx` (Piggles) print `paidIn` under
  "Paid so far".

Tests, red first: `order-paid-in.test.ts` in both consoles (4 each: the figure, an
order with no refund, nothing owed, and the pane using it; 3 red before). Lint clean.
Typecheck not run.

## Confirmed by

P01, 2026-10-13, O-000033 in the workbench: "Order total $1,587.00 · Paid so far
$1,587.00 · Given back $793.50". Not checked: a Piggles order with a refund on screen
(none in the Piggles business signed in on this browser); its test passes.

## Rating effect

—
