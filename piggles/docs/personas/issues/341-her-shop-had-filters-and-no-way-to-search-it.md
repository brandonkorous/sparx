# 341 — Her shop had filters and no way to search it

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · Brandon, on what the browse pages are FOR
**Surface:** the published site › Shop, All products, each collection, each category
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** searched her live shop for "scarf", "knit" and "belt" and read what came back

## What happened

Brandon, on `/products` and `/category`:

> the products page should list all products (with filters and search) and the category
> page should list all products (with filters and search) per category. that's obvious

Her browse pages list products and they filter. **None of them can be searched.** There is
no search box on `/products`, none on `/shop`, none on a collection page, none on a
category page — and none in the site header either, so the only route to search anywhere
on her site is a footer link labelled "Search".

The part that makes it a defect rather than a missing feature: **the pages already
support it.** Every one of them reads `?q=` and retitles itself _Results for "…"_ when it
is set. The query layer, the index call, the heading, the "clear and show everything"
link — all built, all working. The only thing missing was the box.

## What should have happened

A page whose whole job is browsing a catalog can be searched from that page.

## Where it lives

[browse-facets.tsx](../../../../wizeworks/apps/site/components/products/browse-facets.tsx),
one line, and it is the tell:

```tsx
{
  /* Preserve the text query + sort across filter submits. */
}
{
  values.q ? <input type="hidden" name="q" value={values.q} /> : null;
}
```

`q` existed only as a **hidden** field, whose job was to carry a search term that came
from somewhere else through a filter submit. Somewhere else being `/search`, a separate
page. So the browse surface could keep a query alive and never start one.

## The fix

One change, in the shared browser, so all four surfaces get it at once —
`ProductListing` (`/products`, `/shop`), `CollectionDetail` and `CategoryDetail` all
render the same
[ScopedProductBrowser](../../../../wizeworks/apps/site/components/products/scoped-product-browser.tsx).

**In the toolbar, not the facet panel.** The panel stacks BELOW the products on a phone,
which its own comment explains is deliberate — _"A phone that opens on a price box and a
checkbox has buried the thing the shopper came for"_. A search box in that panel would be
buried by exactly the same reasoning. So it sits above the grid on every viewport and
joins the facet form through the `form` attribute:

```tsx
<Input form={FACET_FORM_ID} type="search" name="q" defaultValue={q} … />
```

One GET form, one Apply, no duplicated filter state, still no client JS, and Enter
submits the way it does in any search box. `FACET_FORM_ID` is exported rather than
spelled twice — a literal on both sides is one rename away from a search box that
silently submits nothing.

**The placeholder is scope-aware**, following the pattern `BrowseEmpty` already uses,
because this one component is three different things:

| Surface                 | Says                         |
| ----------------------- | ---------------------------- |
| `/products`, `/shop`    | Search the shop              |
| `/collections/<handle>` | Search this collection       |
| `/category/<handle>`    | Search this part of the shop |

The form posts back to the page it is on, so a search from a category page searches THAT
category — which is what Brandon asked for, and why a single "Search products" would have
promised the whole catalog on a page that cannot deliver it.

## Confirmed by

Her live shop, searched:

| Typed   | Came back            |
| ------- | -------------------- |
| `scarf` | Silk twill scarf     |
| `knit`  | Marlow Knit          |
| `belt`  | **Linen Shirtdress** |

The heading changes to _Results for "scarf"_, and the placeholder reads correctly on all
four surfaces — checked on `/shop`, `/products`, `/collections/the-knitwear-edit` and
`/category/knitwear`.

**That third row is not a bug in this fix, and it is worth keeping.** Searching her shop
for "belt" returns the shirtdress (whose description mentions a belt tied at the waist)
and NOT her Leather-covered belt, because the belt is one of three products missing from
her search index — see the note below. The search box did not cause that; it made it
visible, which is the honest outcome.

## What this uncovered, which is NOT a defect

Her catalog holds 7 products and her search index holds 4. Three tenants nearby are
worse — harbor-pine 13/0, sable-thyme 12/0, everson-apparel 11/0.

**I nearly filed that as a missing call in the blueprint installer, and it is not.** The
installer creates products through `productService.create`, which publishes
`product.created`, which `publishCommerceEvent` follows with `search.entity.changed`. The
chain is correct. What is actually true here is that **the `commerce-indexer` worker is
not running in this dev environment** (`localhost:8083` refuses), so nothing published
since it stopped has been indexed; her four indexed products are the four I edited by
hand while it was up.

Two things follow that are worth writing down:

- **The facet panel is right to go quiet.** `searchProducts` drops the facet counts
  whenever the index total disagrees with the catalog total, with the reason stated:
  _"A sidebar reading 'Size S: 2' over a shop of seven is a wrong measurement, and empty
  is the honest version of it."_ That is why `/products` shows only Price and
  Availability while `/category/knitwear` (1 of 1, agreeing) shows Size and Color. The
  guard is correct; the index is behind.
- **`piggles/docs/personas/CLAUDE.md` is stale on this.** It says
  `SPARX_DEV_WORKER_ROUTES` is unset and to record everything downstream as not-checked.
  It IS set, and it routes `product.*`, `search.entity.changed` and
  `search.reindex.requested` to the indexer. `email.send` is genuinely not in the routed
  list, so the email half of that instruction still stands — but the blanket version of
  it is wrong.
  **Both halves are closed as of 2026-09-01.** `EVENT_BROKER=nats` is the selector now,
  not the dev-routes list, so `email.send` travels the same bus as everything else and is
  rendered to the event-worker's stdout; `personas/CLAUDE.md` has been rewritten to say
  so. See [368](368-the-sign-in-screen-said-it-had-emailed-her-a-link-and-had-not.md).

## Rating effect

Against `P03 site — Juniper Row`, and against the browse panes generally.
