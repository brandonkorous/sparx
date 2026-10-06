# 030 — "Make this fill the workspace" did nothing on a floating window

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › any window in windows mode › title bar
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 2 — the site designer filled the workspace and went back with the same button
**Blocked on:** —

## What happened

The site designer opened in a window about 60% of the screen, too small to work
in. Doty pressed **Make this fill the workspace**. The icon flipped to "Put it
back"; the window did not change size. Pressing again flipped it back.

## Where it lives

`lib/dock/group-actions.tsx` called dockview's `api.maximize()`, which only
applies to the tiled grid. In windows mode every window is a floating group, so
it did nothing, while the button set its own "maximized" state anyway.

## The fix

- `use-canvas-commands.ts`: `toggleFill(group)` places the window on the whole
  visible frame (`fillBox` in `window-placement.ts`) through `addFloatingGroup`,
  remembers its box, and puts it back on the second press. `isFilled(id)` reads it.
- New `lib/dock/canvas-commands-context.tsx` gives the title bar the commands
  (dockview mounts title bars itself; context crosses the portal, as
  `window-mode-context.tsx` does).
- `group-actions.tsx`: on a floating window the button uses `toggleFill`; on the
  tiled grid it keeps dockview's maximize.
- Piggles hides maximize on floating windows instead (resized by dragging), so it
  never had the lying button; recorded as a `check:console-parity` exception.

## Confirmed by

> Re-ran P01 act 2 with the mouse: the designer window went from 844×735 to
> 1362×1021 (the visible workspace), and "Put it back" restored 844×735.

Checks: sparx workbench tsc 0; eslint 0; prettier clean; parity green.

## Rating effect

—
