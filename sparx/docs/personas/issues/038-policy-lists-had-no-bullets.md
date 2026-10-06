# 038 — Bulleted lists on content pages had no bullets

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** tenant site › every CMS page and blog post (`.sparx-content`), and the rich-text section
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** after the restart, the live Shipping Policy page: 8 lists, each `list-style-type: disc`, position outside (read from the rendered page)
**Blocked on:** —

## What happened

His Shipping Policy's bullet points rendered as indented paragraphs. The CSS reset
sets `list-style: none`, and `.sparx-content` put back the margin but not the
marker. The older rich-text section had the same gap.

## The fix

- `wizeworks/apps/site/app/globals.css`: `ul` disc, `ol` decimal, nested circle and lower-alpha.
- `wizeworks/apps/site/components/sections/rich-text.tsx`: list utilities.

## Seen, not settled

The dev server rebuilt its CSS at 09:03 with the rich-text change but from a stale
copy of `globals.css`, and did not rebuild after a `touch`. A watcher problem in
the dev server, not code; a restart is needed.

## Rating effect

—
