# 639 — Half the pages in my search score were my other shop's

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 220
**Surface:** mypiggles › Get Found › How people find you, and Things worth fixing
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 220 (two sites, each checked against the database)

## What happened

Get Found › How people find you, standing in my shop:

> **Average score 79** — across **96 pages checked**
> **Pages to improve 25** — scoring under 70

My shop has **49** pages, and they average **75**. The other 47 are my Press,
Journal, Lookbook and Sample Sale websites: different domains, different readers,
different words. My Sample Sale stock scores 95, so the pages that are not mine
were making my shop look four points better than it is, on the one screen whose
whole job is telling me what needs work.

## Why it happened

[[391]] is this issue, found nine months of screens ago and fixed for one of four
kinds of page. Its own note says where it stopped:

> The residual is stated rather than hidden: an entity pinned to ANOTHER site
> still counts here, because its audit row does not carry the pin.

`seo_audits` carries a nullable `property_id`, and only a `builder_page` audit
ever fills it in. The other three types express site visibility through junction
tables, so their audit rows are all NULL — and NULL was read as "shown on every
site". That is right for an entity linked to no site and **wrong for one linked
to a different one**, which is most of a catalog.

Measured 2026-09-17, on her shop:

| kind of page | on her shop | belongs to another site only |
| :----------- | ----------: | ---------------------------: |
| builder page |      **22** |                            0 |
| content page |       **9** |                           18 |
| collection   |       **8** |                            5 |
| product      |      **10** |                           24 |
| **total**    |      **49** |                       **47** |

|                  | shown |   true |
| :--------------- | ----: | -----: |
| pages checked    |    96 | **49** |
| average score    |    79 | **75** |
| pages to improve |    25 | **21** |

When 391 was written the residual was nine pages. It was never nine: it was
whatever share of the catalog belongs elsewhere, and it grew with her business.

## Why the pin cannot simply be stamped

391's note proposed the indexer stamping `property_id` for the other three types.
**That is wrong, and it is now written down in the code so nobody tries it.** A
product can be sold on several of a business's sites — which is exactly why those
three use junction tables instead of a column. One nullable column cannot hold
two sites, so stamping would be right for the common case and silently wrong for
the multi-site one: a smaller copy of this same bug.

The pin belongs where it already lives. The fix is on the read side.

## Why the fix is SQL

`seo_audits.entity_id` is **polymorphic** — one uuid column pointing at four
tables, with no Prisma relation to any of them. The platform's other visibility
fragments (`productSiteVisibilityWhere` and its three siblings) work because
`propertyLinks: { some: … }` compiles to an EXISTS subquery, and that is
unavailable here precisely because there is nothing to traverse.

The alternative inside Prisma is to fetch the entity ids first and pass
`entityId: { in: [...] }`, which puts a list the size of a catalog into every
request. So the rule is one `Prisma.Sql` fragment, EXISTS per type, in
`auditsOnSiteSql`.

## The fourth copy of the rule

Four reads feed these two screens: the audits list, the checklist roll-up, the
count under "average score", and the activity feed. Three imported the shared
`where`; the checklist query **spelled the old rule inline in its own SQL** —
a fourth copy, free to drift, and one that would have gone on counting the Sample
Sale's stock after the list stopped.

All four now take the one predicate, and the Prisma form is **deleted** rather
than kept: it expressed the first tier only, and leaving the wrong answer under
the obvious name is how the inline copy happened in the first place.

## Confirming it

Driven as Devi on two of her sites, each predicted from the database first:

| Standing on             | Was          | Now              | The truth    |
| :---------------------- | :----------- | :--------------- | :----------- |
| Juniper Row (her shop)  | 96 · 79 · 25 | **49 · 75 · 21** | 49 · 75 · 21 |
| Juniper Row Sample Sale | —            | **43 · 80 · 8**  | 43 · 80 · 8  |

And **Things worth fixing** beside it, which reads the checklist, now says
"49 pages" and "counted across all 49 scored pages" — it said 96 before, above an
overview that would have said 49. Two screens, one number.

## Guard

`seo-audit-site-scope.test.ts`, **3 new tests** (7 in the file). They seed real
products with real site links, one per case:

| the product      | sold on       | on her shop | on her sale |
| :--------------- | :------------ | :---------- | :---------- |
| Sold in the shop | the shop      | yes         | no          |
| Sold everywhere  | no site given | yes         | yes         |
| Sale only        | the sale      | **no**      | yes         |
| Sold in both     | both          | yes         | yes         |

"Sold in both" is the one that proves why the column could not carry the pin.

Proved red by putting 391's pin-only rule back: **3 of 7** fail, and they are the
three new ones — the four written for 391 still pass, so the fix keeps every
guarantee it made.
