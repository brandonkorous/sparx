# 036 — Her shop told every visitor there was nothing to buy

**Status:** the SIGNAL is built and confirmed. The rebuild it triggers cannot
finish in this dev stack — see **Where it stops**
**Severity:** blocker (a shop with ten products, selling nothing, silently)
**Found by:** P01 · Thistle & Rye · act 8 — trying to buy two sourdough
**Surface:** the tenant's live `/shop`, and mypiggles › Sell › Products
**Filed:** 2026-08-20
**Fixed:** 2026-08-20 (the signal)
**Confirmed by:** P01 · act 8, on both screens

## What happened

Her site is live. Opening the shop as a customer:

> **All products** · 0 products
> 🔍 **No products found**
> Try adjusting your filters or search.

No filter was set. In the console, at the same moment, Sell › Products listed all
ten with their prices and nine of them **On sale**.

## Why it matters

Two screens, two answers, and the wrong one is the one customers see. Nothing
errored; nothing was red; the shop looked like a shop that simply had no stock.
Marisol had no way to learn her shop was empty to the world — she would have
found out from the silence.

And the sentence is a lie of a specific kind: **"No products found" is a
measurement.** It says we looked and there were none. What actually happened is
that the thing we looked in was empty.

## Why it happened

The public listing does not read the products table. It reads the SEARCH INDEX:

```ts
const result = await searchProducts(site.slug, filters); // → /v1/public/commerce/search
```

`/v1/public/commerce/search` answered `success: true, total: 0`. Typesense was up
and healthy — the collection simply had none of her products in it. The catalog
had never been indexed.

`searchProducts` already knows this can happen, and says so in a comment:

> A search-backend hiccup — Typesense unavailable, or a tenant whose catalog is
> not indexed yet — must NOT 500 the whole page. Degrade to an empty result so the
> search shell renders with a "no results" state.

Degrading is right. Degrading **silently, to a sentence that asserts the opposite**
is the defect.

## What was built

**The owner is told, where their products are.** Sell › Products now leads with a
warning when the business has products on sale and the search index holds none:

> **Customers can't find these on your site**
> Your shop page looks up products in a search list, and yours is empty — so
> anyone visiting is told there is nothing to buy. Everything here is safe; it
> just needs putting back into that list. **[Put them back]**

Reads `/v1/search/status` (which existed, and nothing in either console surfaced)
and posts `/v1/search/reindex` (same). Deliberately narrow:

- **Only "none at all" is reported.** A count that merely disagrees could be a
  worker seconds behind, and crying wolf trains people to ignore the one message
  that matters.
- **A failed check is `null`, never `0`.** If the status call cannot run, nothing
  is claimed either way.
- **No time estimate in the toast.** This screen cannot see whether the rebuild
  started, so promising "a minute or two" would be inventing a fact. The warning
  itself is the status: it goes when the products are findable.

## Where it stops

**The rebuild cannot complete in this dev stack, and that is the environment, not
the product.** `/v1/search/reindex` publishes `search.reindex.requested` for the
worker fleet to consume. Nothing is listening here — no broker on 4222/8222, no
event-worker process — so the event is dropped and the index stays empty.

Worth noting on its own, though: `publish()` logs and swallows a broker failure by
design (right — the caller's transaction already committed), and the route returns
**202 accepted** regardless. So the API cheerfully accepts work it has no way to
start. That is defensible for a fire-and-forget event and indefensible for one a
person is waiting on, and it is why the copy above refuses to promise anything.

**Act 8 is blocked here.** Buying two sourdough needs products in the index, which
needs the event worker running. Everything up to the shop page is confirmed.

## Confirmed by

As Marisol, 2026-08-20, on the screen: the shop said "No products found" with ten
products on sale; the Products list now says "Customers can't find these on your
site"; "Put them back" was pressed and reported honestly. The index stayed empty,
which is the environment above.

## Rating effect

`commerce.products` not scored. **`commerce.shop` cannot be scored yet.**
