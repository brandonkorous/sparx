# 952 — Her share card said PAGE

**Status:** fixed (act 7)
**Severity:** design
**Found by:** P09 · The Marrow Review · act 7, checking what a shared link shows
**Surface:** every site's generated share card (`/api/og`)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · act 7, the Field page's card
**Blocked on:** —

## What happened

A page with no photograph of its own gets a generated card. Hers for the Field page
read **PAGE** in spaced red capitals above "Field: the farms, mills and markets of the
Nene valley". The home page's said HOME, the site's said SITE, an author's said AUTHOR.

## Why it matters

Someone scrolling past a shared link learns nothing from the platform's name for the
thing. It is also the label-above-a-heading that root CLAUDE.md RULE #2 bans, printed on
every business's cards.

## The fix

- `apps/site/lib/og.ts`: no label. `OgCardParams` has no `eyebrow`, so a caller passing
  one fails to compile.
- `apps/site/app/api/og/route.tsx`: draws no label; an old link's `eyebrow` parameter is
  ignored. The title sits where it did.
- The eleven callers (home, layout, pages, kinds, authors, blog, products, collections,
  categories) stop passing it.

Articles with a photograph were never affected: their card is the photograph.

## Proof

The Field card fetched again with `eyebrow=Page` still in the address: her title and her
name only. Site typecheck clean.
