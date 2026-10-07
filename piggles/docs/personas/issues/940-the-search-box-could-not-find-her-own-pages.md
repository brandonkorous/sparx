# 940 — The search box could not find her own pages

**Status:** open
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 325, fixing her own site
**Surface:** mypiggles › the search box (both consoles), `@wizeworks/commerce-indexer`
**Filed:** 2026-10-06
**Fixed:** —
**Confirmed by:** —
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
