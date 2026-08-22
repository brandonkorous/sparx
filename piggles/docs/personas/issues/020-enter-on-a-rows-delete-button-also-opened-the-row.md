# 020 — Enter on a row's Delete button also opened the row

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Thistle & Rye · act 7 — reading the code while building the delete in #016
**Surface:** mypiggles › My Site › Page, and My Site › Email designs
**Filed:** 2026-08-20
**Fixed:** 2026-08-20
**Confirmed by:** P01 · Marisol · on screen 2026-08-21
**Blocked on:** —

## What happened

The page list and the email list are keyboard-operable tables: each row carries
`role="button"`, `tabIndex={0}` and an `onKeyDown` so Enter or Space opens the
document. Each row also carries two buttons of its own — **Open alongside** and
**Delete**.

Tab to a row, tab again to its Delete, press **Enter**. Two things happen:

1. The button activates — the confirm dialog opens. Correct.
2. The keydown bubbles to the row, which opens the document **behind the dialog**.

So the page opens while she is being asked whether to delete it. Same for Space,
which is worse: the row calls `event.preventDefault()` on it.

A mouse never showed this, because the row's own click handler was already being
stopped by the buttons. Only the keyboard path was open.

## What should have happened

A press that lands on a control inside the row belongs to that control.

## How to reproduce

Before the fix:

1. **My Site → Page**. Click a row once to give it focus, then Tab twice to reach the
   Delete button.
2. Press **Enter**. The confirm appears — and the page opens behind it.

## Why it matters

Small in isolation and it is on the destructive control, which is where a surprise
costs the most: the dialog she is reading is now on top of a screen that changed
underneath her. It is also in a SHARED helper, so it is two lists today and every
list that adopts the helper tomorrow.

## Where it lives

`piggles/apps/workbench/surfaces/studio/row-open.ts` — `rowOpenProps`, used by
`page-row.tsx` and `email-row.tsx`. It checked the KEY and never the target.

## The fix

One guard, in the shared helper, on both handlers:

```ts
function fromControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('button,a,input') !== null;
}
```

Applied to `onClick` as well as `onKeyDown`, which also removes the need for each
button to call `stopPropagation` — the row now declines events that are not its own,
rather than every control having to remember to fight it off.

## Confirmed on screen — 2026-08-21

Driven on **My Site → Page**, on the "What we bake" row.

| press                            | before      | now                            |
| -------------------------------- | ----------- | ------------------------------ |
| Enter on the row's Delete button | page opened | **nothing** — the row declines |
| Space on the row's Delete button | page opened | **nothing** — the row declines |
| Enter on the row itself          | page opened | page opened — unchanged        |

The third line is the control, and it matters: without it "nothing happened"
proves only that nothing was listening. Enter on the ROW put `pageId`
`3b28d635-…` into the `builder.page` pane and re-titled it "What we bake", so the
handler is live and the events reach it. The same events on the Delete button now
travel no further than the button.

### The limit of this confirmation, stated plainly

The browser bridge in this session **would not deliver OS-level keystrokes to the
page** — an armed `keydown` listener recorded nothing for a real `a`, `Tab` or
`Enter`, and screenshots were failing the same way. The presses above are DOM
`KeyboardEvent`s dispatched at the real controls on the real screen, which is a
faithful test of the propagation contract this issue is about (React handles
dispatched events exactly as it handles the browser's own).

What that CANNOT show is the browser's own Enter→click default on the Delete
button, since a dispatched key never produces one. So the confirmed half is the
half that was broken — the row no longer answers a press aimed at its controls.
The Delete button's own activation is browser default behaviour and was never
touched by the fix; it is confirmed by mouse, and Tab-order traversal is still
owed to the keyboard-only standing check whenever the bridge can type again.

## Rating effect

None recorded — the pane's Ease score was taken with a mouse, and this defect is
invisible to one.
