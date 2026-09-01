# 358 — Her busiest page said nobody had ever opened it

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · reading "How your pages do" for the first time
**Surface:** mypiggles › My Site › How your pages do
**Filed:** 2026-08-31
**Fixed:** 2026-08-31
**Confirmed by:** her home page, back in the table with its 20 visits

## What happened

"How your pages do" lists every page Devi has, busiest first. Her home page sat at
the very bottom, in the group of pages nobody has ever opened:

| Page               | People | Times opened |
| ------------------ | -----: | -----------: |
| Forgot password    |      0 |            0 |
| **Home — Landing** |  **0** |        **0** |
| Register           |      0 |            0 |
| Reset password     |      0 |            0 |

It also showed no address at all, while every other row printed its own under the
name.

Her home page had **20 visits from 7 people** in those thirty days. It is the
third-busiest address on her site and the first thing almost every visitor sees.

Those 20 visits had not vanished. They were in the line under the table:

> Another **124** visits landed on addresses no page here owns — your cart,
> checkout, sign-in and legal pages, which Piggles builds for you.

Which is the second thing wrong with this screen, because **Cart is the second row
of the table and sign-in is the fourth**. The sentence names two rows that are on
the screen above it and calls them absent.

## What should have happened

Her home page owns `/`, so it gets `/`'s traffic and sorts fifth, between Login
and About. And the note about leftover visits names things that are actually
leftover.

The surface makes the promise itself, at the top of its own file:

> EVERY PAGE, INCLUDING THE ONES NOBODY VISITED. The row with 0 views is the most
> actionable line on the screen: it means a page exists that nothing links to, or
> that search has never found.

A 0 here is supposed to MEAN something. For her home page it meant nothing at all.

## How to reproduce

Every time, on any site whose home page was seeded with a NULL slug.

1. Sign in as Devi and open **My Site › How your pages do**, Last 30 days.
2. Scroll to the bottom. "Home — Landing" reads 0 people, 0 times opened, and has
   no address under its name.
3. Read the note under the table: 124 visits on addresses with no row, described
   as the cart and the sign-in page, both of which have rows.

Her home page: `builder_pages` where `property_id = a3fd094d-…`, name
`Home — Landing`, **`slug = NULL`**. Her `site_analytics_events` for `/` over the
same window: **20 pageviews**.

## Why it matters

This is the one screen that answers "did the page I spent Tuesday afternoon on do
anything", and it was silently wrong about the page that matters most. Worse than
wrong: it was wrong in the direction that produces action. A home page reading 0
visits is a home page somebody sets out to fix.

And it moved the number somewhere it could not be questioned. The 20 visits went
into a total described as pages "we build for you", so the figure looked
accounted-for rather than missing.

## Where it lives

- [page-performance.ts](../../../../wizeworks/services/api-rest/src/lib/page-performance.ts) `assemble` — the address rule
- [page-results.tsx](../../../apps/workbench/surfaces/builder/page-results.tsx) `ReportFootnotes` — the leftovers sentence
- [copy.ts](../../../apps/workbench/lib/console/copy.ts) `builder.pages.otherViews` — the Piggles wording of it

## The fix

**The root is a correction that swung too far.** The line read `page.slug ?? '/'`,
so every slugless page looked up the home page's metrics: "Home" and
"Home — Landing" each claimed 10 people and 103 opens, for one page's traffic
(seen live 2026-08-02, and there is a test pinning it). The fix for that was
`slug != null` — a null slug is no address — and it is right for the second such
row and wrong for the first.

A null slug is not "no address". It is one of the **three** ways the home page has
been stored, and the platform's own storefront resolver says so in as many words:

> Home is the slugless page — stored as NULL, '' or '/' depending on how it was
> seeded ([site-service.ts](../../../../wizeworks/packages/builder/src/services/site-service.ts))

So the report now asks the same question the storefront asks. Among the pages that
are not collection templates, the **first** slugless one is the home page and
claims `/`; any other slugless page is genuinely unaddressed and claims nothing.
"First" is not arbitrary — `pages` is loaded `orderBy position, createdAt`, which
is the resolver's own precedence, so the row credited is the row a visitor
actually gets.

A collection template is never a candidate: it is a template address rather than a
location, and it is credited through its record-type prefix.

**The footnote had been corrected once already, in the same direction as the bug.**
Its own comment records that it used to name products and posts, which stopped
being true when record templates got addresses. It was then changed to name
cart / checkout / sign-in / legal — and cart and sign-in are ordinary builder pages
with ordinary rows. What is actually in that bucket, on her site, is the checkout,
the `/account/*` area where customers look at their own orders, and three addresses
nothing is served at any more. It says that now, in both the sparx default and the
Piggles wording.

## Confirmed by

> Reloaded **How your pages do** as Devi. **Home — Landing** now reads `/`,
> **7 people, 20 times opened, 1.5 seconds, 82 / 100**, sitting fifth between Login
> and About. The leftovers line dropped from **124 to 104** — exactly the 20 that
> were hers — and now names the checkout, the customer account area and dead
> addresses.

Two tests added to `page-performance.test.ts`, both proved red against the old
line: a home page stored with a null slug is credited (`expected '' to be '/'`),
and a slugless collection template never takes the home page's traffic
(`expected +0 to be 20`). The 2026-08-02 double-count test still passes untouched
— its first page has slug `''`, so it is still the home page.

## Rating effect

`builder.pages` — previously unrated. Recorded in [rating.md](../rating.md).
