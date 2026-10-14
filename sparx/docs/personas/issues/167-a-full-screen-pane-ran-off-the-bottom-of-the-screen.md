# 167 — A full-screen pane ran off the bottom of the screen

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 10 (a customer message answered)
**Surface:** workbench › the workspace (any pane made full screen, in windows mode)
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08 (sparx)
**Blocked on:** —

## What happened

Doty opened Renée Castañeda's chat. The pane filled the screen from side to side, but
its foot was below the bottom edge: the reply box showed "Write a reply…" and nothing
under it. The Send button, Quick replies and "Enter to send" were out of sight. The
workspace had grown a scroll bar on the right and one along the bottom, and he had to
scroll the whole workspace down to reach Send.

Measured on the page: the pane was 1020 px tall, and the workspace could show 947 px of
it. The difference is about the height of the "7 days left in your free trial" banner
above the workspace.

## What should have happened

A pane made full screen fills what he can see, and keeps filling it when that changes:
a banner appears or goes, the browser window is resized, or the workspace is opened
again on a different screen.

## How to reproduce

1. As Doty, in windows mode, make any pane full screen (its title bar's full-screen
   button).
2. Make the workspace smaller: resize the browser window, or reload while a banner
   shows that was not there before.
3. The pane keeps its old size and runs off the screen. Every time.

## Why it matters

The buttons at the foot of a pane (Send, Save, a pager) are the ones a job ends with,
and they are the ones that go out of sight. He cannot tell they are there.

## Where it lives

- `sparx/apps/workbench/lib/dock/use-canvas-commands.ts`, `toggleFill`: sets the
  pane's box once, to the screen as it was at that moment (`fillBox`). Which panes
  are full screen is kept only in memory (`unfilled`), so after a reload no pane is.
- `sparx/apps/workbench/lib/dock/use-window-canvas.ts`: when the workspace changes
  size it resizes only the scroll area, never a pane.
- Piggles has no full-screen button for a pane in windows mode (persona issue 030 was
  sparx only), so it does not have this defect.

## The fix

- `lib/window-placement.ts`: `coversView` (a window covering everything visible is,
  as far as the screen can tell, a filled one), `refillView` (fill from the top of the
  workspace when no other window needs the scroll; otherwise keep the scroll), and
  `windowsToRefill` (which windows to refit, and to what box).
- `lib/dock/use-canvas-commands.ts`: `refill()` refits every window filled this
  session, and any restored window that covers the screen. A restored one gets a
  normal window's box to go back to. Dragging a filled window by hand un-fills it, so
  a resize never snaps it back. A zoom no longer shrinks a filled window.
- `lib/dock/use-window-canvas.ts` and `console-dock.tsx`: `refill()` runs whenever the
  workspace changes size, once the saved layout is on screen, and after a switch of
  window mode.
- `lib/window-refill.test.ts`: 11 tests, with Doty's measured numbers. Proved red
  twice: without the "covers the screen" rule (the restored chat is not refit), and
  without the move to the top (the chat stays 17 px down a workspace scrolled only by
  its own overflow). Lint clean; the console's 489 lib and component tests pass.
  Typecheck not run (Brandon: leave it for now).

Found on the way: the browser I drive is hidden, and a hidden page gets no resize
events at all (measured: `visibilityState` "hidden", no `requestAnimationFrame`).
That is the test harness, not the product.

## Confirmed by

P01 on screen, 2026-10-08 (sparx): Messages › Renée Castañeda, reloaded. The chat
pane measured 1373 × 961 px in a workspace of 1374 × 962 px, at its top-left, with no
scroll bars. The tabs at the top and Send, Quick replies and "Enter to send" at the
foot were all in sight. Before the fix it measured 1020 px tall in a workspace that
showed 947 px.

## Rating effect

—
