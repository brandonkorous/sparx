# 625 — My clothing till offered a $6,800 bracelet from another business

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 209
**Surface:** mypiggles › Sell › Take a sale (and the bundle builder)
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 209 (seen on screen, before and after)

## What happened

Sell › Take a sale, standing on **Juniper Row** (`?site=primary`), my clothing
shop. Under "What they had", the list I pick from, sorted by name:

```
Astrid Signet Ring      Rose gold                      $1,450.00
Astrid Signet Ring      Yellow gold                    $1,450.00
Brass belt hardware, antique                               $0.00
Céleste Cuff            Large                            $890.00
Céleste Cuff            Medium                           $890.00
Céleste Cuff            Small                            $890.00
Colette Tennis Bracelet                                $6,800.00
Frequency Membership — annual                            $120.00
Frequency Tote                                            $28.00
Leather-covered belt                                      $72.00
Linen Shirtdress        L · Chalk                        $145.00
```

Two of my first three rows are jewelry. I do not sell jewelry at Juniper Row. I
run seven sites and the ring, the cuff, the bracelet and the Frequency things
belong to other ones.

This is the till. Somebody is standing at my counter. The first thing under the
search box is a $1,450 ring I cannot hand them, and a $6,800 bracelet is four
rows below it.

## Why it happened

`GET /v1/commerce/variants` was labelled, in the route and in the console hook
that calls it, **tenant-wide**. It resolved no site at all.

Measured 2026-09-17:

|                                   |         |
| :-------------------------------- | ------: |
| versions offered by the till      | **108** |
| versions this site actually sells |  **75** |
| her products, tenant-wide         |      34 |
| her products on this site         |      10 |

The **products list in the same app** shows 10, correctly. So within one app the
list was scoped and the till was not — the recurring shape, one more time
([[feedback_a_fix_leaves_its_neighbour_behind]]). The hook's own doc comment
named the problem out loud and moved on:

> The **tenant-wide** variants endpoint takes no search term of its own…

Her journal already records this rule twice: **the site IS the business**
([[feedback_site_is_the_business]]). Juniper Row and a jewelry line are not the
same business, and they must not share a till.

## The fix

The route resolves the site the way every other catalog read does, and filters on
the platform's own clause:

```ts
const propertyId = await resolveListScope(auth, q?.property, request.headers['x-sparx-property-id']);
...
...(propertyId === undefined ? {} : { product: productSiteVisibilityWhere(propertyId) }),
```

`productSiteVisibilityWhere` is the **same clause the products list filters on**,
so the two screens now agree by construction rather than by coincidence. A
product linked to no site is global and stays on every counter.

The site rides the `x-sparx-property-id` header the console attaches to every
request, and switching site reloads the page, so no cache key changed.

On screen, standing on Juniper Row:

|                  |             before |               after |
| :--------------- | -----------------: | ------------------: |
| first row        | Astrid Signet Ring | Brass belt hardware |
| signet ring rows |                  2 |               **0** |
| versions offered |                108 |              **75** |

## Reach

Two callers, both pickers, both now right:

- **Take a sale** — the till (piggles only).
- **The bundle builder's version picker** — `variant-picker.tsx`, in both
  consoles. A bundle is a product sold on a site; its parts should be things that
  site sells.

## Guard

New `test/integration/commerce-variants-site-scope.test.ts`, **4 tests**.

Two earn their place beyond the obvious:

```ts
it('offers a product pinned to no site at every counter', …)
it('offers the other site’s stock when you are standing on the other site', …)
```

The second is the one that matters: scoping has to work in both directions, or it
is a filter that happens to hide the right rows once.

Proven red by removing the clause: **3 of 4** fail.

## A test I wrote that stated the wrong rule

A fourth test asserted that sending **no** site header should read the whole
business. It failed, and the code was right: the platform's documented
convention is that **absence means "the site I am working in"**, with
`?property=all` as the explicit opt-out (`ALL_SITES` in `lib/property.ts`), and
the comment there says why — sending no header at all is exactly how a donut
shop employee ends up looking at the machine shop. The test was rewritten to pin
both halves of the real rule rather than deleted
([[feedback_a_fix_leaves_its_neighbour_behind]]).

## Not changed

**`Brass belt hardware, antique · $0.00`** stays in the list. It is hers, it is on
this site, and it is genuinely priced at zero — 2 zero-priced versions out of
2,416 platform-wide, both her own never-edited material drafts. A till that hides
what an owner put in it would be a worse problem than a zero she typed.
