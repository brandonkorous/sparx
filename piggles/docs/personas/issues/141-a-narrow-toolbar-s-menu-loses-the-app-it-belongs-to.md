# 141 — A narrow toolbar's menu loses the app it belongs to

**Status:** fixed
**Severity:** minor
**Found by:** P02 · Halo & Hem · act 10
**Surface:** mypiggles › every pane's overflow menu, at 390px
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Three things, all in the one panel a phone gets instead of a toolbar.

**A button with no words.** The diary's "Linked outside calendars" is an icon
button with a tooltip, written as bespoke JSX in the `controls` slot — and
`controls` is RELOCATED verbatim into the popover. So on a phone that row was a
bare chain glyph, no label, above a labelled "Copy a link to this" wearing the
same glyph. PaneToolbar's own file says why this is wrong: "a menu has no
position to read and no hover on a touch screen, so an unlabelled glyph is a
button with no meaning." The `actions` slot exists precisely so a control can
wear its name there. This one was not using it.

**A control shoved against the right edge.** The Day/Week toggle carried
`ml-auto` to push itself right in the bar, and the class travelled with it into
a column of full-width rows, where an auto margin means nothing and looked like a
mistake.

**The wrong color.** `--color-module` is set by a `data-module` attribute, and
CSS custom properties cascade by DOM rather than by React tree — a fact
ModuleScope's own header records for panes rendered into another window. A
Popover's panel is portalled to the document body, outside the pane that set it.
So the same action was the Bookings teal in the bar and the brand's default pink
one tap later. On a narrow screen the popover version is the only one anybody
ever sees.

Alongside them: the resource picker read **"Everyone & equip"** at every width,
including inside a popover with room to spare — `max-w-40` is narrower than its
own default option.

## Where it lives

- [components/pane-toolbar-overflow.tsx](../../../apps/workbench/components/pane-toolbar-overflow.tsx)
- [surfaces/scheduling/calendar-toolbar.tsx](../../../apps/workbench/surfaces/scheduling/calendar-toolbar.tsx)

## The fix

Linked calendars moves from `controls` to `actions`, so the bar can give it its
name. The `ml-auto` goes: those five are one run of chrome and an auto margin in
the middle of a run only opens a gap. The picker's cap goes to `max-w-56`, wide
enough for its own default option and still capped, because a business may name a
chair a whole sentence.

The hue is read off the trigger — which IS inside the pane — at the moment of
opening, and stamped on the panel. One fix in PaneToolbarOverflow covers every
toolbar in the console rather than every toolbar remembering.

## Confirmed by

> Re-ran act 10 as Nia at 390px. The panel reads Today / ‹ › / Day|Week / Everyone
> & equipment / **Linked outside calendars** / Refresh this list / Copy a link to
> this — every row labelled, left-aligned, and the Week pill and the linked-
> calendars row both in the Bookings teal rather than pink.
