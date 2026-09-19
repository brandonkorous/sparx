# 662 — It told me to set it somewhere with nothing to set

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 234
**Surface:** Stock — Whose stock, and an item's stock screen
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 234 (a location marked as consigned, seen on both screens, and marked back)

## What she saw

**Whose stock** was empty, with a good empty state:

> **Everything on your shelves is yours**
> Nothing is marked as consignment, customer-owned, or belonging to a warehouse
> partner. **Set it on an item's stock screen** when you start holding goods you
> have not bought.

So she went to an item's stock screen. There was nothing to set. Not on the item,
not on a location card, not in "Change how this is managed", not anywhere in
either console.

A sentence that sends somebody to a place is worse than no sentence when the
place is empty: they go, they look twice, and they conclude they have
misunderstood the product. [[feedback_a_promise_in_copy_is_a_contract]]

## What was already built

Everything except the control.

| piece                                            |           |
| :----------------------------------------------- | :-------- |
| `inventory_levels.ownership` + the two owner ids | in the DB |
| `GET /v1/inventory/ownership`                    | exists    |
| `POST /v1/inventory/ownership`                   | exists    |
| `setStockOwnership`, with its own validation     | exists    |
| `useSetOwnership`, cache invalidation worked out | exists    |
| a screen calling it                              | **none**  |

`stock-ownership.ts` opens with four paragraphs on why this matters — valuing
consigned goods as inventory overstates the balance sheet by the whole
consignment, and it is the kind of overstatement that survives until an
accountant asks for the schedule. All of it correct, all of it unreachable.

Same shape as the recall in
[658](658-i-could-clear-a-recall-i-could-never-raise.md), one screen along.
[[feedback_screen_over_a_function_nobody_calls]]

## Where it lives now

**On the location card**, because ownership is a fact about (this item × this
place). Mixing owned and consigned units of the same thing in the same room has
no answer to "which one did I just sell", which is why the model refuses to
pretend — so the control refuses to sit at the top of the pane as if it were a
fact about the item.

Every card now ends with the answer in a sentence:

> Yours, so it counts toward what your stock is worth.

or, once marked:

> Not yours. It belongs to Fairfield Trims. It sells as normal and does not count
> toward what your stock is worth.

with a **Held for Fairfield Trims** badge beside the location's name, next to the
in-stock badge — because a number that belongs to somebody else is not the same
number, and the screen that says the quantity is the screen that has to say so.

Opening **Whose stock is this?** gives the four answers in the words somebody
would use out loud (Mine, a supplier's until it sells, a customer's own goods, a
warehouse partner's), the owner to name, and the consequence stated before it is
chosen:

> Stock that is not yours still sells exactly as normal, because being able to
> sell it is the whole reason to hold it. What changes is what your stock is
> WORTH: these units stop counting as money you have tied up, so your valuation
> is not overstated by somebody else's goods.

That paragraph is there because the natural assumption is the opposite one —
somebody reaching for "this is not mine" to stop something selling wants the
unsellable shelf instead, and would otherwise find out by selling it.

Consigned stock with nobody named is refused where the person is looking, with
the server's own reason: **"somebody is owed for it when it sells."**

## It rides on the level now

`ownership`, the two owner ids and the resolved `ownerName` are on every stock
level, so the screen that shows a quantity knows whose it is without a second
question. Before this the only place in the product that knew was the exception
list most people never open.

## Driven end to end

```
BRASS-BELT-1 at Fulfillment Center
  → A supplier's, until it sells · Fairfield Trims
  → badge "Held for Fairfield Trims" on the card
  → Whose stock: $3.84 across 1 line · On consignment · Fairfield Trims · 1
  → back to Mine
  → "These units count toward what your stock is worth again."
```

## The one it caught on the way past

The new badge crashed the pane: `ReferenceError: faHandshake is not defined`, on
an icon the file used and never imported. **Four separate `tsc --noEmit` runs had
reported that file clean**, because the dev server's half-written
`.next/dev/types/routes.d.ts` is a PARSE error that stops TypeScript before it
checks any source — and the output was being filtered of `.next/` lines, which
turned "checked nothing" into a blank that reads exactly like "found nothing".

`tsconfig.check.json` now sits beside each workbench's own config, excluding that
one generated file, with the whole story in its header.
[[feedback_never_present_absence_as_measurement]]

## Files

- `piggles|sparx/apps/workbench/surfaces/inventory/stock-ownership-block.tsx` (new)
- `piggles|sparx/apps/workbench/surfaces/inventory/{stock-item.tsx,data.ts}`
- `piggles|sparx/apps/workbench/tsconfig.check.json` (new)
- `wizeworks/packages/inventory/src/services/public-api.ts`
