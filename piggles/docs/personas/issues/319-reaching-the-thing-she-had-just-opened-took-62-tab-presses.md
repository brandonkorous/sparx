# 319 — Reaching the thing she had just opened took 62 tab presses

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · the keyboard-only standing check
**Surface:** mypiggles › the whole console chrome
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** driven as Devi on 2026-08-29 — the control appears at Tab 2 and lands focus in the workspace

## What happened

Doing the standing check that says one full job per run is driven by keyboard alone,
Devi opened Marlow Knit with ⌘K and Enter — which worked, first try — and then pressed
Tab to start work.

**Sixty-two Tab presses later, focus entered the pane.** It arrived on "Take off sale".

Counted along the way:

| Presses | Where focus was                                        |
| ------- | ------------------------------------------------------ |
| 1       | a control at the bottom-left of the rail               |
| 11      | still climbing the rail — "Recent"                     |
| 21      | still in the rail — Bookings                           |
| 33      | the **close button of another pane's tab**             |
| 53      | still in the pane tab strip, now at its right-hand end |
| 62      | the pane at last: "Take off sale"                      |

Nothing was broken. Every control was reachable, the focus ring was visible and crisp,
tooltips appeared on focus rather than only on hover, the tab strip auto-scrolled to
follow focus, and the pane's own tabs used arrow keys with Enter to activate — the
correct pattern. It was simply so far away that using the keyboard stopped being a way
anybody would work.

## What should have happened

The keyboard reaches the work in a few presses. That is what a skip control is for, and
this console had none: F6 does nothing either.

## How to reproduce

Every time.

1. Open any record in the console.
2. Press Tab and keep counting.
3. Focus walks the rail (~15 stops), then the pane tab strip (three stops per open pane
   — name, pin, close), then reaches the pane.

**It gets worse the more you have open**, which is backwards: the person with ten panes
open is the person working hardest, and they pay three extra presses per pane.

## Why it matters

**Piggles' own audience is the reason this is not a compliance exercise.** The persona
brief names a 61-year-old on a phone in a workshop; tab targets and focus are the product
working for the person it was written for. Sixty-two presses is not a keyboard interface.

**Thirty of those presses are spent on close buttons.** To reach your own work you tab
past a control that discards somebody else's pane, once per open pane. One stray Enter
and a pane is gone.

Filed `minor` rather than major, plainly: the job CAN be finished by keyboard, and it was
— see below. What is broken is that nobody would.

## Where it lives

[piggles/apps/workbench/components/desktop-shell.tsx](../../../../piggles/apps/workbench/components/desktop-shell.tsx)
— the shell's order is rail, then dock (whose tab strip precedes pane content), with
nothing in front of either.

## The fix

**A skip control**, in [skip-to-workspace.tsx](../../../../piggles/apps/workbench/components/skip-to-workspace.tsx):
near the front of the document, invisible until focused, and it moves focus into the
`<main>` that holds the dock. A button rather than an `#anchor`, because panes mount and
unmount under a dock — moving focus is a thing to do, not a place to link to.

**What it skips, precisely, because it is not everything.** It jumps the rail, about
fifteen stops. It does **not** jump the pane tab strip, which lives inside that same
`<main>`. Landing past the strip means targeting the ACTIVE pane's body, and which body
is active is dockview's to say rather than the shell's — a dock change, not a chrome one.
That half is left undone on purpose rather than faked with a `querySelector` that would
take the first pane in the DOM and be wrong whenever that is not the one in front. Both
the code comment and this issue say so, so the next person does not read the control as
solving more than it does.

### Two attempts that did not work, recorded because the reason is reusable

`sr-only` + `focus:not-sr-only` was the obvious approach and rendered the control
**clipped through its own text**: `sr-only` collapses the box to 1px, and `not-sr-only`
restores `position: static` and `padding: 0`, which then argue with silica's `.btn`
padding and with the fixed positioning. `-translate-y-[200%]` + `focus:translate-y-0`
left it invisible at every stop. What works is one property — `fixed -top-20` with
`focus:top-2` — which leaves the button's own box completely alone.

## What this does NOT fix

**The tab strip still precedes pane content**, as above: roughly 35 presses rather than
62 on a console with eleven panes open.

**Ctrl+S does not save.** Pressing it put an `s` into the price field instead. The field
sanitized it away on blur, so nothing bad was stored, and this may be an artifact of how
the automation delivers modifiers rather than real behaviour — recorded as observed, not
as proven.

**The reopened pane lands at the end of the strip**, not in the position it was closed
from. Noted while checking Restore; not filed, because reopening and re-placing are
different promises and only the first is made.

## Confirmed by

Driven as Devi on 2026-08-29, keyboard only from ⌘K to a saved record.

**The job itself, without a mouse:** ⌘K → typed "Marlow" → Enter opened the product →
Tab to the pane tab list → Right Right to Variants (focus moved, panel did not, which is
the correct manual-activation pattern) → Enter to activate → Tab to the **XS · Oat** row,
which took a clear white focus ring around the whole row → Enter expanded it → Tab into
Price → typed 102.00 → Shift+Tab back to Save → Enter.

Every unsaved signal fired at once and every one of them cleared on save: an "Unsaved"
badge on the row, "1 version has unsaved changes." above the list, a dot on the Variants
tab, a dot on the pane tab, "Not saved: Marlow Knit" in the status strip, and the Save
button going from grey to live. After saving: "Version saved" and "Saved", every marker
gone, status strip "Saved just now". The database agrees — `MARLOW-KNIT` is `10200`.

**The skip control:** reloaded, pressed Tab twice, and "Skip to what you are working on"
appears top-left as a full primary button with a focus ring, unclipped. Enter puts focus
in the workspace; the rail is gone from the path.

**Restore**, the other standing check, in the same pass: closed the Site layout pane, its
tab vanished and the strip re-flowed; opened **Recent** from the rail, which listed it;
clicking it brought the pane back, showing the Archive site's header with
`site.account-link` still in the layer tree and "Saved and live". The whole arrangement
also restores on reload — eleven panes came back in order on every navigation this
session.

## Rating effect

No pane's score moves; this is the chrome rather than any one surface.
