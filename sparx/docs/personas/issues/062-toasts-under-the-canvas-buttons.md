# 062 — Every toast in the sparx console sat under the round buttons in the corner

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 3 (converting his core choices)
**Surface:** workbench › every screen (the toast corner, and window zoom)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** Measured on the Core charges set up as choices screen, 2026-10-01: toast area z-index 90 → 10090, the corner buttons 9000; then "Brynn O'Hara-Løvdal added", "Sale written" and "Core recorded: $150.00 to hand back…" all read in full above the corner buttons. Zoom: **not checked on screen** (rules identical to Piggles, where they work).
**Blocked on:** —

## What happened

"Changed 83 products / Each one is a single part with a real core deposit now" came
up in the bottom-right corner, under the two round buttons (apps and search) that
float there. The toast read "Changed 83 product" with the rest cut off. It did the
same on every toast, on every screen.

Measured: the toast area sat at layer 90, silica's default. The corner buttons sit at
9000, and dockview's floating windows at 1001 and up.

Piggles lifted silica's whole overlay scale above the dock long ago, with silica's own
tokens (`--z-toast`, `--z-dialog`, `--z-popover`, …). The sparx console never got that
block.

Beside it, the same gap: `lib/window-zoom.ts` says a zoomed window's CONTENTS are
scaled "by the data-zoom rules in app/globals.css". Those rules existed only in
Piggles. In sparx, zooming out made each window a smaller box around full-size,
clipped contents.

## Fix

`sparx/apps/workbench/app/globals.css`: the Piggles overlay token block, the Base UI
backdrop layer, and the seven `data-zoom` rules. Same values as Piggles, so the two
consoles stack and zoom the same way.
