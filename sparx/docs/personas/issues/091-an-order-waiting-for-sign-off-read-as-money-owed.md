# 091 — An order waiting for sign-off read as money owed

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 5 (testing 088 live, with a real held order)
**Surface:** workbench › Orders › an order (both consoles); Orders list › "Still owed"
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06 (O-000017)
**Blocked on:** —

## What happened

Dana Whitcomb-Nguyen (Salt Lake County) signed up on Gillett's site and ordered two Fleece Cheetah turbos for the 6.7L Power Stroke, $4,758.30 on account, PO SLCO-FM-26-1144. It was over the county's $2,500.00 limit, and checkout told her: "This order is over Salt Lake County Public Works Department, Fleet Management Division's $2,500.00 limit, so Gillett Diesel Service approves it before it goes ahead. Nothing is sent until then." Then: "Nothing is charged or sent until then."

Doty opened O-000016 and read, under "Waiting for your team":

- a yellow box: "$4,758.30 still owed. No money has come in for this order yet."
- "Asking for payment": a **Make an invoice** button.
- "Money in": a box to write down $4,758.30 in Cash.
- and the order counted under the Orders list's **Still owed** chip.

She canceled it. The box asked "1 item worth $4,758.30" (it was 2 turbos). Afterward the Collection card read "They picked this up." above "This order has not been collected yet."

## What should have happened

An order waiting for sign-off owes nothing yet; the business has not agreed to it. Approving it raises the invoice (bill to account) or takes the held card. The page says it is waiting, offers no invoice and no payment box, and the "Still owed" list leaves it out. A canceled order nobody collected says so, without a "yet".

## How to reproduce

1. On the site as Dana (`dana.whitcomb-nguyen@slcopw.test`), put 2 × FPE-PS-FMW-63-1518 in the cart, check out, "Bill to my account", place it.
2. As Doty, open the order. Before the fix: the four things above, every time.

## Why it matters

It says something false about money. "Make an invoice" and "Write it down" are one click from billing a customer for an order the business never agreed to, which also skips the sign-off the limit exists for. The "Still owed" list mixed orders nobody owes with real debts. The count and the Collection line contradicted the order itself.

## Where it lives

- `isOwingOrder` and `OWING_ORDER_WHERE` (`@wizeworks/crm-schemas`, `crm/order-service.ts`): only canceled and refunded were "not collectable". `pending_approval` is not even in `OrderStatus`; the sign-off gate in `@wizeworks/b2b` stores it.
- `amountDue` (sparx `surfaces/commerce/data.ts`, piggles `order-format.ts`) drove the yellow box and the payment box.
- `reasonNotToAsk` (both consoles) drove "Make an invoice".
- The cancel box counted lines, not pieces. The Collection line had one past-tense sentence for every finished state.

## The fix

- `HELD_FOR_SIGN_OFF_STATUS` in `@wizeworks/crm-schemas`, one name for the stored word. `isOwingOrder`, the database query and both consoles' `amountDue` treat it as owing nothing.
- "Asking for payment" on a held order: "This order is waiting for sign-off, so there is nothing to ask for yet."
- The cancel box counts pieces: "2 items worth $4,758.30".
- `collectedWords` and `nothingHandedOverWords`: a canceled order reads "This order was canceled, so there is nothing to collect." and "Nothing was collected."; a refunded one says it was refunded before anyone collected it; "They picked this up." only when something was handed over.

Both consoles. Siblings checked: the order header badges ("Not paid", "Waiting for approval") are true as they stand; the site's own order page already said "waiting".

Tests, each proved red against the code before it:

- `crm-schemas/src/owing-order.test.ts` "an order held for sign-off": reddens 1.
- `crm/src/services/owing-order-where.test.ts`: the query agrees with `isOwingOrder` on every status and payment word; the old query reddens both.
- `surfaces/commerce/held-order-money.test.ts` in both consoles: the old `amountDue` and Collection line redden 3 of 5; the old empty line reddens 1 more.

## Confirmed by

On screen, 2026-10-06, as Dana then Doty, with a second order O-000017 (same 2 turbos, PO SLCO-FM-26-1151): the order shows only "Waiting for your team"; "Asking for payment" reads "This order is waiting for sign-off, so there is nothing to ask for yet."; "Money in" has no payment box; the Orders list's "Still owed" shows 6 orders and not O-000017; Cancel order asks "2 items worth $4,758.30"; after it, Collection reads "This order was canceled, so there is nothing to collect." and "Nothing was collected."

Piggles: same edit, type checked and tested, not opened on an order.

## Rating effect

—
