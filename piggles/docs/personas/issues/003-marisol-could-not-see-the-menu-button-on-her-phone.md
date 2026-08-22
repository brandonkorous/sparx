# 003 — On her phone at night, the menu button and "Sign in" were not there

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 1
**Surface:** meetpiggles › every page › site header
**Filed:** 2026-08-19
**Fixed:** 2026-08-19
**Confirmed by:** re-ran P01 act 1 in dark theme — measured "Sign in" and the ☰ button against the header fill; contrast went 1.12:1 → 13.6:1, and both are legible in the screenshot at 1285px and at 390px
**Blocked on:** —

## What happened

Landed on `http://localhost:3020` in dark mode (the machine's OS theme is dark, so
`data-theme="dark"` with no choice made). The header shows the Piggles wordmark,
four nav links, a theme toggle and a pink **Get Piggles** button — and then a
gap. There is no visible **Sign in**.

It is there. The ink is `#27232a` on a `#272d39` header: **1.12:1**. WCAG's floor
for text is 4.5:1, so this is not "low contrast", it is invisible.

At phone width the same thing happens to the **☰ menu button**, which is the only
way to reach Apps, Pricing, Free tools and Trust on a phone. The four nav links
are `lg:hidden`, so on a 390px screen in dark mode the marketing site has **no
navigation a visitor can see at all**.

## What should have happened

Both controls legible in both themes. Piggles' own audience is named as a
61-year-old on a phone in a workshop (piggles/CLAUDE.md, personas CLAUDE.md
"Without a mouse") — the phone nav is not an edge case here, it is the case.

## How to reproduce

Every time, no data needed:

1. Set the OS/browser to dark, or run `document.documentElement.dataset.theme='dark'`.
2. Open `http://localhost:3020`.
3. Look at the header right side — "Sign in" is missing. Narrow to 390px — ☰ is missing too.

## Why it matters

A visitor on a phone in dark mode cannot open the marketing nav or find sign-in.
Returning customers reach the console through that Sign in link.

## Where it lives

`piggles/apps/web/components/marketing/site-header.tsx` lines 101, 115, 136.

The cause is one token doing two jobs. `piggles/packages/brand/src/theme/palette.css`
defines `--color-neutral` as the **chrome fill** — `#514b52` light, `#27232a`
dark, deliberately dark in both themes so the rail never inverts. But silica's
`.btn-neutral` sets `--btn-accent: var(--color-neutral)`, and `--btn-accent` is
what `ghost` / `outline` / `soft` / `link` / `dash` paint the **ink** with
(`silicaui/src/color-variants.js`). A fill color used as ink on a dark canvas is
the same color as the canvas.

The comment above line 101 justified it: _"Sign in is the dismiss half of the
pair, so it is the one control on this bar that has earned `neutral`"_. That
"earned" list was deleted from all four rule docs — RULE #4 now reads
`neutral` needs Brandon's approval, every time, and a **colorless** control is
the right answer for untyped chrome.

**445 more `color="neutral"` call sites exist in `apps/workbench`.** Whether they
render the same way is checked in act 4, not assumed here (personas RULE #4).

## The fix

Dropped `color: 'neutral'` from all three controls in `site-header.tsx`, keeping
`variant`. A bare `.btn.btn-ghost` leaves `--btn-accent` unset, so it falls back
to `var(--color-base-content)` — the surface's own ink, correct in both themes by
construction and correct inside a theme island for free. That is the ladder in
root RULE #4: nothing → its own function's hue → `neutral` only with approval.

Measured after the change, dark: `rgb(244,245,247)` on `rgb(39,45,57)` = **13.6:1**.
Light: `rgb(32,38,49)` on `rgb(255,255,255)` = **15.7:1**.

## Confirmed by

> Re-ran P01 act 1. Reloaded `localhost:3020` in dark, saw "Sign in" beside
> Get Piggles for the first time. Narrowed to 390px in an iframe — ☰ visible,
> tapped it, the drawer opened with all four links and the outline Sign in
> inside it also legible. Repeated with `data-theme="light"`: both still right.

## Rating effect

meetpiggles › Home — Design 6 → 8 (recorded in [rating.md](../rating.md)).
