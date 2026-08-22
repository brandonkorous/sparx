# 037 — Every product she typed in said "Sold out" on her own shop

**Status:** fixed — code, the rows already written, and the projection behind them
**Severity:** blocker (a bakery with bread on the counter, unable to sell one loaf)
**Found by:** P01 · Thistle & Rye · act 8 — the first look at the shop as a customer
**Surface:** the tenant's live `/shop`, against mypiggles › Sell › Products
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P01 · act 8, on the live shop

## What happened

With [#036](036-her-shop-told-every-visitor-there-was-nothing-to-buy.md) fixed her
nine sellable products finally appeared on `/shop`. Every single one of them wore
a black **Sold out** badge.

In the console at the same moment, all nine read **On sale**.

She has ten products. She typed them in herself. There is bread on the counter.

## Why it matters

This is worse than #036, not a smaller version of it. An empty shop at least
looks broken. A shop full of beautifully laid-out products that are all sold out
looks like a **shop that is having a bad week** — a customer forms no suspicion
at all, and neither does the owner, because her console says On sale.

She had no route to the cause. Nothing on the product screen mentioned stock,
nothing was red, and the word "Sold out" does not point anywhere. The only screen
that could have explained it is Stock, which she had never opened — and had no
reason to, because she does not run a stockroom. She counts bread in the morning.

**On Piggles it is not an edge case, it is the first day.** Piggles includes every
app in one flat price, so the inventory module is on for every business that
signs up. Every product any Piggles tenant creates was born Sold out.

## Why it happened

`commerce_products.in_stock` is a denormalized column maintained by
`syncProductInStock`, and the storefront badge comes from the matching live calc,
`computeAvailability`. Both summed the variant's `inventory_levels` rows:

```ts
const total = levels.reduce((acc, l) => acc + (l.onHand - l.allocated - l.unsellableOnHand), 0);
const inStock = total > 0 || sellableWithoutStock > 0;
```

With no rows the sum is `0`, and `inventory_policy` defaults to `deny`, so
`inStock` is `false`.

**Nothing in the product-creation path ever writes a level row.** Levels appear
only when somebody deliberately sets stock (`levels.ts`, `stock-grid.ts`) or from
a seed. So the state every product starts in — zero rows — was read as a count of
zero. Confirmed on all ten of hers:

```
 title                            | in_stock | inventory_policy | levels
 Country sourdough, whole loaf    | f        | deny             |      0
 Cardamom buns, box of six        | f        | deny             |      0
 …all ten identical
```

This is [never present absence as measurement](../../../CLAUDE.md), exactly. No
level row is **the absence of a count**, not a count of nothing, and the two were
rendering the same.

The near-miss is worth recording, because the author of `syncProductInStock` saw
this failure and guarded half of it. Its own comment says a tenant with the
inventory module OFF must be forced sellable, since defaulting them to the
column's `false` "would strand every product at Sold out on the storefront **with
no way to fix it**". That is precisely what happened — to everyone with the
module ON and no stock counted, which on Piggles is everyone.

## The fix

**One rule, in its one home.** `computeAvailability` (the file whose header calls
itself "the ONE place the untracked = always available rule lives") now treats no
level rows as untracked, the same answer it already gives a module-off tenant:

```ts
if (levels.length === 0) {
  return { available: null, inStock: true, tracked: false };
}
```

`available: null`, not `0` — so a storefront cannot print "0 left" about a number
nobody has. `syncProductInStock` takes the same branch, so the denormalized column
and the live calc cannot disagree.

The line to preserve if this is ever revisited: **a variant becomes stock-managed
by being COUNTED, not by existing.** Once one level row exists, zero means zero
and `deny` means deny. That case is unchanged and is covered by tests.

**The rows already written.** A code fix alone leaves every existing product
stranded until somebody happens to edit it, so
`20270401000000_uncounted_products_are_sellable` corrects them — scoped to
products with no level row anywhere, so a genuine counted-zero is never flipped
back to sellable, and idempotent.

**The projection behind them.** A SQL `UPDATE` raises no event, so the search
index would have gone on serving `in_stock: false` for all of them — rows right,
shop still wrong. That is the general hazard with any migration touching a
projected column, so it is a task rather than a one-off: **`reindex-search`** in
`ops.yml`, which publishes the same `search.reindex.requested` the console's own
button raises. It reports what it ASKED for, never what landed, because the
rebuild happens on a worker after the process exits.

**Tests.** `computeAvailability` had no test file at all — the single most
load-bearing rule in the inventory module, uncovered. It has eight now, and the
first is the one that would have caught this.

## Confirmed

Reloaded `/shop` as a customer: nine products, prices, no Sold out badge
anywhere. Console and shop finally agree.

## Two things found alongside it

- **`Publisher` had no `close()`.** The reindex script published correctly, printed
  its summary and then hung forever, because NATS holds an open socket and only
  Prisma was being disconnected. In a workflow that reads as "still working" until
  the job times out. `close?()` is now on the interface (optional — a server never
  calls it) and `closePublisher()` is exported from api-core.
- **An ops script does not inherit its service's env.** The first run read the
  database perfectly and published to the `log` transport, printing a full list of
  101 tenants it had asked — having asked nobody. `@wizeworks/db` loads its own env;
  `publish` resolves its transport from `process.env` at call time. The script now
  imports `dotenv/config` first.
