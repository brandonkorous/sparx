# 843 — On a phone, the only way out of one pane was to close them all

**Status:** fixed
**Severity:** a missing control with no second route, and two counts drawn for one kind of person
**Found by:** P03 · Juniper Row · act 289
**Surface:** Compact console at 390px
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** driven at 390px in a narrow frame, with 374 panes open

## Closing one thing

The phone has no tab strip. What you have open lives behind the **Open** tab on
the bottom bar, as a sheet: one row per pane, its app's glyph, its name, a dot
for the one you are looking at. Tap a row and you switch to it.

Nothing closed one.

The sheet's footer has **Close everything**, and that was the entire set of
exits. A pane's own overflow menu carries the record's actions — on a cost it
read _Mark as paid · Refresh this list · Copy a link to this_ — and the header
above it carries the share button and the account menu. There is no swipe, no
long press, no gesture:

```
$ grep -rn "requestClose" piggles/apps/workbench/components/mobile
open-sheet.tsx:105:   const closed = await controller.requestClose(paneId);   ← close everything
```

One call site, inside the loop that closes all of them. So on a phone, getting
out of one pane meant getting out of all 374.

### The other console has had the answer from the start

`sparx/apps/workbench/components/mobile/open-sheet.tsx`, on every row, with its
reason written next to it:

> Closing ONE pane. The strip this replaced put a × on the active chip, so
> dropping it would make "close just this" impossible on one column — the stack
> has no other close affordance.

That is an exact description of what then happened in the other tree.
[[feedback_a_fix_leaves_its_neighbour_behind]]

Ported, with this console's own row shape kept (it carries a focus dot the other
does not). **Measured at 390px:** 374 close buttons, each named for its pane —
`Close Thread, interfacing and buttons, local haberdashery` — each **52 × 52px**,
sitting apart from the switch target so a thumb aiming at one cannot land on the
other. It goes through the controller, so unsaved work still asks.

## Finding one thing

The sheet's own header says what it is for:

> A sheet shows every pane, full width, with the app each one belongs to — so
> "which of these is the invoice" is answerable without opening them.

That is true of eight rows and false of eighty. There was no filter: 374 rows
and a thumb.

The desktop's jump list over this exact list has had a search field for as long
as it has existed (issue 842 put it back on screen). The phone had none.

A field now appears **once the list is longer than eight rows**, which is about
one thumb-screen of this sheet, so the ordinary case of five panes pays nothing
for it. Reopening always starts from everything, because a filter left behind
the button reads as "half my panes vanished." Both consoles.

## Two counts drawn for one kind of person

The bottom bar's **Open** tab carries a badge. On this account it read **374**.

```
button  aria-label="Open"
badge   374          ← a sibling of the button, joined to it by nothing
```

The badge is not inside the button, so it is not hidden the way the rail's
waiting badge was in issue 839 — a screen reader meets "Open, button" and then,
separately, a loose "374". It is there and it is unattached.

Same shape on the phone's app grid, which draws the same waiting counts the rail
does: a tile named `Invoices` with a `9` floating in its corner.

Both now carry the number in the control's own name, in the words the rail
already uses. **Read back off the screen:**

```
Open, 374
My Site, 2 waiting     Sell, 2 waiting     Stock, 3 waiting
```

Tiles with nothing waiting keep their plain name. The visible word starts the
name in every case, so saying "Open" or "Invoices" out loud still works.

## What 390px gets right

Measured rather than assumed, because most of this is good.

|                      |                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **The bar**          | four buttons, each exactly **44 × 44px** — the floor its own comment claims, and it claims it correctly             |
| **The work**         | the pane body stops at y=708 and the bar starts at y=732. It looked covered in a still frame; it is not             |
| **The sheets**       | grow out of the bar and fold back into it, and never cover it — you go from Open to All without dismissing anything |
| **Close everything** | confirms, counts ("Close all 374?"), and names how many have unsaved edits before it starts                         |
| **All apps**         | 340px wide in a 386px frame, one column, sixteen headings, **no sideways scroll**                                   |
| **A form**           | full-width fields, real helper text under each, required marks, nothing under 16px                                  |

## Measured, not swept

Neither this sheet nor the desktop's jump list virtualizes its rows. At 374
panes the sheet builds 748 controls at once and the browser tab visibly
struggles with it. At any number a business would actually have it is
instantaneous, and the search field added here is the thing that makes the long
case survivable, so this is recorded rather than optimized.

## Files

- `piggles/apps/workbench/components/mobile/open-sheet.tsx`
- `piggles/apps/workbench/components/mobile/nav-bar.tsx`
- `piggles/apps/workbench/components/mobile/app-grid.tsx`
- `sparx/apps/workbench/components/mobile/open-sheet.tsx`
- `sparx/apps/workbench/components/mobile/nav-bar.tsx`

## The thing to remember

**When one presentation drops a control, check whether anything else offers it.**
The desktop has five ways to close a pane — the tab's ×, the group menu, the
jump list row, the keyboard, the layouts menu — so losing one there is a
nuisance. The phone had one, and it was the one that closed everything.
