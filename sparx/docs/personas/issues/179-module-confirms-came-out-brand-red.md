# 179 — Module-colored confirms came out in the brand red

**Status:** fixed
**Severity:** design
**Found by:** P01 · Gillett Diesel Service · act 13 (a retail return)
**Surface:** every workbench confirm raised with `color: 'module'` (30 in sparx, 24 in Piggles); first seen on Commerce › Returns › Mark the goods as received
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

Brynn's injector came back to the counter. Doty clicked "Received" on her return. The
confirm asked "Mark the goods as received?" and its button, "Yes, they have arrived",
was red, the same red as the refund button that "cannot be undone". Every other button
on the Commerce pane was Commerce orange.

In the page: `--color-module` is `#f97316` inside the Commerce pane and `#e04631` (the
brand primary) at the page root. The confirm asks for `color: 'module'`, and it renders
at the page root.

## What should have happened

The confirm wears the pane's module color, as the menu popovers already do
(`components/pane-toolbar-overflow.tsx` carries `data-module` onto its portalled panel).
Red stays for what is destructive.

## How to reproduce

1. Open any return in the workbench that is approved.
2. Click "Received". Every time, and on every `color: 'module'` confirm in any app.

## Why it matters

Red on a harmless step reads as a warning, so the one red that means "cannot be
undone" stops meaning anything.

## Where it lives

- `sparx/apps/workbench/lib/dock/window-boundary.tsx`: the per-pane
  `ImperativeAlertDialogProvider` portals to the window body, outside the pane's
  `data-module`. Silica's provider takes `popupProps` for this; nothing passed them.
- The phone layout has no window boundary, so its confirms used the app-level provider
  in `app/layout.tsx`, with the same result.
- Piggles: the same two files, same shape.

## The fix

`components/surface-mount.tsx`, both consoles: each pane's body sits in an
`ImperativeAlertDialogProvider` with `popupProps={{ 'data-module': definition.module }}`,
silica's own way to carry a scope onto the portalled popup. It sits inside the window
boundary's `PortalContainerProvider`, so a torn-off pane's confirm still opens in its own
window, and it covers the phone layout, which has no boundary.
`lib/dock/window-boundary.tsx` drops its own colorless provider, which would have stood
in front.

Test: `components/confirm-module-hue.test.ts` in each console, proved red on the old files
in both. sparx 501 and Piggles 540 tests in `components` + `lib` pass; lint clean.

## Confirmed by

P01 on screen, 2026-10-09 (Commerce › Products, one product ticked, Retire): the confirm
"Retire 1 product?" sits in `data-module="commerce"`, `--color-module` `#f97316`, and its
button "Retire 1 product" is Commerce orange (`rgb(249, 115, 22)`), not the brand red.
Cancelled with "Leave them"; the product is still on sale.

Not checked: a torn-off pane, and the phone layout, on screen. The Piggles screens were not
opened; their tests pass.

## Rating effect

—
