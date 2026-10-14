# 166 — The chat's Send button was under the corner buttons

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 10 (a customer message answered)
**Surface:** workbench › Messages › a conversation (the reply box); same in Piggles
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08 (sparx)
**Blocked on:** —

## What happened

Doty opened Renée Castañeda's chat, full width. Under "Write a reply…" there was no
Send button. The workspace's two corner buttons (the size glass and the tidy menu)
sat in the bottom-right corner. Measured on the page: Send was at 1319 to 1403 px
across, and the corner buttons cover 1347 to 1392 px. When Send scrolled into view, it
was under them.

Enter sends, and the box says so, but only at wider sizes.

## What should have happened

The Send button is visible and can be clicked, like the last thing on every list's
footer.

## How to reproduce

1. As Doty, open Messages › any conversation.
2. Make the pane full width, or dock it against the right edge.
3. Every time.

## Why it matters

The one button a reply needs is hidden at the moment he answers a customer.

## Where it lives

- `sparx/apps/workbench/surfaces/chat/thread.tsx`, `Composer`: the button row ends
  with `Send` pushed right (`ml-auto`), and nothing keeps it clear of the corner.
- `sparx/apps/workbench/components/canvas-corner.ts`: `CANVAS_CORNER_CLEARANCE`, the
  room the list footers keep for the same buttons (issue 772, and the footer fix that
  followed). The reply box is not a list footer, so neither fix reached it.
- Piggles: the same composer.

## The fix

- The chat composer's button row (`chat/thread.tsx`, both consoles) reserves the
  corner with `CANVAS_CORNER_CLEARANCE`, the one rule the list footers use.
- The neighbor: the feedback thread's reply box (`feedback/feedback-thread.tsx`, both
  consoles) is the same shape, pinned to the foot with "Send reply" on the right. Same
  fix.
- `components/list-footer.test.ts` (both consoles) gains a guard: every `<form>` pinned
  to a pane's foot (`shrink-0`) must use `CANVAS_CORNER_CLEARANCE`. Red in both
  consoles before the fix, naming exactly these two files; green after. Lint clean.
  Typecheck not run (Brandon: leave it for now).
- The pane itself also ran off the bottom of the screen, which hid the whole row:
  that is a separate defect, issue 167.

## Confirmed by

P01 on screen, 2026-10-08 (sparx): Messages › Renée Castañeda, full width. Measured:
Send at 1175 to 1259 px across, the corner buttons from 1325 px, so 66 px clear; the
row's right padding 144 px. Doty typed his answer and clicked Send with the mouse;
the reply appeared as "You 11:04 PM".

Not checked on screen: the feedback thread and the Piggles console.

## Rating effect

—
