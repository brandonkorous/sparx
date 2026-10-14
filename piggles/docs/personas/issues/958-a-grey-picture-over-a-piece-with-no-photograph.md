# 958 — A grey picture over a piece with no photograph

**Status:** fixed (act 7)
**Severity:** major
**Found by:** P09 · The Marrow Review · act 7, after her new piece went live
**Surface:** every site: lists of writing (`cms.<kind>`), and the blog post page
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · act 7, her front page at 390px
**Blocked on:** —

## What happened

Her front page leads with the newest piece. The newest, "Who pays when the malting barley
fails", has no photograph yet. Above its headline the live page drew the platform's grey
"an image goes here" art: a sun and two hills on grey.

## Why

The last render stage gives any image with no source the placeholder, so an empty shop
grid draws grey art instead of a broken-image glyph. It cannot tell "this piece has no
picture" from "an image goes here", so it drew one for a real piece.

## The fix

- `packages/silica-catalog/src/attr-binding.ts`: `markWritingListImages` marks, before
  resolution, every image bound inside a list of writing (`cms.<kind>`) and every image
  bound to a post's `featuredImage`. `fillMissingImageSrc` leaves a marked image out when
  it resolved to nothing, and strips the marker either way.
- `render.ts`: `resolveForVisitors` marks first, so the site and the published export
  both do it. The studio canvas does not render through it and keeps its placeholder.
- `cms.ts`: the blog post page's picture band is shown only when the post has a picture,
  so a post without one has no empty band under its headline.

A shop's grid is unchanged: a product with no photograph keeps the placeholder, because
beside four with photographs it reads as a hole.

## Proof

- `writing-list-images.test.ts`, 4: a list of writing leaves the picture out, carries no
  marker onto the page, a post page leaves it out, a shop list keeps the placeholder.
  Without the marking, 1 reddens; without the `featuredImage` rule, 1 reddens.
- Catalog suite 1,439 pass.
- On screen: her front page shows the new piece's date, headline and standfirst with no
  picture box. No placeholder on Home, Journal, Ledger or Archive.
