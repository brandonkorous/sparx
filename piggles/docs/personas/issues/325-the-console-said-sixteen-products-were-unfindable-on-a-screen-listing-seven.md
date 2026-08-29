# 325 — The console said sixteen of her products could not be found, on a screen listing seven

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · finishing act 1 — removing the sample catalogue
**Surface:** mypiggles › Sell › Products
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** the count now reads 7 over a list of 7, and Refresh reaches the query it never used to

## What happened

Act 1 says Devi removes the apparel pack's sample catalogue, because "hers is
arriving and two catalogues in one shop is a mess she would not tolerate". It
was recorded done and was not: **nine products branded `Kestrel`** were still on
sale on her site, including a second **The Everyday Tee** at $45.00 sitting
beside her own at $42.00.

Removing them worked exactly as it should. Nine chosen, a confirmation that
names the count and what survives, and the list came back **Showing 1–7 of 7** —
her seven products, nothing else.

The banner above that list still said:

> **Searching your shop won't find 16 of your products**
> They are on your site and people can buy them. What isn't working is the search
> box and the filters beside your shop — those look things up in a separate list,
> and these are not in it, so a customer searching for one by name is told you
> don't have it.

Sixteen, over a list that says seven. I pressed the pane's **Refresh**, watched
it report _updated 1 second ago_, and the number did not move. I pressed it again
several minutes later. Still sixteen.

## What should have happened

A count of her products stops being true the moment she deletes nine of them. It
should either say the new number or say nothing — and **Refresh** should be the
control that settles it, because that is what the word means.

## How to reproduce

Every time.

1. Open **Sell › Products** on a shop whose products are not in the search index,
   so the banner appears with a count.
2. Select some products and **Delete** them.
3. The list updates to the new total. The banner keeps the old count.
4. Press **Refresh**. It reports it updated. The banner still keeps the old count.

## Why it matters

**The number was chosen precisely so she could check it, and now it is the part
that is wrong.** The component says so itself: _"The NUMBER is in the heading,
because 'some of your products' is the sentence she cannot act on. Four is
checkable against a catalog she knows; 'some' is a shrug."_ That reasoning is
right, and it is exactly why a stale number costs more here than a vague word
would — she is invited to check it against a catalog, and it fails the check.

**It teaches her that Refresh does not refresh.** She pressed the control, it
told her it had updated, and the thing she was looking at did not change. After
that, the honest response to anything odd on this screen is to distrust the whole
pane rather than that one line.

**It is small only because the warning underneath it is still true.** Her index
genuinely holds **zero** of her products — checked directly against Typesense —
so the advice is sound and only the arithmetic is wrong. Had the delete gone the
other way, the same staleness would have left a warning standing over a shop that
was already fixed, which is the same defect being reassuring instead of alarming.

## Where it lives

The count comes from its own query, and nothing about a catalog write touches it.

[products-data.ts:3008](../../../../piggles/apps/workbench/surfaces/commerce/products-data.ts):

```ts
export function useSearchStatus() {
  return useQuery({
    queryKey: ['search', 'status'],
    ...
    staleTime: 60_000,
  });
}
```

[products-list.tsx:102](../../../../piggles/apps/workbench/surfaces/commerce/products-list.tsx)
reads it, and the pane's Refresh calls `refetch()` — which is the **products**
query's refetch, not this one.

The deeper cause is one line missing from the helper that exists to prevent
exactly this, [products-data.ts:784](../../../../piggles/apps/workbench/surfaces/commerce/products-data.ts):

```ts
/**
 * The ONE way anything in this cluster says "that changed".
 * ... Panes must not hand-roll `invalidateQueries` for product data: the
 * derived-facet coupling is exactly the part that gets forgotten.
 */
export function useInvalidateProduct() { ... }
```

It refreshes the lists, the product record and the derived facets. It does not
refresh the search status — which is **also derived from the catalog**, just
through a different service, so it is the same coupling the comment is about and
the same part that got forgotten.

`useReindexSearch` already invalidates `['search', 'status']` on success, so the
key is known to need invalidating; only the catalog-write path misses it.

## The fix

**One line in the helper whose whole job is this**, plus the control that claimed
to do it.

**1.** `useInvalidateProduct` now invalidates `['search', 'status']` alongside the
lists. "How many products searching cannot find" is derived from the catalog just
like a price or a variant count — through another service, which is the only
reason it was not already there. That is the same coupling the helper's own
comment warns about: _"the derived-facet coupling is exactly the part that gets
forgotten."_

**2.** The pane's **Refresh** refetches the notices as well as the rows. It called
`refetch()` on the products query alone, so it reported _updated 1 second ago_
over a banner it had not touched. Refresh now means everything the pane is
showing.

Both are in the pane's own cluster; nothing about the notice component or the
endpoint changed, because neither was wrong.

## Confirmed by

Driven as Devi on 2026-08-29, on the same screen.

**The count.** After the nine Kestrel products were deleted the banner read
**"Searching your shop won't find 16 of your products"** over `Showing 1-7 of 7`,
and stayed at 16 through two presses of Refresh minutes apart. It now reads
**"...won't find 7 of your products"** — which matched the truth exactly: a direct
query to Typesense returned **0** of her products indexed, so all seven were
genuinely unfindable.

**Refresh.** One press now issues `/v1/commerce/products` **and**
`/v1/search/status`. Before the fix it issued only the first, which is precisely
why the number never moved.

**The catalog write.** Retiring a product (then putting it straight back on sale)
fired a fresh `/v1/search/status` on its own — the invalidation half, which is
what makes the count right after a delete rather than only after a manual press.

**And the job it was warning about is done.** Pressing **Put them back**
rebuilt the index for real: Typesense went from 0 to **7** of her products, the
nine deleted ones absent, and the banner cleared on its own rather than being
dismissed. Her shop's filter panel gained **Size (XS–XL, 5 each)** and **Color
(Clay 2, Ink, Sand, White, Black)**, which it had never shown — for a shop whose
every product is size × color, that is the difference between a filter panel and
a price box.

## Rating effect

To be recorded against `Sell › Products` — the notice is now checkable against
the list beneath it, which is what it was written to be.
