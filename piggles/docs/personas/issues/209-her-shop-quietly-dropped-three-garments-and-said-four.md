# 209 — Her shop quietly dropped three garments and said "4 products"

**Status:** fixed and confirmed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 5
**Surface:** the tenant's website — Shop, every collection page, every category page
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 5, on screen, and re-checked on P01

## What happened

Devi put her last four garments on sale, so all seven were out. Her shop:

```
Shop
Everything we currently have available.

4 products
Silk twill scarf $58.00 · Leather-covered belt $72.00 ·
The Everyday Tee $42.00 · Sunday Trouser, wide leg $110.00
```

Four. The three missing ones are **Marlow Knit, The Ash Overshirt and Linen
Shirtdress** — her most expensive pieces, both of the new-season garments, and
the entire contents of the **New in** group she had just built the shop around.

The page did not look broken. It had a filter sidebar with size and color counts,
a sort control, and a count that agreed with what was on it.

The two endpoints behind it:

```
/v1/public/commerce/search    → 4   Scarf, Belt, Tee, Trouser
/v1/public/commerce/products  → 7   …plus Marlow Knit, Ash Overshirt, Shirtdress
```

## What should have happened

The shop shows all seven.

## Why it matters

**This is the same failure as [203](203-her-shop-page-said-she-had-nothing-to-sell.md)
and it is worse.** A blank shop is obviously broken: the owner sees it, panics,
and files a report within the hour. A shop showing four of seven garments looks
completely finished. Nobody ever looks for the other three, because nothing on
the page suggests they exist.

The loss is not proportional either. What went missing was not a random four
sevenths — it was **whatever had not been touched most recently**, which in a real
shop is the settled, established range: the things that sell. Her two newest
pieces at $128 and $145 were invisible while a $58 scarf was on the front page.

And "4 products" is a measurement of the index presented as a fact about the
business. Same rule as [175](175-372-garments-arrived-and-the-count-was-worth-nothing.md),
[203] and [208]: a number nobody could verify rendered as one that had been.

## How it got here, honestly

**[203]'s fix caused this to become findable, and did not cover it.** That fix
gave listings a database fallback, guarded on the index returning ZERO:

```ts
if (data.length === 0) return catalogFallback(tenantSlug, filters);
```

Which is right for a dead index and blind to a **late** one. The moment the index
holds one document the guard stops firing, and a catalog that is 4/7 indexed
renders as a catalog of 4.

Locally the four had just been written by a bulk status change; the older three
had never been indexed at all. In production the same window opens after every
bulk import, every restore, every re-index, and every outage — the recovery is
gradual, so the shop passes through "partly there, looks fine" on its way back.
That window is the dangerous one and it was the one left open.

The lesson is the one this project keeps relearning in new clothes: **a fix that
guards the total failure has usually not guarded the partial one, and the partial
one is the one that ships.** Zero was easy to see because zero is loud.

## The fix

**A listing with nothing typed into it is a BROWSE, and Postgres is what a
business sells.**

`/shop`, a collection page and a category page all ask the same question: show me
everything. The database answers that exactly. The index is a derived copy that
can only be identical or behind, and it buys nothing on a browse — there is no
typing to be tolerant of and no relevance to rank. So it no longer decides the
set:

- **Browse** (no search words): the catalog decides which products and how many.
- **Search** (words typed): the index decides, as before — that is what it is for,
  and a short answer to a search is not evidence of anything wrong.
- Filters the catalog cannot express — product options, fitment models, fitment
  engines — still go to the index, because a wrong set is worse than a slow one.

Facets ride along **only when the index is provably in step**:

```ts
// The counts come from the index, so they are only true when the index holds
// the same catalog. A sidebar reading "Size S: 2" over a shop of seven is a
// wrong measurement, and empty is the honest version of it.
facets: indexed && indexed.total === listed.total ? indexed.facets : {};
```

Both requests run concurrently, so a browse page costs the same wall-clock as
before.

## What it looked like once fixed

```
Shop
7 products
The Everyday Tee $42.00 · Silk twill scarf $58.00 · Leather-covered belt $72.00 ·
Marlow Knit $96.00 · Sunday Trouser $110.00 · The Ash Overshirt $128.00 ·
Linen Shirtdress $145.00
```

All seven, at every price she sells at.

## The neighbour check

Shared spine, so per RULE #7 an earlier business was reopened: **Thistle & Rye**
(P01) still lists its full 9 products.

## Rating effect

None. [rating.md](../rating.md) rates CONSOLE panes and the storefront has no row in
it, so a shop that renders four-sevenths of a catalog costs nothing there. That is
a gap in the scoring, not a small one: personas RULE #8 makes the website the
deliverable, and the deliverable is the one surface the rating file cannot see.
Recorded in the run log of [03-juniper-row.md](../03-juniper-row.md) instead.
