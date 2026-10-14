# 160 — In dark mode, every email is half dark

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 10 (one email to the fleets); raised by Brandon: "i feel like we screwed up their design"
**Surface:** every email sparx sends, in a mail app set to dark mode; workbench › Email designs › "Preview & check" › Dark; Email › Broadcasts › a sent broadcast › "What was sent"
**Filed:** 2026-10-08
**Fixed:** 2026-10-08, in silicaui (PR #111)
**Confirmed by:** P01 on screen, 2026-10-08
**Blocked on:** —

## What happened

"Preview & check" on "Welcome (sent automatically)", switched to Dark: the first
section ("Welcome to Gillett Diesel Service") turns near-black, and everything under it
sits on the light gray page (`#e9ebee`) as black cards with white words. Light page,
dark cards, dark header: three surfaces that do not belong together. The red and black
Gillett logo almost vanishes on the dark header.

The sent "Fleet winter readiness, November 2026" shows the same in Email › Broadcasts ›
"What was sent", because that frame follows the workbench's dark theme: a black email
on a light page.

## What should have happened

In dark mode the whole email turns dark together, page and content, the way the
canvas's light version holds together. The dark-mode block says it "turns the
LIGHT-rendered email into its brand DARK theme".

## How to reproduce

1. As Doty, Site › Email designs › "Welcome (sent automatically)" › Preview › Dark.
2. Scroll. Every time, on every email with sections on the page color (all 45 of
   Gillett's designs share the page and content background).
3. In a real inbox: any client that honors `prefers-color-scheme` (Apple Mail, iOS
   Mail, Outlook for Mac) with the device in dark mode.

## Why it matters

The customer sees it. Every email every tenant sends looks broken to every reader who
uses dark mode, which is a large share of phone readers. It reads as the business's
own sloppiness, not the platform's.

## Where it lives

- `wizeworks/packages/email/src/silica/dark-mode.ts`: the dark block remaps by VALUE,
  keyed on the `bgcolor="…"` attribute (`[bgcolor="#e9ebee"]{background-color:…}`).
- silicaui `packages/silicaui-builder/src/email/projector.ts`, `toEmailHtml`: the
  `<body>`, the full-width outer table and the `.sui-body` content table paint
  `root.bg` / `root.contentBg` as inline `background` only, with no `bgcolor`. Every
  other painted surface (section, card section, button) carries `bgcolor`. So the dark
  rules reach every block except the page and the content area.
- Measured in the preview frame: the one element left light is the 585 × 1975
  `.sui-body` table, `style="background:#e9ebee"`, no `bgcolor`.
- Not caused by issue 155's change: old (0.58.2) and new (0.59.0) projectors paint
  the root identically.

## Fix

In silicaui, `toEmailHtml` now writes `bgcolor` on the `<body>`, the outer table
(`root.bg`) and the `.sui-body` content table (`root.contentBg`), beside the inline
`background` they already had. Light mode does not change. sparx's `dark-mode.ts`
needs no change: its value remap now reaches the page.

Test, proved red: silicaui `e2e/email-dark-remap.spec.ts` injects a `[bgcolor]`
remap for every light color in a document and checks nothing stays painted in one.
On the old projector it fails with exactly `body`, `table` and `table.sui-body`.
Green now; all 78 email e2e tests pass; lint and typecheck clean.

Not covered by this fix: the Gillett logo is red and black on a transparent
background, so on a dark header its black parts are hard to see. A logo needs a
version for dark backgrounds; not checked further.

## Confirmed by

P01 on screen, 2026-10-08, on silicaui 0.59.1: Site › Email designs › "Welcome (sent
automatically)" › Preview › Dark. The page, the content area and every card are dark
together, from the header to "Read the latest"; nothing is left on the light gray.

## Rating effect

—
