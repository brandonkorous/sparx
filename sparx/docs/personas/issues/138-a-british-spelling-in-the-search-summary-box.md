# 138 — A British spelling in the search summary box

**Status:** fixed
**Severity:** cosmetic
**Found by:** P01 · Gillett Diesel Service · act 9 (writing the first blog post)
**Surface:** workbench › Content › an entry › Search engine listing (sparx)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01, 2026-10-06
**Blocked on:** —

## What happened

The Search description box's hint read "A sentence or two summarising this page". The product is written in American English.

## The fix

- `workbench/surfaces/cms/content-detail.tsx`: "summarizing". The Piggles console does not carry the sentence.

## Confirmed by

The hint now reads "A sentence or two summarizing this page".

## Rating effect

—
