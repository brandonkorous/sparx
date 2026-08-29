# 289 — Every sale she made was counted as a basket she had won back

**Status:** fixed
**Severity:** major (a shipped report's headline number counts the wrong thing,
and a console tab shows five completed orders as recovered baskets)
**Found by:** P03 · Juniper Row · settling the `recovered_at` question [284] left
open, which turned out to be a smaller question inside this one
**Surface:** the console — Sell › Baskets left behind › **Came back**, and the
abandonment + recovery report behind it
**Filed:** 2026-08-27
**Confirmed:** 2026-08-27

## What happened

[284] left one thing open: `findIdleCarts` filters `recoveredAt: null`, so a
basket that came back once can never be flagged again. Settling it meant deciding
what `recovered_at` MEANS — and the answer turned out to be that it already means
two different things, and the wrong one is winning.

**`checkout-service.ts` stamps `recoveredAt` when a basket becomes an order.**

```ts
// Freeze the cart by stamping recoveredAt — future addItem calls
// against it will still work but the storefront should redirect to
// the order confirmation page instead.
await tx.cart.update({ where: { id: cart.id }, data: { recoveredAt: new Date() } });
```

So every completed checkout is filed as a recovered abandoned basket.

## Proved on her own data, matched to the second

Her six **Came back** rows against her eight orders:

| Basket     | `recovered_at`     | Order      | placed             | What it really is |
| ---------- | ------------------ | ---------- | ------------------ | ----------------- |
| `6994f436` | Aug 25 04:43:41.65 | O-000002   | Aug 25 04:43:41.51 | a sale            |
| `9200222a` | Aug 25 04:59:52.02 | O-000003   | Aug 25 04:59:51.95 | a sale            |
| `17f3915a` | Aug 25 22:55:20.43 | O-000004   | Aug 25 22:55:20.30 | a sale            |
| `e114c058` | Aug 25 23:04:51.24 | O-000005   | Aug 25 23:04:51.15 | a sale            |
| `d51548af` | Aug 26 07:39:44.58 | O-000006   | Aug 26 07:39:44.48 | a sale            |
| `366d785f` | Aug 27 23:30:45.21 | — no order | —                  | **a recovery**    |

Five of the six are storefront checkouts, stamped within a tenth of a second of
the order they became. **One** is a real recovery: the basket [284] proved a
shopper could come back to.

[284] recorded that her Came back tab held "six rows of seed data describing a
journey the product had no way to produce". That was half right and the better
half was missed: they are not seed data, they are her orders.

## What it does to the report

`reporting-service.ts` counts them:

```ts
tx.cart.aggregate({ where: { recoveredAt: { gte: from, lte: to } } });
recoveryRate: rate(recoveredCount, abandonedCount + recoveredCount);
```

Before the sweep shipped, `abandonedCount` was 0 on every tenant ([283]). So the
recovery rate read **100%** — five recoveries, none abandoned — on a shop where
nobody had ever recovered anything. Now that abandonment works, the number is
still wrong, just less obviously: every sale inflates the numerator of a rate
that is supposed to measure follow-up.

**"Never present absence as measurement" has a sibling, and this is it: never
present one fact as a different one.** A number that counts the wrong rows is
worse than a blank, because a blank invites the question.

## Why the column ended up doing two jobs

Checkout needed a way to say "this basket is finished, leave it alone", and three
readers need that fact:

| Reader                                  | Needs                                              |
| --------------------------------------- | -------------------------------------------------- |
| the abandonment sweep (`findIdleCarts`) | don't mark a basket that has already been paid for |
| the automation cart scanner             | don't email a buyer about the basket they bought   |
| `email-data.ts` `resolveCart`           | find the customer's LIVE basket                    |

`recoveredAt` was already nullable, already meant "done with", and was right
there. The automation resolver even documents the borrowing in as many words:
_"`recoveredAt: null` EXCLUDES purchased carts (checkout stamps recoveredAt on
order placement)"_. Every one of those three readers is correct about what it
needs; the report and the console tab are the ones reading the column as what it
says on the tin.

## The fix — the fact already exists, so nothing has to be added

A basket that became an order **already has a completed `CheckoutSession`**
(`step: 'completed'`, and `Cart.checkoutSessions` is a real relation with a
`(tenant_id, cart_id)` index). That is the durable record of conversion, written
by the same transaction that places the order. No column, no migration.

So:

1. **Checkout stops writing `recoveredAt`.** The session is the record.
2. Everywhere that used `recoveredAt: null` to mean "not bought yet" asks the
   real question instead: `checkoutSessions: { none: { step: 'completed' } }`.
3. `recovered_at` goes back to meaning exactly one thing: **a shopper came back
   to a basket that had gone quiet.** The report and the Came back tab then count
   what their labels say.

And [284]'s original question falls out for free: `findIdleCarts` no longer
filters on `recoveredAt`, so a basket that came back, was shopped, and went quiet
again is flagged again — which is the whole point of a follow-up queue.

## What landed

Seven files, no migration:

| File                                          | Change                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| `commerce/services/cart-service.ts`           | `NOT_BOUGHT_YET` — the one place the question is asked                          |
| `commerce/services/checkout-service.ts`       | stops writing `recoveredAt`                                                     |
| `commerce/services/cart-service.ts` (sweep)   | `findIdleCarts` + `listCartSiteScopes` ask it instead                           |
| `automation-actions/src/resolvers.ts`         | the cold-cart scanner asks it instead (inlined — no dependency on commerce)     |
| `api-rest/lib/email-data.ts`                  | "their live basket" asks it instead                                             |
| `api-rest/routes/v1/commerce/lists.ts`        | the three tabs, rewritten around what is true NOW                               |
| workbench `carts-data.ts` + `cart-detail.tsx` | `abandonedAt` decides the label; recovering is no longer a door that shuts once |

`reporting-service.ts` is **unchanged and now correct**, which is the whole point
— once only `markRecovered` writes the column, counting it counts recoveries.

The tabs are now: **Walked away** = `abandonedAt` set · **Came back** = came back
and still here · **In progress** = never left. All three exclude a basket that
has been paid for, because that is an order, not a basket.

## Confirmed on her screen

**Came back** now holds **one** row: `Rowan Ellery · 2 · Aug 27, 2026, 4:30 PM ·
Came back · $271.00`, `Showing 1–1 of 1`. Six to one, and the one left is the
only real recovery on this tenant — the basket [284] proved a shopper could come
back to. Her five sales are in none of the three tabs, which is right: a basket
that has been paid for is an order.

**In progress** reads _"Nothing here. No one is filling a cart right now."_ and
**Walked away** holds the rest, so the three tabs partition her live baskets
exactly once.

They left on the filter change alone, with **no data repair** — a paid basket is
excluded from all three tabs by the completed checkout session. The `UPDATE`
below still matters for the REPORT, which counts the column directly.

One row proves the rest of it. Rowan's basket now carries `abandoned_at`
**and** `recovered_at`, and reads:

> **Walked away**
> The shopper came back to this cart once and has left it again without paying.
> Left Aug 27, 2026, 7:17 PM. Came back Aug 27, 2026, 4:30 PM.

That is three fixes in one alert: `abandoned_at` wins the label while
`recovered_at` survives as history (this issue), the basket could be flagged a
second time at all ([284]), and **Mark recovered** is offered again rather than
being a door that shut once.

## Not repaired: the five rows already stamped

The five baskets above carry a `recovered_at` that was never a recovery. New
sales stop writing it, but the existing rows keep it, so her Came back tab and
her recovery rate stay wrong until they are cleared. They are exactly
identifiable — a `recovered_at` on a basket with a completed checkout session:

```sql
-- clear recovered_at where it was a checkout, not a shopper coming back
UPDATE commerce_carts c
   SET recovered_at = NULL
 WHERE c.recovered_at IS NOT NULL
   AND EXISTS (SELECT 1 FROM commerce_checkout_sessions s
                WHERE s.cart_id = c.id AND s.step = 'completed');
```

## Noted on the way, not filed

There is a **second abandonment clock**. `automation-actions/src/resolvers.ts`
scans for carts "cold" after a hardcoded **30 minutes**, which is not
`cart_abandonment_minutes` (default 120) and not the sweep [283] added. So a
tenant can have an automation firing at 30 minutes and a Walked away tab filling
at 120, with no screen that explains the difference.

## Regenerated instead, 2026-08-28

The SQL above was never run and should not be. **The old rows stay** as a record
of what checkout wrote before the fix, and Devi's own morning supplied clean data
to check against.

**The fix holds on fresh data.** Three baskets bought through storefront checkout
at 06:05, 06:23 and 06:41 carry a completed checkout session and **no
`recovered_at`** — so they are correctly absent from Came back, and the
abandonment sweep correctly skipped all three.

One row needed explaining and is worth writing down: `5588f9ca` (Anneliese Vogt)
was stamped `recovered_at` at **05:42 the same morning**, after the fix was
written. Everything from 06:05 on is clean, so that is a **restart boundary** —
the fix was in the tree but the running api-rest was still on the old code until
the dev stack was restarted. Not a hole in the fix, and worth remembering: a
fix's effective time is when the process picked it up, not when it was committed.
