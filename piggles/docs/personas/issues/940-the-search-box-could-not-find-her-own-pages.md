# 940 — The search box could not find her own pages

**Status:** fixed (P09 standing checks)
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 325, fixing her own site
**Surface:** mypiggles › the search box (both consoles), `@wizeworks/commerce-indexer`
**Filed:** 2026-10-06
**Fixed:** 2026-10-09
**Confirmed by:** P09 · standing checks, "Contributors" and "Ledger"
**Blocked on:** —

## What happened

Marisol wanted to change her menu page. She typed its name, **What we bake**,
into the search box. It said **"Nothing in your records matches 'What we
bake'."** She had to open My Site, then Pages, and find it in the list.

Her pages are not in the search index at all, and neither are articles. The
index's own header says so: "Phase 2 appends CMS / Email / Site Builder bundles
here … CMS and Site Builder are still outstanding."

A publisher is the business this hurts most. Rosalind (P09) will have six
articles and a dozen pages, and the box will find none of them by name.

## What should have happened

Typing a page's or an article's name finds it, and Enter opens it in its
editor, the way it does for a product, a customer or an order.

## Where it lives

- `wizeworks/packages/commerce-indexer/src/registry.ts`: the projector registry.
  It holds commerce, CRM and email projectors; it needs a site-page projector
  and a content-entry projector.
- The writes that change a page or an entry must announce
  `search.entity.changed` (topic name equals the event type), and the reindex
  walker must cover both, so a business with pages already gets them in.

## What was already done, and what was left

By 2026-10-09 the index held both kinds: content entries (`cms_entry`) and site
pages (`builder_page`) are projected and signalled on every write. Rosalind's
articles came up by title. Her site pages still did not: the index returned
"Contributors", but the hit's address is `/builder?pageId=…`, which opens sparx's
whole-site editor, and Piggles does not have that screen. The search box asks for a
destination without naming a brand, so it got sparx's answer and dropped the hit.

## The fix

- `@wizeworks/links`: `setLinkBrand` lets a console say once which product it is, so
  a caller that names no brand still gets that product's routes. Piggles sets it in
  `lib/workbench/address.ts`.
- `routes.ts`: in Piggles, `/builder` opens the page editor (`builder.page`) on the
  page the address names. A branded row may now give a shared address a second
  meaning; the screen's own address stays its shared row (`/builder/page`), and the
  table tests say so.
- Found on the way, sparx side: a picture's "used by" links opened `builder.page` and
  `builder.layout`, which only Piggles has. They now open sparx's site editor on the
  page, or on the header and footer.

## Proof

- `routes.test.ts`: a screen's address comes from its shared row, and `/builder`
  opens the page editor for Piggles and the site editor otherwise; red without the
  Piggles row. links 76 pass, type-check and lint clean. `check:routes` clean.
- On screen, as Rosalind: Ctrl K "Contributors" answers **Contributors
  /contributors · The Marrow Review** and opens the page editor on it at
  `/builder/page?pageId=8ec6b0db…`; "Ledger" finds her Ledger page; "seed library"
  finds the article.
- Both consoles' type checks **could not run** (out of memory at the default heap).
