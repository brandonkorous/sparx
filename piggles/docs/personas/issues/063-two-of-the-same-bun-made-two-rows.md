# 063 — Two of the same bun made two rows

**Status:** fixed
**Severity:** minor (the totals were right; the cart looked like it had lost count)
**Found by:** P01 · Thistle & Rye · act 8's outstanding 390px pass
**Surface:** the tenant's live site — the cart
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · the same cart — see **Confirmed by**

## What happened

Added a Butter croissant. Kept browsing. Added another. The cart:

> **Your cart (2)**
> Butter croissant · − 1 + · $4.00
> Butter croissant · − 1 + · $4.00
> **Subtotal $8.00**

Two rows of one, not one row of two.

## What should have happened

A second add of the same thing is more of it. Every shop a customer has ever used
merges the line.

## Why it matters

The money is right, so this is not a money bug — it is a **trust** bug. A cart that
lists the same product twice reads like a shop that lost count, and the shopper's next
move is to remove one "duplicate" and accidentally buy one bun instead of two.

## Where it lives

`wizeworks/packages/commerce/src/services/cart-service.ts` — `addItem` called
`tx.cartItem.create(...)` unconditionally. There was no lookup for an existing line at
all.

## The fix

`addItem` merges into an existing line first. **Only a line that is genuinely the same
merges**, and the exclusions are the point:

- **never a configured line** — two personalised builds are two things, even at one price;
- **never a line carrying attributes** — a gift note makes it a different line;
- **never across a different unit price** — merging over a price change would silently
  reprice what was already in the basket.

Candidates are filtered in JS rather than by a Prisma `Json` `equals`, so the rule reads
plainly and does not depend on JSON key order.

The **inventory hold** moves with it: a merged line already holds its previous quantity,
so the fix releases that and takes one hold for the new total — the same
release-then-reserve `updateItem` already does on a quantity change. A `deny`-policy
shortfall still throws and rolls the whole add back, so a merge can never hold more than
is on the shelf. The reservation id is now written unconditionally, because a merge must
also be able to CLEAR a stale one.

## Confirmed by

Emptied the cart, added Butter croissant, closed the drawer, added it again:

> **Your cart (2)** · Butter croissant · − **2** + · **$8.00**

One line. The commerce suite still passes 70/70.

## Rating effect

None — the cart is a storefront surface, not a rated console pane.
