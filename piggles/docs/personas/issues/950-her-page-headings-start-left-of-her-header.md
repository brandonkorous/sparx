# 950 — Her page headings start left of her header

**Status:** confirmed
**Severity:** design
**Found by:** P09 · The Marrow Review · act 6, looking at Archive and Contributors at desktop width
**Surface:** her public site, every page built from the catalog's sections
**Filed:** 2026-10-08
**Fixed:** 2026-10-11
**Confirmed by:** P09 on screen, 2026-10-11, after issue 986
**Blocked on:** nothing

## What happened

On a screen wider than about 1,200px, the heading of every page she built with **Page
top** ("Archive", "Contributors", "The Friday letter") starts 24px to the left of her
header's name and her footer. At 1,280px: header and footer text at x=88, Page top at
x=64. On a phone the two agree.

## Why

Two ways of drawing the same 6xl page measure, and every design picks one:

- **Gutter inside the box** (`mx-auto max-w-6xl px-6`): content is 1,104px wide at most.
  Used by the header and footer of 169 of the 191 designs in `marketplace-catalog`
  (hers, Longform Literary, among them) and by every list block the site draws itself
  (`host-nodes.ts`: Archive by month, search, account, the author pages).
- **Gutter outside the box** (`px-6` on the band, `mx-auto max-w-6xl` inside): content
  is 1,152px wide at most. Used by every catalog section (`section()`, `sectionAlt()`
  in `sections/_shell.ts`, plus the shop, notice and feature bands), and by the footer
  of the default starter and of 22 designs (`piggles-starter` among them).

Below 1,200px the two are the same. Above it they are 24px apart. So on her site the
Page top (a catalog section) starts 24px left of her header and of the Archive list on
the same page. On a starter site it is the other way: catalog sections line up with the
footer, and the site's own lists sit 24px in.

The first version of this note said the frame was always the inside shape. It is not:
the 22 designs' header has no measure at all, and their footer is outside.

## The decision

Brandon, 2026-10-11: the house measure is **gutter inside the box**, `mx-auto
max-w-6xl px-6`, content at most 1,104px. Every band, header and footer starts its
content on that edge at every width.

## What measuring found

Checked in code before anything was changed, and two things in the note above were
wrong:

- **silicaui is not involved.** Its `navbar`, `navbar_center_links`,
  `navbar_center_logo`, `footer` and `footer_newsletter` blocks are already the inside
  shape, in 0.59.0 and in 0.59.1 (`mx-auto w-full max-w-6xl px-6 py-14` on the footer).
  The outside footer and the measureless header belong to the golden `sparx` design,
  captured from the live Template property, and copied into the 20 themed sparx designs
  and `piggles-starter`. No silicaui change is needed, and no follow-up there.
- **It is far bigger than 79 bands in 22 bundles.** 88 of the 191 bundles: 651 bands
  with the gutter outside the box, 152 picture bands whose box widened its gutter to
  `@3xl:px-10` (so the panel over the photograph sat 16px right of the header on a
  desktop), and 22 captured full-width headers. The template generators hand-author
  the outside shape thousands of times, not only through `section()`.
- The `navbar()` factory in `builder-schemas/src/site-chrome.ts` builds the legacy
  `.bx-*` layout (the `draftTree` column), which the silica site does not render. Her
  header is silica's `navbar` block, already on the house edge. Not changed.

## The fix

One rule, in `wizeworks/packages/silica-catalog/src/page-measure.ts`, used by the
factories' tests, the studio heals and the marketplace generators, so the three cannot
disagree:

- `measureRepair(node)` moves exactly two stamped shapes and nothing else: a `section`
  or `footer` whose only side padding is `px-6` and whose every child is a bare
  `mx-auto max-w-6xl` box (the gutter moves into each box), and a `mx-auto max-w-6xl`
  box padded exactly `px-6 @3xl:px-10` (the wide gutter goes). A band an author padded
  differently, a band holding anything beside its measure, and a centered reading
  column (`max-w-3xl`) are left alone. `insideMeasure(root)` walks a tree with it;
  `siteInsideMeasure(site)` does a whole site.
- `isCapturedHeader` / `headerToInsideMeasure`: the golden capture's bar, matched on its
  whole class string, keeps its tag, attributes, border and surface, and its children
  move into one `mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6
py-4` box.

The factories, so a new page is right:

- `section()` and `sectionAlt()` in `sections/_shell.ts`.
- `commerce.ts`: `CONTENT_WIDTH` carries the gutter; the products grid, the product
  carousel and `shopHeader()` lost the band's `px-6`.
- `sections/layout.ts` `noticeBanner()`, `sections/feature.ts` the lookbook tiles and
  the picture bands (`@3xl:px-10` dropped).

Stored pages and frames, healed on the draft at studio load through the existing paths:

- `upgradePageBody` (`upgrade-page.ts`) runs `measureRepair` on every node, after the
  dead-class repair (which rewrites `class` from the original node and would otherwise
  put the band's gutter back).
- `upgradeFrameChrome` (`upgrade-frame.ts`) rule 6 heals the captured header and then
  every outside band in the frame, the footer among them. Runs last, because the brand
  repair reads the header's direct children.
- Counted read-only on the local database: 92 of 520 stored page drafts heal (59 of them
  published), carrying 141 outside bands and 23 widened picture boxes; 24 of 48 frames
  heal (22 captured headers, 24 outside footers). Her own site: Home, Shop, Archive,
  Contributors, Subscribe and the product page heal; her frame is already right.

The marketplace bundles:

- All three harnesses (`template-sites`, `service-sites`, `portfolio-sites`) run
  `insideMeasure` on every page they emit; `gen-sparx-themed.ts` and
  `gen-piggles-showcase.ts` run `siteInsideMeasure` on the golden's pages beside the
  `upgradeFrameChrome` they already ran on its frame. A regenerated bundle cannot move
  its edge back.
- The 88 bundles were rewritten in place with the same functions, node ids kept, and
  each bumped one patch version in both `sparx.json` and `blueprint.ts` (46 from 1.5.1,
  40 from 1.5.2, `piggles-starter` 1.3.2 to 1.3.3, `sparx` 1.6.2 to 1.6.3). The template
  harness's `BUNDLE_VERSION` is now 1.5.3 and the golden-family generators' literals
  1.5.3 and 1.3.3, so a regen never ships an older version. Running both golden-family
  generators afterwards reproduced the rewritten bundles byte for byte. A template was
  not regenerated: a regen re-mints every id and picks up unrelated, unshipped chrome
  changes.

## Proof

- `page-measure.test.ts`, 15 cases. It measures the edge rather than one factory: for
  every navbar variant, every footer variant, Page top, every catalog band on the 6xl
  measure (over 60), every band of the starter site and of every record page, and every
  list the site draws itself, the content box must carry `px-6` and nothing above it may
  pad the page. Also the exact old shapes healed (to what the factory stamps today,
  byte for byte), the shapes it must leave alone, idempotency, and the captured golden
  frame lined up by `upgradeFrameChrome`.
- Proved red: `section()` put back to the outside shape reddens 3 (Page top under every
  header, the catalog sweep, the heal-equals-factory case). Separately, `CONTENT_WIDTH`
  without its gutter and the header rule removed from `upgradeFrameChrome` redden 3
  (the products block, the starter Home, the captured header). Both restored.
- `upgrade-page.test.ts`, 4 new cases: a stored band healed wherever it sits, both
  repairs kept when a band also carries a dead class, healed once and then stops, an
  author's padding left alone.
- `site-lint/src/blueprint-measure.test.ts`: every shipped bundle's frame and pages, as
  shipped, carry no band in an old shape. Proved red by putting the committed
  Longform Literary `site.json` back: it lists every outside band on her Home.
- silica-catalog 1,458 tests pass; site-lint's blueprint suites (chrome, sweep, render,
  measure) pass; builder 202 pass. Every one of the 191 bundles passes
  `safeParseBlueprint` with `blueprint.ts` and `sparx.json` agreeing on the version.
- Seen on screen, 2026-10-11, at 1,438px. Before: on her live Archive the header's name
  started at x=159 and the Page top heading at x=135. Opening Archive in the studio
  healed its draft, but "Publish everything" would have shipped every page she had not
  opened unhealed, which is issue 986. After 986, the publish screen named 7 pages,
  and after Publish everything the header, the page heading and the footer all start
  at x=159 on Archive, Contributors, Subscribe and Home. About starts at 327 because it
  is a centered reading column, which is meant.
