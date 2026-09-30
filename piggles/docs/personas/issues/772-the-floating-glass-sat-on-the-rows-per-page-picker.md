# 772 — The floating glass sat on the rows-per-page picker

**Status:** fixed
**Severity:** low
**Found by:** P03 · Juniper Row · act 272
**Surface:** platform — every list pane's footer, both consoles
**Filed:** 2026-09-22
**Fixed:** 2026-09-22
**Confirmed by:** measured before and after, at full width and at 360px
**Blocked on:** —

## What happened

The bottom-right of the wholesale orders list:

```
Showing 1–3 of 3                                       50 per pa  (🔍)
```

The rows-per-page picker reads **"50 per pa"** with no arrow on it, because the
workspace-size control — the round glass that floats in that corner — is parked
on top of it.

## MEASURED, before the fix

| thing                        | left | right | width |
| ---------------------------- | ---- | ----- | ----- |
| the rows-per-page picker     | 1287 | 1421  | 134px |
| the floating workspace tools | 1361 | 1418  | 57px  |

**57px of 134 — the whole right half, including the arrow you open it with.**
It happens on every list pane in the console: **55 surfaces** in piggles use
`ListPagination`, and every one of them puts that control in that corner.

The control still opened, because its left half was exposed. It just looked
broken and could not be read.

## Why the obvious fixes are wrong

**A width breakpoint cannot answer it.** A 600px pane docked against the right
edge collides; a 900px pane docked left does not. The collision is about WHERE
the pane is, which no container query knows.

**A viewport media query is not available.** `use-compact.ts` says so in its own
first line: _"The ONE viewport media query in the app, and it earns the
exception."_ Adding a second to guess at the same fact would be the drift that
rule exists to prevent.

**Reserving space on the canvas costs everyone.** Pushing every pane 56px up the
screen to keep a rarely-used control company is a permanent tax for a corner
that is empty most of the time.

## What was done

**The canvas says when the tools are on it**, with a `data-canvas-tools`
attribute set by `WindowCanvas` — the component that mounts them. The compact
shell has no floating tools at all, so a phone is never marked and never pays.

**The pagination row keeps out of that corner when it is marked**, and nowhere
else. The knowledge lives with the thing that mounts the tools; the footer just
answers it.

**Two more that only showed up once the space was reserved**, both the same
clipping one control along:

- the picker was `shrink-1`, so the reserved space came straight back out of it
  and "50 per page" became **"5("**;
- the count was too, so it became **"Showin"**;
- and the control cluster was `flex-1`, which sets a ZERO basis — so it never
  asked for the room it needed and pushed its own contents out of the pane
  instead of dropping to a second line.

The row wraps now, which is what `flex-wrap` was on it for.

## Files

- `piggles/apps/workbench/lib/dock/window-canvas.tsx`, `sparx/…` — the marker
- `piggles/apps/workbench/components/list-pagination.tsx`, `sparx/…` — keeps clear, and wraps

## Proof

Measured on screen after, full width:

```
{"selWidth": 134, "overlap": 0}

Showing 1–3 of 3                              [ 50 per page  ⌄ ]     (🔍)
```

And at 360px, where the row now wraps instead of clipping either half:

```
Showing 1–3 of 3
[ 50 per page  ⌄ ]        (🔍)
```
