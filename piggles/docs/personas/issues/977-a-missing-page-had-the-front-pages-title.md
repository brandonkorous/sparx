# 977 — A missing page had the front page's title

**Status:** fixed (standing checks)
**Severity:** minor
**Found by:** P09 · The Marrow Review · act 7, the reader at a dead address
**Surface:** every tenant website's "page not found"
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · standing checks
**Blocked on:** —

## What happened

A reader followed a dead link to `/articles/no-such-piece`. The page said the right
things, but its tab read **"The Marrow Review"**, the same as the front page. With
several tabs open, nothing said this one was a dead end, and a screen reader
announced only the business's name.

## The fix

`apps/site/app/not-found.tsx` sets its own title: **"Page not found · The Marrow
Review"** through the layout's template. On an address with no business at all it
keeps **"Site not found"**, which is what that page says.

## Proof

On screen: `/articles/no-such-piece` reads "Page not found · The Marrow Review" (404);
an unknown business reads "Site not found". Site type-check and lint clean.
