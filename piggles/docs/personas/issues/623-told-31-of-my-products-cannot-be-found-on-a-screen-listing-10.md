# 623 — Told 31 of my products cannot be found, on a screen listing 10

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 207
**Surface:** mypiggles › Sell › Products
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 207 (seen on screen, before and after)

## What happened

Sell › Products, one screen:

> **Searching your shop won't find 31 of your products**
> Your site still shows it and people can still buy it. What isn't working is the
> search box and the filters beside your shop…

and, at the bottom of the same pane:

> Showing 1–10 of 10

I do not have 31 products here. I have ten. So either the warning is about
something else, or the list is hiding things from me, and nothing on the screen
tells me which.

## Why it happened

I run **seven sites**. Products are shared across a tenant and attached to sites
through `commerce_product_properties`, so "my products" means something
different depending on which site you are standing on.

`/v1/search/status` was the **only one of the three product-search routes in its
own file** that did not resolve the site:

| route                     | scoped                  |
| :------------------------ | :---------------------- |
| `GET /v1/search/products` | `resolveListScope(...)` |
| `GET /v1/search`          | `resolveListScope(...)` |
| `GET /v1/search/status`   | **nothing**             |

So it compared **every site's catalog** against **every site's index** and
handed the answer to a screen that lists one site's products.

Measured 2026-09-17:

```
commerce_products for this tenant:  52 rows, 34 live, 31 on sale   ← the banner
her primary site's list:                                      10   ← the pane
```

Both numbers were right about their own population, and neither was about the
other's. This is the shape her own journal already records twice under
[[feedback_site_is_the_business]]: reads scoped, and one read left out.

## The fix

The status route resolves the site the way its two neighbors do, and **both
halves of the comparison move together** — scoping the index count while leaving
the catalog count tenant-wide would have turned a confusing warning into a wrong
one.

- **The index half** uses the same Typesense filter the storefront and
  `/v1/search/products` use, with the all-sites sentinel beside this site's id,
  so a global product counts on every site and a site-scoped one counts on its
  own:

  ```
  property_ids:=[`__all__`,`<propertyId>`]
  ```

- **The catalog half** uses `productSiteVisibilityWhere(propertyId)` — the same
  clause the products list itself filters on — so the two numbers on the screen
  are counted the same way by construction rather than by coincidence.

On screen:

|        | before | after |
| :----- | -----: | ----: |
| banner | **31** | **7** |
| list   |     10 |    10 |

Seven is checkable from the pane: ten products, three of them marked **Not on
sale** (Brass belt hardware, Linen natural 200gsm, Ridge Wool Coat), and the
warning counts only what is on sale.

## Not changed

**Nothing is findable on this site at all** — all seven on-sale products are
missing from the index, which is what the banner says and what its "Put them
back" button is for. That is the pre-existing indexing gap the banner exists to
report, and it is now reported at a size an owner can act on.

## Still open

`collectionStats` on the same response is still tenant-wide. It feeds the staff
index view rather than this banner, and per-collection document totals are a
platform-operations number rather than an owner's, so it was left alone rather
than scoped on the way past.
