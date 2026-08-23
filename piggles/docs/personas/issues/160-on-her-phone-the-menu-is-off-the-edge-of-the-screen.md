# 160 — On her phone, the menu is off the edge of the screen

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · before act 1, reading the pricing page
**Surface:** meetpiggles — every page (site header)
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** the same four pages at 360px — below

## What happened

Devi found Piggles on her phone, the way she finds everything. The top of the
page carries the wordmark, the appearance toggle and **Get Piggles** — and
nothing else. No Apps, no Pricing, no Free tools, no Trust, no Sign in, and no
button to open them.

They are not missing. The **☰** button that opens them is sitting past the right
edge of the screen, and the page scrolls sideways to reach it. So does every
other page, in the same direction, by the same amount.

She can sign up, because Get Piggles happens to be the last thing that fits. She
cannot look at anything first.

## What should have happened

The way around the site is on the screen. A person on a phone gets the same four
pages a person on a laptop gets, without dragging the page sideways to find the
control that opens them.

## How to reproduce

Every time, on every page.

1. Open `localhost:3020` at a phone width — 360px or 390px.
2. Look at the top bar: wordmark, appearance toggle, **Get Piggles**.
3. Drag the page sideways. The **☰** appears.

Measured in an iframe rather than by resizing a window:

| Viewport | Page is this wide | ☰ right edge |
| -------- | ----------------- | ------------- |
| 360      | 396               | 396           |
| 390      | 396               | 396           |
| 420      | 401               | 396           |
| 768      | 749               | 725           |

Below about 400px the bar stops fitting and the overflow lands on the ☰, because
it is the last thing in the row.

## Why it matters

Piggles' own audience is the reason. This product is written for a person who
runs a business from a phone, and the marketing site is the first thing that
person ever sees — the one page that has to work before anyone trusts the rest.
A visitor who cannot reach Pricing does not go looking for a sideways scrollbar;
she leaves.

It is also visibly broken rather than merely awkward. The page slides under the
finger on a vertical swipe, which reads as a site that was never opened on a
phone.

## Where it lives

[piggles/apps/web/components/marketing/site-header.tsx](../../../apps/web/components/marketing/site-header.tsx)

The bar's right-hand zone holds four controls, and at 360px they need more room
than the row has:

| Control           | Width |
| ----------------- | ----- |
| Logo (left zone)  | 124   |
| Appearance toggle | 48    |
| Get Piggles       | 128   |
| ☰                | 48    |
| gaps + `px-6`     | 64    |

That is 412 against a 360px screen. The zones are flex children with
`min-width: auto`, so neither side shrinks below its content and the row simply
runs off the end instead of wrapping or clipping.

The full lockup is the part that does not earn its width here: on a phone it is
124px of a 360px bar spent saying a name the browser tab is already showing.

## The fix

**The mark, not the lockup, below `sm`.** `@piggles/brand` already ships `Mark`
alongside `Logo`, drawn from the same geometry and documented as legible down to
favicon size, so this is the component the brand provides for exactly this width
rather than a shrunken workaround. 124px becomes 45px, and the row goes from 412px
of content to 336px in a 360px screen.

Everything else stays as it was. The appearance toggle keeps its place at every
width for the reason already written beside it — a person who reads in dark mode
reads in dark mode on a phone — and all four controls keep a 48px target, which
mattered more here than saving the wordmark.

RULE #0.5 came with the edit. `SiteHeader` was a 112-line function and the
comments around it ran to sixteen lines apiece, so the file split three ways and
every comment came down to three lines or fewer:

- [site-header.tsx](../../../apps/web/components/marketing/site-header.tsx) — the bar, 66 lines
- [header-menu.tsx](../../../apps/web/components/marketing/header-menu.tsx) — the drawer, 56 lines
- [header-links.ts](../../../apps/web/components/marketing/header-links.ts) — the four pages both render

The state went with the drawer, so the header no longer needs `'use client'`.

**Sibling checked:** the only other navbar in Piggles is the console's topbar
([topbar.tsx](../../../apps/workbench/components/topbar.tsx)). It is not fixed
here and is checked on its own when this run reaches the console.

## Confirmed by

Re-ran it as Devi, at 360px in an iframe, on all four pages. The bar reads
**mark · appearance · Get Piggles · ☰**, and the page no longer moves sideways:

| Page     | Page is this wide | ☰ sits at |
| -------- | ----------------- | ---------- |
| /pricing | 341 of 341        | 269 – 317  |
| /apps    | 341 of 341        | 269 – 317  |

Pressing **☰** opened the panel; pressing **Apps** inside it went to
"Fifteen apps. One subscription. No upgrade buttons." and closed the panel behind
itself. The ☰ is still 48 × 48.

Opening it also surfaced [161], which was hiding behind this one: the panel came
up underneath the bar. Both are fixed.

## Rating effect

`meetpiggles — pricing` and `meetpiggles — home` are scored in
[rating.md](../rating.md) with this already fixed.
