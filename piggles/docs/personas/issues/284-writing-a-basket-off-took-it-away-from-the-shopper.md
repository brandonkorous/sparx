# 284 — Writing a basket off took it away from the shopper

**Status:** fixed
**Severity:** blocker (a shopper on a live storefront could not add to their
basket, apply a code, or pay; and the "Came back" tab could never fill from a
real shopper on any tenant)
**Found by:** P03 · Juniper Row · shopping her own store as a customer, to set
up an unrelated test
**Surface:** the storefront — every cart write; and the console's Baskets left
behind
**Filed:** 2026-08-27
**Confirmed:** 2026-08-27

## What happened

Ten minutes after [283] put five baskets into **Walked away**, I opened Devi's
storefront as a shopper, chose a size, and pressed **Add to cart**:

> Sorry, we couldn't add that to your cart. Please try again.

Trying again did the same thing, and always would have. The request behind it:

```
POST /api/sparx/v1/public/commerce/cart/366d785f…/items   →  404
```

That is Rowan Ellery's basket — one of the five the sweep had just marked. The
sweep did not record that she had gone quiet. **It took her basket away from
her.**

## Every door out of that basket, and which ones were locked

`abandonedAt: null` sat on seven lookups. Not on the other two.

| A shopper on that basket tries to | Went through                   | Result                     |
| --------------------------------- | ------------------------------ | -------------------------- |
| Find it again in their browser    | `getByGuestToken`              | **gone** — basket is empty |
| Add something                     | `cart.addItem`                 | **404**                    |
| Apply a discount code             | `discount.redeem`              | **404**                    |
| Apply a gift card                 | `discount.redeemGiftCard`      | **404**                    |
| Spend account credit              | `discount.spendAccountCredit`  | **404**                    |
| Sign in and keep their basket     | `handoff`                      | **dropped**                |
| **Pay for it**                    | `checkout.start`               | **404**                    |
| Change a quantity                 | `updateItem` (by `cartItemId`) | worked                     |
| Remove an item                    | `removeItem` → `updateItem`    | worked                     |
| Empty it                          | `clear` (no filter)            | worked                     |

The shopper could take things **out** of the basket and empty it, and could not
put anything in or buy any of it. That is the exact inverse of what a shop wants
from somebody who came back.

## The half that made it unrecoverable

`markRecovered` — which clears the flag, fills the **Came back** tab and drives
the recovery rate in the abandonment report — had **one caller**:

```
POST /v1/commerce/carts/:cartId/recovered      staff-only admin route
```

Nothing on the storefront. So "recovered" could only ever mean _Devi clicked
something in the console_, never _the shopper came back_. Between the two
halves, a basket that entered **Walked away** could not be shopped, could not be
paid for, and could not leave.

The six rows sitting in her **Came back** tab were seed data describing a journey
the product had no way to produce.

## Why nobody had hit it

`abandoned_at` was non-null on zero rows, on every tenant, for all time — that is
[283]. Nothing ever set the column, so none of these seven guards had ever
evaluated to anything but "not abandoned". [283] shipped the sweep, and every one
of them went live at once, on every quiet basket on the platform, every ten
minutes.

**The sweep did not cause this. It was the first thing to ever reach it.** A
guard written years ago is still a guard; a whole feature can be wrong in a way
nothing can observe until one missing piece is supplied.

## The fix — a signal, not a state

`abandoned_at` records that a basket has gone quiet **so somebody can be brought
back to it**. It is a marketing signal, and it must not touch what the shopper
can do. The basket stays live until it expires or converts.

- Every shopper-facing lookup ignores `abandonedAt`. The seven above.
- Every shopper **write** goes through `assertCartTokenForWrite`, which pairs the
  ownership check it already did with `markRecovered`. A shopper touching a
  basket the sweep had marked **is** the shopper coming back.
- The GET stays a pure read. A basket still sitting open in a browser tab is not
  somebody returning to buy it.

The pairing is deliberate. Every shopper write already went through one door, and
leaving recovery as a second call at each of the six routes is how one of them
ends up checking ownership and forgetting the recovery.

## Verified by shopping

As a customer on `localhost:3004`, after the fix:

1. **Add to cart** on the same basket the sweep had marked → the drawer opens
   holding **4 items, $271.00**: the Everyday Tee ×3 that was already in it, plus
   what was just added. The basket came back with its contents.
2. In the database, that cart: `abandoned_at` **cleared**, `recovered_at` set,
   total `27100`.
3. In Devi's console, **Walked away** drops 5 → 4, and **Came back** gains a row
   at the top: `Rowan Ellery · 2 · Aug 27, 2026, 4:30 PM · Came back · $271.00`.

That row is the first entry in that tab, on any tenant, ever produced by an actual
shopper rather than a seed or a staff click.

## Left open — settled in [289]

**Resolved 2026-08-27.** Working the decision below turned up the reason it was
hard: `recovered_at` already meant two things, because checkout stamped it to
freeze a converted basket. Five of the six rows in Devi's **Came back** tab were
her own completed orders. The column now means only "a shopper came back", the
"has this been bought" question is asked of the completed checkout session that
already records it, and `findIdleCarts` no longer filters on `recoveredAt` — so a
basket that came back and went quiet again IS flagged again. Detail, the
evidence and the data repair: [289].

The original framing is kept below, because the option it chose is the one that
shipped.

## The decision, as it stood

`findIdleCarts` also filters `recoveredAt: null`, so **a basket that came back
once can never be flagged again.** A shopper who returns, adds something and
leaves again is gone from the queue permanently.

It is not a one-line change, because `cartStateFrom` reads _recovered wins over
abandoned_, and the abandonment report counts `recovered_at` inside a window. So
"what does `recovered_at` mean" has to be settled first:

- **Current state** — re-flagging clears it. The three tabs stay exclusive, and a
  recovery inside a reporting window can be erased later, understating the
  recovery rate on a report that already ships.
- **History** — it means "came back at least once", `abandoned_at` wins in
  `cartStateFrom` because it is the current fact, and the tabs are filtered on
  that precedence instead.

The second reads correct to me and costs the report nothing, but it changes what
a shipped number means, so it is Brandon's call. Nothing is broken while it
waits: the basket stays live and usable either way, and the only cost is a
follow-up that does not get offered a second time.

## The lesson worth keeping

The guards all read as prudence. "Don't let somebody add to an abandoned cart"
is a sentence that sounds like care. It is only wrong once you ask what the
column is FOR — and the answer, written in the empty state on Devi's own screen,
is "so you can follow it up". A flag whose entire purpose is to bring somebody
back had been implemented as a flag that locks the door behind them.
