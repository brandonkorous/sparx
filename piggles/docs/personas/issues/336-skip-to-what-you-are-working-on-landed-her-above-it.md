# 336 — "Skip to what you are working on" landed her above it

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · the standing check — one full job by keyboard alone
**Surface:** mypiggles › the console shell, from the first Tab
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** driven as Devi with no mouse — two Tabs and Enter now reach the pane's first control

## What happened

Doing this run's keyboard-only job — Home says _"Send your first invoice"_, so
that is the job — the console's skip control does exactly what it was built to
do. One Tab from a fresh load (the first stop is the Next.js dev overlay, which
does not exist in production) and **Skip to what you are working on** slides on
screen. Enter, and focus lands on `<main id="workspace">`.

Which is the workspace, and not what she is working on.

`<main>` holds the **pane tab strip** as well as the panes. Devi has **29 tabs
open**, and each costs three stops — name, pin, close. Counting the focusable
controls inside `#workspace`: **158**. So the control whose label says it skips
to the thing you are working on leaves about a hundred stops between her and the
Invoices pane it just opened.

## What should have happened

The control lands on the pane in front. That is what the words on it say.

## Why it happened, and why it was left

Not an oversight — the file said so, in its own header:

> It does NOT jump the pane tab strip… Landing past them means targeting the
> ACTIVE pane's body, and which body is active is dockview's to say rather than
> this shell's — a dock change, left deliberately undone rather than faked with a
> `querySelector` that would take the first pane in the DOM and be wrong whenever
> that is not the one in front.

The objection is right about the thing it rejects. A `querySelector` for the
first pane in the DOM IS wrong, and would be wrong most often for somebody with
enough panes open to need the control.

**But it is not the only selector available.** Dockview marks its focused group
`.dv-active-group` and maintains it as the active panel changes — the same state
the console already reads through `api.activePanel` in four places to tell the
controller which pane is active. Asking the dock which body is in front is not
faking it; it is the dock saying so, which is what the header asked for.

## The fix

```ts
const ACTIVE_PANE_BODY = '.dv-active-group .dv-content-container';

export function focusActivePane(): void {
  const body = document.querySelector<HTMLElement>(ACTIVE_PANE_BODY);
  const target = body ?? document.getElementById(WORKSPACE_ID);
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus();
}
```

`tabindex="-1"`, not `0`: the pane body must be able to RECEIVE focus without
becoming one more stop in the Tab order, which would have added a press to every
pass rather than removing a hundred.

**Falls back to `<main>`** when no group is active — a console with nothing open
has no pane to be in, and the workspace is the right place to land.

## Confirmed by

Driven as Devi, no mouse, from a fresh load of the Invoices pane:

| Press | Lands on                                     |
| ----- | -------------------------------------------- |
| Tab   | the dev overlay (not present in production)  |
| Tab   | **Skip to what you are working on**          |
| Enter | `div.dv-content-container` — the active pane |
| Tab   | **Search invoices**, focus ring visible      |

Before it, the same three presses landed on `<main>` with the strip still ahead.

Both branches proved: with `.dv-active-group` removed from the DOM the selector
returns null and `#workspace` is still there to catch it; restored, the pane body
resolves again.

## Not done here

**The same control exists in the other console's shell** and has the same
one-line problem. That tree is not mine to edit, so this is the note that it is
worth the same change.

## Rating effect

Against the console shell rather than a pane. [319] measured 62 Tab presses to
reach a pane and the skip control answered the rail half of it; this is the other
half, and it only shows up on somebody with a working session's worth of tabs
open.
