# 157 — A salon's social card and error page were painted in another company's colour

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · alongside [128](128-the-check-that-was-supposed-to-catch-the-brand-leak-does-not-look-for-it.md)
**Surface:** halo-and-hem.piggles.site › the link preview, and the page when the site fails to load
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** the hex is gone from both files and the accent now arrives per brand

## What happened

Taking the inventory of literal hexes under `wizeworks/` for [128], two of them
turned out not to be theme values at all. Both are in `wizeworks/apps/site` — the
renderer that serves every tenant of BOTH brands — and both were `#e04631`, sparx
Ember, hardcoded:

- **The social card.** `app/api/og/route.tsx` had
  `const DEFAULT_ACCENT = '#e04631'; // sparx Ember, when the tenant set no brand color`.
  That is the rule across the top edge of the 1200×630 card a link preview shows when
  Nia's page is pasted into a message. She has not set a brand colour, so she got it.
- **The error page.** `app/global-error.tsx` filled its one button — "Try again" —
  with the same hex.

Neither is a token that a theme could override: the OG route runs on the edge and
resolves no CSS at all, and the error boundary only ever renders after the root
layout threw, when there is no stylesheet left.

## What should have happened

`wizeworks/CLAUDE.md` RULE #0 is unambiguous: **"No brand hexes. Not one. Colors are
tokens; the values live in each brand's theme package."** And `brand-core` already
publishes `platformBrandIdentity(brand).accentHex` for exactly the case where a value
has to be inlined rather than tokenised — it is what the site's attribution badge
reads.

## Why it matters

A link preview is the most-shared thing a small business has. Nia's is the image
that shows up when a client forwards her booking page to a friend, and the one
coloured element on it belonged to a company she has never heard of. The error page
is rarer but worse, because it is the one screen that appears when everything else
has failed and there is nothing else on it to look at.

It is also the same shape as [091]: a platform default that was written when there
was one brand, and reads as correct because it looks fine on the brand it was
written for.

## Where it lives

- [wizeworks/apps/site/app/api/og/route.tsx](../../../../wizeworks/apps/site/app/api/og/route.tsx)
- [wizeworks/apps/site/app/global-error.tsx](../../../../wizeworks/apps/site/app/global-error.tsx)
- [wizeworks/apps/site/lib/og.ts](../../../../wizeworks/apps/site/lib/og.ts) — where the fix went

## The fix

**The card.** The edge route performs no lookup by design — that is what keeps it
fast and cacheable — so it has no way to ask whose site it is drawing. The fallback
therefore has to arrive as a parameter, and `lib/og.ts` is where it is resolved:
`OgCardParams` gained `platformBrand`, filled from `site.platformBrand` (already in
the site context) at all nine call sites, and `ogImageUrl` falls back to
`platformBrandIdentity(platformBrand).accentHex` when the tenant has set no colour of
her own. The route's own `DEFAULT_ACCENT` is now the card's own ink — reached only
when neither the tenant nor her platform has published a colour.

**The error page.** It is a client component rendering after the layout threw, so it
cannot look anything up and adding `NEXT_PUBLIC_*` plumbing to an error boundary is
machinery for the one screen that must never itself fail. The button is filled in the
page's own `INK` instead — high contrast on the white card, unmistakably a button,
and belonging to nobody.

## Confirmed by

`grep -rn e04631` over `wizeworks/apps/**` returns nothing. `tsc --noEmit` clean on
`wizeworks/apps/site`; `check:boundaries` and `check:brand` green.

Not yet re-run on the screen: generating a real card means driving the tenant site,
and the browser connection is down. The value is now read from the same
`accentHex` the attribution badge on Nia's own footer already resolves correctly, so
the mechanism is proven — but this stays worth a look when the browser is back.

## Left standing

The **default tenant theme** is a separate question and not this issue: the starter
palette in `site-themes/src/presets` and `silica-catalog/src/base-theme` is also
`#e04631`, which is what a brand-new site opens in before anyone picks a colour. That
is tenant content rather than platform chrome (`wizeworks/CLAUDE.md`: "builder output
is tenant content with full design freedom"), and each brand's golden blueprint
dresses a new site anyway — `piggles-starter` sets `colorPrimary: '#ff6f86'`, so a
Piggles business born through the normal path never sees the Ember default. The
preset only shows through where no blueprint was installed at all, which is a
provisioning gap rather than a colour bug.
