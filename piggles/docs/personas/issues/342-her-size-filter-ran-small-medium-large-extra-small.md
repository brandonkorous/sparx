# 342 — Her size filter ran Small, Medium, Large, Extra Small

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · checking the filters actually work (issue 341)
**Surface:** the published site › each category, each collection, Shop, All products
**Filed:** 2026-08-29
**Fixed:** 2026-08-30
**Confirmed by:** her live `/category/knitwear`, whose Size filter now reads XS, S, M, L, XL

## What happened

The Size filter on her Knitwear page, read top to bottom:

```
S   1
M   1
L   1
XS  1
XL  1
```

Extra Small sits between Large and Extra Large.

## What should have happened

XS, S, M, L, XL — the order she typed them in.

## Why it mattered

**She already answered this question.** Reading her Marlow Knit back out of the API,
the option values carry her positions:

```json
{
  "name": "Size",
  "position": 0,
  "values": [
    { "value": "XS", "position": 0 },
    { "value": "S", "position": 1 },
    { "value": "M", "position": 2 },
    { "value": "L", "position": 3 },
    { "value": "XL", "position": 4 }
  ]
}
```

That is correct, it is hers, and the storefront was throwing it away. A shopper
scanning for their size in a list that is not in size order reads it twice.

Small on a shop with five sizes, and not small on a shop with fifteen.

## Where it lived

`optionGroups()` in
[browse-facets.tsx](../../../../wizeworks/apps/site/components/products/browse-facets.tsx)
regrouped the flat `option_facets` tokens ("Size:M") by their `Name:` prefix and
rendered them **in the order Typesense returned them**, which is by descending count.
With every size on one product the counts tie, so what came out was arbitrary.

The same was true of the GROUPS themselves — whether Size or Color came first was
decided by the same tie.

## Why the obvious fixes are wrong

**A size ladder in the component** is the one thing that file forbids in its own
header:

> DATA-DERIVED end to end: every group and every value comes from the tenant's own
> products via the search index's facet counts, **never a list hardcoded here**.

And it would be wrong on its own terms: option axes are tenant-defined. XS/S/M/L/XL
helps apparel and does nothing for Roast (Light/Medium/Dark), Length, or Firmness, and
it would silently reorder an axis whose author meant something else. Alphabetical is
worse than what we had: L, M, S, XL, XS.

**A second index field** carrying the order was the answer this issue originally
named, and it is the more expensive of the two. `option_facets` is the FILTER contract
(`option_facets:=[…]`) and must not change shape, so it means a new Typesense field —
a schema change plus a full reindex before a single shop sees its own order. And facet
counts only ever describe the CURRENT result page, so a shopper who has narrowed to
one product would still see a partial ladder.

**Postgres already holds the whole answer**, on rows that need no migration:
`ProductOption.position` and `ProductOptionValue.position` were both already there.

## The fix

**A public read, beside the facets** — the same shape the panel already uses for
fitment domains:

```
GET /v1/public/commerce/option-axes?tenant=<slug>[&property=<slug>]
→ [{ name: "Size", values: ["XS","S","M","L","XL"] }, { name: "Color", … }]
```

The facet COUNTS say which values exist on this page; the axes say what order the shop
put them in. Only the two together make a Size filter read correctly.

Fetched in parallel with the fitment domains in `ScopedProductBrowser`, so all four
browse surfaces get it at once and neither read waits on the other. **Site-scoped**,
for the reason the fitment index states in its own comment: a donut shop sharing a
tenant with an apparel shop must not be handed the apparel shop's size ladder.

### The merge is a topological one, and this is the part worth reading

A shop does not declare "Size" once. Each product declares its own, so the per-product
orders have to be merged into the single ladder the panel shows.

I first wrote this as a score-and-sort — each value scored by its mean declared
position — and **wrote a comment claiming the obvious alternative (lowest position)
got it wrong.** Checking that claim rather than shipping it is what found the real
answer: on the example in the comment the two rules agree, so the justification was
false. Looking for an input where they genuinely differ found one, and it broke both:

|                          | order produced      |
| ------------------------ | ------------------- |
| lowest declared position | L, XS, XL, S, M     |
| mean declared position   | XS, S, L, M, XL     |
| **what she typed**       | **XS, S, M, L, XL** |

from nothing more exotic than one item that only comes in the big sizes:

```
Sunday Trouser   L(0)  XL(1)
Marlow Knit      XS(0) S(1) M(2) L(3) XL(4)
```

**Because a position only means something inside the product that set it.** The
trouser's `L(0)` says "L is this item's smallest"; it never said anything about the
shop. Any rule that compares positions across products is comparing two scales.

What a product actually states is a **partial order** — XS before S, S before M — and
partial orders compose. Merging them is a topological sort over the union of the
precedences, the same problem as merging two histories, and it gets the case above
right: `L before XL` from the trouser adds nothing the knit had not already said, so
the knit's ladder survives whole. Ready values are taken in first-seen order, so the
result is deterministic — the route states no `orderBy`, and a ladder that changed
between two identical requests would make the panel flicker.

Two products that genuinely contradict each other (one says S before M, the other M
before S) have no correct answer. The cycle is broken by first appearance and
**everything is still emitted** — an unresolvable order must never mean a missing
filter row.

### It degrades to exactly what it replaced

`listOptionAxes` catches and returns an empty list, and a name the order does not
mention ranks at `Infinity` rather than `0` — so it sorts to the END, keeping its
count order, instead of jumping to the front. A failed axes read, or an axis added
since, leaves the panel behaving precisely as it did before. A filter in a surprising
order is a worse shop; a filter that is missing is a broken one.

## Confirmed by

**The endpoint, on her shop:**

```json
[
  { "name": "Size", "values": ["XS", "S", "M", "L", "XL"] },
  { "name": "Color", "values": ["Ink", "Sand", "White", "Black", "Clay", "Oat", …] }
]
```

**Her live `/category/knitwear`**, read out of the served HTML:

| Before                | After                     |
| --------------------- | ------------------------- |
| Size: S, M, L, XS, XL | **Size: XS, S, M, L, XL** |
|                       | Color: Oat, Moss          |

Size ahead of Color, which is also the order she declared.

`/collections/the-essentials` and `/category/tops` render no option facets at all, and
that is not a regression: `searchProducts` suppresses facet counts whenever the index
total disagrees with the catalog total, and three of her seven products are missing
from the index because the `commerce-indexer` worker is not running in this
environment. Recorded in [341]; the guard is right and the index is behind.

**Tests:** api-rest **443 across 78 files** (was 433/77), 10 of them new. The two that
carry the design decision — the big-sizes-only ladder and the order-independence of
the result — were proved RED against a naive first-seen union before green. Typecheck
clean on api-rest and `apps/site`; eslint and prettier clean on all six changed files;
`check-surface-routes` reports 341 surfaces all addressed.

## What this corrected about the issue itself

This was filed `Blocked on: scope`, saying the fix "needs a deliberate change to the
search contract or the public API, which is larger than the surface issue 341 was
fixing."

That was a claim about the code, and it did not survive being checked
([[feedback_check_the_gate_before_accepting_it]]). `option_facets` appears in five
non-test places; the public-read option needs no index change, no schema migration and
no reindex, and it came out at one route, one client function, one prop and one sort —
comparable to [341] itself. The half of the note that was right is that the INDEX
route really is that expensive; the mistake was letting the expensive option stand for
the whole question.

## Rating effect

Against the browse panes on `P03 site — Juniper Row`. Closes item (2) of that row's
browse gaps.
