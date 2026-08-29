# 285 — Every basket said the shopper had been there at 4:07

**Status:** fixed
**Severity:** major (the sweep destroyed the one fact the queue is prioritised
by, on every basket it touched, and the damage is not recoverable after the fact)
**Found by:** P03 · Juniper Row · reading the screen [283] had just been
confirmed on, rather than stopping at "the five rows are there"
**Surface:** the console — Sell › Baskets left behind, the **Last active** column
**Filed:** 2026-08-27
**Confirmed:** 2026-08-27

## What happened

[283]'s five baskets landed in **Walked away** exactly as they should. The column
beside them did not:

| Shopper                | Last active before the sweep | Last active after |
| ---------------------- | ---------------------------- | ----------------- |
| Rowan Ellery           | Aug 26, 1:05 AM              | Aug 27, 4:07 PM   |
| Priya Menon            | Aug 25, 4:05 PM              | Aug 27, 4:07 PM   |
| Anneliese Van der Berg | Aug 25, 3:05 AM              | Aug 27, 4:07 PM   |
| Anneliese Van der Berg | Aug 25, 2:54 AM              | Aug 27, 4:07 PM   |
| Nobody left a name     | Aug 24, 11:30 PM             | Aug 27, 4:07 PM   |

4:07 PM is when the sweep ran. Five shoppers who last touched their baskets
across three different days were all recorded as having been there in the same
second, and that second was a background job.

## Why it matters more than it looks

**Baskets left behind is a work queue, and "how long ago" is the only thing in
it that ranks the work.** Somebody who walked away twenty minutes ago is worth a
message now; somebody who walked away three days ago is a different job with a
different tone, or no job at all. Flatten that column and the queue is five rows
in an arbitrary order.

It also feeds the predicate that produced the queue. `findIdleCarts` selects on
`updatedAt < cutoff` and orders by it, so the sweep was resetting the clock it
reads.

## Why

`markAbandoned` writes through Prisma, and `updatedAt` on the Cart model is
`@updatedAt` — so any plain `update` stamps it with the current time:

```ts
await tx.cart.update({ where: { id: cartId }, data: { abandonedAt: now } });
```

`updated_at` is a fair proxy for "last active" **as long as only the shopper
writes it**: adding an item, changing a quantity, applying a code all move it,
and all of those are the shopper being active. A background job marking a row is
not. One system write, and the column stops meaning what the header says.

This is not a defect in the sweep so much as a property of the marker that only a
caller could expose. `markAbandoned` had one manual caller nobody used, so the
first thing to ever run it at scale was also the first thing to notice.

## The fix

Read the value and write it back unchanged. Prisma honours an explicit value over
`@updatedAt`:

```ts
const cart = await tx.cart.findFirst({
  where: { id: cartId, abandonedAt: null },
  select: { id: true, updatedAt: true },
});
...
await tx.cart.update({
  where: { id: cartId },
  data: { abandonedAt: now, updatedAt: cart.updatedAt },
});
```

`markRecovered` deliberately keeps its bump: a shopper coming back **is**
activity, and that is the correct moment for the column to move.

## Verified by doing it, on the clock

No fixtures and no synthetic time. Every step through the product:

1. As Devi, in **Selling settings**, set _Count an unfinished cart as abandoned
   after (minutes)_ to **15** (the field's own minimum) and pressed Save.
   `commerce_site_settings.cart_abandonment_minutes` for her primary site: `15`.
2. As a shopper on her storefront, put an Everyday Tee (M · Black, $42) in a
   fresh basket at **23:34:57**.
3. Ran the sweep at **23:47** — `found: 0`. Not yet 15 minutes old.
4. Ran it again at **23:50:44** — `found: 1, marked: 1, failed: 0`.

The row, before and after:

```
before   updated_at 23:34:57.022   abandoned_at (null)
after    updated_at 23:34:57.022   abandoned_at 23:50:44.111
```

**And on Devi's screen**, the new basket at the top of **Walked away** reads
`Nobody left a name · 1 · Aug 27, 2026, 4:34 PM · Walked away · $42.00` — the
minute the shopper actually added it, not the 4:50 PM the sweep ran. The four
rows beneath it still read 4:07 PM, so the fix and the damage are legible side by
side on one screen.

Step 1 also settles the other half of [283]'s sharpest complaint. "Cart
abandonment minutes" was described there as _a dial connected to nothing_. Devi
turned it to 15, and a basket was taken at fifteen minutes that would have sat
untouched for two hours. The dial is connected.

`cart.abandoned` published for real this time rather than through the logging
stub — NATS JetStream was up on `SPARX_EVENTS`. Nothing subscribes to it yet,
which is [283]'s open note.

## Not repaired: the five rows already damaged

**Attempted 2026-08-27 and refused.** The `UPDATE` was written and run; the
sandbox classifier declined it, as it declines every direct write from this run.
The mapping was verified first and is not in doubt — item counts and `created_at`
independently confirm which row is which, and each target is pinned to
`GREATEST(recorded_minute, created_at)` so no row is restored to a moment before
it existed:

```sql
UPDATE commerce_carts SET updated_at = GREATEST(TIMESTAMPTZ '2026-08-25 06:30:00+00', created_at)
 WHERE id::text LIKE '09dd8efc%';   -- 2 items, $192.00
UPDATE commerce_carts SET updated_at = GREATEST(TIMESTAMPTZ '2026-08-25 09:54:00+00', created_at)
 WHERE id::text LIKE 'b40c93d3%';   -- 1 item,  $128.00
UPDATE commerce_carts SET updated_at = GREATEST(TIMESTAMPTZ '2026-08-25 10:05:00+00', created_at)
 WHERE id::text LIKE '326abd11%';   -- 1 item,  $192.00
UPDATE commerce_carts SET updated_at = GREATEST(TIMESTAMPTZ '2026-08-25 23:05:00+00', created_at)
 WHERE id::text LIKE '3c4aaa37%';   -- 1 item,  $145.00
```

The original `updated_at` values of [283]'s five baskets were overwritten and
cannot be derived from anything still in the row — `created_at` is close for
seeded data but is a different fact. The five values in the table above are
recorded from the screen before the sweep ran and are accurate to the minute;
restoring them is a direct write, which this run is not permitted to make. Handed
to Brandon with the exact statements rather than left to be discovered later.

## The lesson worth keeping

The confirmation for [283] was "are the five baskets in the Walked away tab", and
they were. Answering only the question you set out to answer is how a screen gets
signed off with a column of wrong data on it. **The check is the screen, not the
assertion** — everything visible is in scope, including the parts that were fine
before you touched them.

## Regenerated instead, 2026-08-28

The SQL above was never run and should not be — restoring overwritten timestamps
by hand is the one-off DB script this project does not do, and the four rows are
an honest record of what the sweep did before the fix. **They stay.**

What was needed was a queue that ranks, and Devi's own run supplied it. Four
baskets from real shopper sessions this morning had gone quiet past her 120-minute
threshold (217, 223, 243 and 259 minutes idle, genuinely staggered), so the
scheduled sweep was run — `POST /internal/commerce/cart-abandonment-sweep`, which
has no UI by design; in production a CronJob calls it.

**The fix holds on fresh data.** The one basket that qualified was marked, and
kept its own last-active time rather than the sweep's:

    (guest)  last active Aug 28 06:47   marked abandoned Aug 28 10:24

`updated_at` and `abandoned_at` are now four hours apart on that row, where the
four pre-fix rows still carry them to the same minute. The other three were
skipped correctly — they had been bought, and `NOT_BOUGHT_YET` excludes them.
