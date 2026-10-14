# 183 — A core on an unpaid invoice said "Give back $150.00"

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 13 (a core comes back on an account order)
**Surface:** Workbench › Commerce › Cores owed (and an order's core line) › Core came back
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

Wasatch Front Utility Contractors buys on account. O-000007 (one Bosch injector, $150.00
core deposit) sits on invoice INV-000001, $678.00, unpaid. Renée's old injector came back.
Doty opened "Core came back". The dialog said:

- "A usable core gets its $150.00 deposit back. If this order has an invoice still open,
  the deposit comes off that invoice first."
- "Deposit already paid goes: Back the way they paid"
- a red button, "Give back $150.00"

Wasatch never paid that deposit. It is on the unpaid invoice. The click did the right
thing: INV-000001 went from $678.00 to $528.00, and the toast said "$150.00 taken off
invoice INV-000001." But before the click, the screen told Doty to give Renée $150.00.

The list above it said the same: "If every deposit came back, you would give back
$2,050.00", when $1,900.00 of that sits on unpaid invoices for O-000008, O-000012,
O-000018 and O-000020 and none of it would be handed back.

## What should have happened

The dialog names the invoice before the click: "$150.00 comes off invoice INV-000001
($678.00 still to pay)", with a button that says that. "Give back" only for money that
was paid. The list says how much comes off invoices and how much goes back.

## How to reproduce

1. An account order with a core charge and an open invoice.
2. Commerce › Cores owed › Core came back. Every time.

## Why it matters

Wrong money: a counter that reads "Give back $150.00" hands over cash the customer never
paid, and the invoice is credited as well.

## Where it lives

- `wizeworks/packages/commerce/src/services/core-service.ts`: `receiveCores` finds the
  open invoice and takes the deposit off it first; `listOwed` sends the screen nothing
  about the invoice.
- `sparx/apps/workbench/surfaces/commerce/order-cores.tsx` `ReceiveCoresModal`, and
  `core-line-words.ts` `coresSummary`, `depositBackText`.
- Piggles: `order-cores-receive.tsx` has the same sentence.

## The fix

One lookup and one rule, read by the refund and by every screen that talks about it.

- `wizeworks/packages/commerce-schemas/src/cores.ts`: `splitCoreDeposit(deposit,
  invoiceBalance)`, off the invoice first and only the rest back. `receiveCores` uses it.
- `wizeworks/packages/commerce/src/services/core-service.ts`: `openInvoicesByOrder`, the
  newest invoice still owed per order, is the one lookup behind the refund, the list
  (`CoreOwed.openInvoice`) and a new read, `openInvoiceForLine`
  (`GET /v1/commerce/order-items/:id/cores/open-invoice`).
- Workbench, both consoles: `core-line-words.ts` `receiveCoreWords` words the dialog from
  the open invoice: "takes its $150.00 deposit off invoice INV-000003, which still has
  $4,075.60 to pay. No money goes back", button "Take $900.00 off INV-000003" in the
  module color, no "where to" question. Money that really goes back still reads "Give
  back" in red. The dialog waits for the invoice before it offers a button. The list's
  Deposit cell says "$900.00 off INV-000003", and the header splits "would come off open
  invoices" from "you would give back", sharing one invoice across an order's lines.

Tests, each red first: `cores-deposit-split.test.ts` (schemas), `core-service.test.ts`
(29), `core-line-words.test.ts` in each console. Commerce 521+, schemas 619, sparx
commerce 460, Piggles commerce 496. Lint and format clean; `check:routes` passes.

## Confirmed by

P01 on screen, 2026-10-09. Before the fix, Doty recorded O-000007's core: INV-000001 went
$678.00 → $528.00 and no refund was written, which was right; only the words were wrong.
After it: Cores owed read "13 cores owed on 6 order lines. If every deposit came back,
$1,600.00 would come off open invoices and you would give back $300.00", with "$900.00
off INV-000003", "$400.00 off INV-000009" and "$300.00 off INV-000015" in the Deposit
column. On O-000008's own page, "Core came back" read "A usable core takes its $150.00
deposit off invoice INV-000003, which still has $4,075.60 to pay. No money goes back",
button "Take $900.00 off INV-000003". Cancelled: the parts have not gone out yet.

Not checked: a split (part off the invoice, part back) on screen; covered by the tests.
Piggles screens not opened; their tests pass.

## Rating effect

—
