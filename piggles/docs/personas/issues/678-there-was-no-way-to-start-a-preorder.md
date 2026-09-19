# 678 — There was no way to start a preorder

**Status:** fixed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 241
**Surface:** mypiggles › Stock › Preorders
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03, on the screen — see below
**Blocked on:** —

## What happened

Devi opened Preorders. It was empty, and it told her where to go:

> **No preorders running**
> Open one from a product's stock screen when you want to take orders for
> something before it arrives: a production run, a seasonal line, a restock you
> have already paid for.

There is no such control on a product's stock screen. There is no such control
anywhere. The screen she was sent to has a dropdown called **When you run out of
this one** whose third option is **Take pre-orders for it** — which is the
oversell policy, a different thing, and the pane's own opening comment says so:

> The setting has been there since the beginning and meant nothing: an item with
> its policy set to "preorder" simply sold past zero and told the customer
> nothing. This screen is the difference between that and an OFFER.

The difference was unreachable.

## Why

`useOpenPreorder` — the hook that posts to
`POST /v1/inventory/variants/:variantId/preorder` — had **zero callers**:

```text
$ rg useOpenPreorder
piggles/apps/workbench/surfaces/inventory/demand-data.ts:319:export function useOpenPreorder(
sparx/apps/workbench/surfaces/inventory/demand-data.ts:319:export function useOpenPreorder(
```

The definition, twice, and nothing else. A list pane and an edit dialog were
built over a create path nobody wired a button to, so the table could only ever
be empty and the dialog could only ever edit something that could not exist.

```sql
select count(*) from inventory_preorder_windows;
--  0
```

**Zero preorder windows on the whole platform**, on a capability that is
otherwise finished end to end: the table, the unique index enforcing one live
window per item, the row lock in `consumePreorderOnTx` that stops two customers
racing for the last unit, the checkout guard, and the product-page offer with
its "date to be confirmed" wording. Everything except the way in.

[[feedback_screen_over_a_function_nobody_calls]]

## What should have happened

The pane you manage a thing from is the pane you start one from. Every other
list in Stock does it: **Send something back**, **New purchase order**,
**Moving stock** all carry a module-colored primary in the toolbar.

And an empty state that tells somebody where to go has to be right about where.
[[feedback_a_promise_in_copy_is_a_contract]]

## How to reproduce

Before the fix, every time:

1. Sign in as `p03.devi@piggles.test`, Juniper Row.
2. **Stock › Preorders.** Empty, with an instruction.
3. Follow it: **Products › any product › a version**. There is a policy
   dropdown and nothing that opens an offer.
4. There is no way to make the screen in step 2 show anything.

## Why it matters

A preorder is how a small maker funds a production run: take the orders, then
buy the cloth. It is one of the few things on this platform that changes what a
business can afford to do, rather than how tidily it records what it already
did. Juniper Row is exactly the shop it was built for.

It is also the worst kind of hole to leave, because everything around it looks
finished. The pane renders, the filter works, the empty state is written in her
words. Nothing signals that the capability has no entrance.

## Where it lives

| What                        | Where                                                            |
| --------------------------- | ---------------------------------------------------------------- |
| The pane with no way in     | `piggles\|sparx/apps/workbench/surfaces/inventory/preorders.tsx` |
| The hook nobody called      | `…/surfaces/inventory/demand-data.ts` (`useOpenPreorder`)        |
| The endpoint, already there | `wizeworks/services/api-rest/src/routes/v1/inventory/demand.ts`  |
| The service, already there  | `wizeworks/packages/inventory/src/services/preorders.ts`         |

## The fix

**A primary in the toolbar and an action in the empty state**, both saying
_Take preorders for something_, both opening the dialog that was already there.

**The dialog gained its missing half rather than a twin.** `PreorderEditor` now
takes `window: PreorderWindow | null`; null is an offer that does not exist yet.
It opens on `VariantPicker` — the same catalog search the bundle builder and the
price lists use, which shows the product name first because that is what a
person recognises — and once something is picked the form underneath is the
identical seven fields. One component, because every field is shared and
splitting it so each half stays short is how a field ends up owned by two
components that drift.

**Items that already have a live offer are left out of the list.** The database
allows one per item, so offering a second would be a choice that could never
have worked. The dialog reads the unfiltered list for this, so it is right even
when the pane behind it is filtered to Finished.

**The empty state says what a preorder is instead of where to go:**

> A preorder takes orders for something before it arrives: a production run, a
> seasonal line, a restock you have already paid for. You choose the item, how
> long the offer stays open, how many you are willing to owe, and what your
> product page says about when it ships.

**The toast says the true thing.** The first draft said "your product page
offers it now", which is wrong: the shop shows the preorder line INSTEAD of "Out
of stock", so an item with stock left goes on selling the ordinary way. It now
reads:

> **The Everyday Tee is taking preorders**
> Your product page offers it the moment this one runs out, with the date and
> the words you gave it.

and, for a window with a future opening date, "Nothing changes on your product
page until the opening date."

## Confirmed by

> **Stock › Preorders › Take preorders for something.** Searched her catalog,
> picked **Linen Shirtdress · L · Chalk**, typed a ship date of 10 March 2027, a
> note reading "Cut and sewn in the spring run, posted the week it comes off the
> table", turned the limit on and set it to 20.
>
> The row came back: **Linen Shirtdress / L / Chalk · LINEN-SHIRTD-L-CHALK /
> Cut and sewn in the spring run… — March 10, 2027 — 0 · 20 left — Now →
> open-ended — Taking orders**, and the toolbar read "1 preorder taking orders ·
> 0 units committed".
>
> A second one opened the same way on **The Everyday Tee · L · Clay**, so the
> list is now two rows. The service also flipped that variant's policy from
> `deny` to `preorder` by itself, which is what its comment says it does.

## Gap to 10

The picker is scoped to the site the pane is open on, which is right, but there
is no sign of it: searching for a product that lives on another of her seven
sites reads "No product matches", which looks like the product is missing rather
than elsewhere.

There is still no way to reach this pane FROM a product. Somebody looking at the
Linen Shirtdress and thinking "I should take orders for the spring run" has to
know the Preorders screen exists.

## Rating effect

Recorded in [rating.md](../rating.md) on the new `inventory.preorders` row.
