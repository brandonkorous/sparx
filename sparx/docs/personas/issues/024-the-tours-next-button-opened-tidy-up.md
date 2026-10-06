# 024 — The tour's Next button opened "Tidy up"

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › first-run tour (16 steps)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 2 — Next advanced the tour through all 16 steps to "Got it"
**Blocked on:** —

## What happened

The welcome tour opened in the bottom-right corner. Its **Next** button sat
under the canvas's floating tools (the grid and search pill). Doty pressed Next
and got the "Tidy up" menu ("Bring everything back · Fan them out · Share the
screen out") instead. The tour could not be moved past step 1 with the mouse.

## What should have happened

The tour card sits above everything on the workspace.

## Where it lives

`sparx/apps/workbench/lib/tour/tour.css` gave the card's wrapper `z-index: 9500`
with a two-attribute selector. silica styles every popup wrapper with
`[role='presentation'][data-side][data-align] { z-index: var(--z-popover, 70) }`,
three attributes, so it won: the card measured `z-index: 70`, under the canvas
tools at 9000 (`components/canvas-tools.tsx` via `window-canvas`).

## The fix

The tour rule now also sets silica's own dial, `--z-popover: 9500`, so silica's
rule computes 9500. Measured: the wrapper reads `9500`.

Piggles has no first-run tour, so nothing to change there.

## Confirmed by

> Re-ran P01 act 2: Next went from "Welcome to your workbench" through "This is
> your business", "Run more than one business?", "Find anything, fast", "Your
> tools live on this rail", "Your work opens here", "Keep your favorites close",
> "Build your website", … "We're right here" and "Got it".

## Rating effect

—
