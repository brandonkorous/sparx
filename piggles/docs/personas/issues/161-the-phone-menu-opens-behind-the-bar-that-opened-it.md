# 161 — The phone menu opens behind the bar that opened it

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · before act 1, proving the fix for [160]
**Surface:** meetpiggles — every page (site header menu)
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** the same menu, reopened — below

## What happened

With [160] fixed, the **☰** is on the screen and opens. The panel slides in
carrying **Piggles · Apps · Pricing · Free tools · Trust · Sign in** — and the
top bar stays painted on top of it.

**Apps** is sliced in half by the bar. **Pricing** is behind it completely: not
faint, not partly covered, simply not there. What a person sees is a menu that
begins at Free tools, with a gap above it where two of the four pages ought to
be.

Pricing is the page she came to find.

## What should have happened

A menu that opens covers what is underneath it. That is what opening a menu
means, and it is the one thing the panel has to do.

## How to reproduce

Every time.

1. Open `localhost:3020` at 360px or 390px.
2. Press **☰**.
3. Read the panel. Apps is cut off; Pricing is not visible at all.

## Why it matters

It is worse than [160] rather than a smaller version of it. There, the way in
was off the screen and the page at least looked whole. Here she found the menu,
opened it, and the menu is missing two items — so the reasonable conclusion is
that Piggles has no pricing page, which is exactly the question she opened it to
answer.

Nobody had seen it before today because the button that opens the panel was
itself off the edge of the screen, so this has been sitting behind [160] the
whole time.

## Where it lives

[piggles/apps/web/components/marketing/site-header.tsx](../../../apps/web/components/marketing/site-header.tsx)

silica puts its overlay layer at 40 — measured on the open panel,
`.drawer-backdrop` and `.drawer-popup` both compute to `z-index: 40`. The header
is `sticky top-0 z-50`, so the app's own chrome is sitting a layer above the
design system's overlays. Any dialog, sheet or drawer this app opens comes out
underneath the bar.

The rule that falls out of it: **no chrome in this app may claim 40 or above**,
because 40 and up belongs to things that open on top.

## The fix

The header drops to `z-30`, with the reason written beside it so the next person
to reach for a bigger number knows what it costs. Nothing else changed: silica's
overlay layer is where it was, and the bar keeps winning over ordinary page
content because page content is not competing for 30.

Two things checked rather than assumed:

- **The bar still covers the page.** At 5,103px down the home page,
  `elementFromPoint` inside the header returns `.navbar-start`, not the section
  underneath it.
- **Nothing else in this app claims the overlay layer.** One card in the day
  sequence carries `z-40` while it is the live one, but it lives in a pinned
  panel that never travels under the bar — measured mid-sequence, its top edge is
  at 397 with the header ending at 109. The consent bar is `z-50` and would cover
  an open panel's lower edge; it is a fixed bar at the bottom of the screen with a
  claim of its own on being seen, so it is left alone and noted here rather than
  changed on the way past.

## Confirmed by

Re-ran it as Devi at 360px: pressed **☰** and read the panel. **Apps · Pricing ·
Free tools · Trust · Sign in**, all five whole, with the bar behind the panel
where it belongs. Pressed **Apps** and it went to the apps page and closed the
panel.

## Rating effect

Folded into `meetpiggles — pricing` and `meetpiggles — home` in
[rating.md](../rating.md), scored with both fixes in.
