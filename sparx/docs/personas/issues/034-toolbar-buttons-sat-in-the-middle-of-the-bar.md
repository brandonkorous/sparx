# 034 — Toolbar buttons sat in the middle of the bar

**Status:** fixed
**Severity:** major
**Found by:** Brandon, watching P01 act 2
**Surface:** workbench › every pane toolbar (here: Content › Shipping Policy)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** Shipping Policy toolbar (Unpublish at 86px, Save at 1202px of 1345) and Suppliers (Archived and New supplier at the right beside refresh); measured on screen
**Blocked on:** —

## What happened

The Shipping Policy editor's Unpublish and Save buttons sat in the middle of the
toolbar, with the Published badge alone on the left and refresh on the right.

## What should have happened

No toolbar button is centered. A bar reads left to right: what the thing is, then
its controls, then the actions and pane tools at the right edge.

## Where it lives

`components/pane-toolbar.tsx` (both consoles). The bar's right-hand group pushes
itself right with `ml-auto`. 61 toolbars (47 sparx, 14 Piggles) also put an
`ml-auto` inside their own `controls`, meaning "these go on the right". Two auto
margins on one row share the free space equally, so those controls landed
mid-bar. Each screen looked like its own small layout choice; it was one cause.

## The fix

At the single point of change, both consoles: the right-hand group carries a
`toolbar-end` marker, and the bar drops that group's push when a surface pushes
its own controls (`[&:has(>.contents>.ml-auto)>.toolbar-end]:ml-0`, and the same
for legacy children). The surface's push then takes all the free space, so its
controls sit at the right beside refresh, as each surface asked. A bar with no
such push is unchanged.

A first attempt used a stretchy spacer before the right group. It stopped the
centering but sent every one of those controls to the LEFT, against what each
surface asked for ("New supplier" beside the search box). Replaced.

## Confirmed by

> Shipping Policy: right group margin `1025px`, Unpublish x=86, Save x=1202,
> refresh x=1264. Suppliers: right group margin `0px`, Archived x=1029, New
> supplier x=1131, refresh x=1264 (bar 1345px).

Checks: sparx and Piggles workbench `tsc --noEmit` exit 0; eslint 0; parity green.

## Rating effect

—
