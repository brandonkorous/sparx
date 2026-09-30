# 693 — The only thing on the menu with no name

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 243
**Surface:** mypiggles + sparx — Making things › a run; the pane toolbar overflow
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen — before and after
**Blocked on:** —

## What happened

Devi docked the run pane beside the stock breakdown, which made it narrow, which
folded its toolbar into the overflow menu. She opened the menu to call the run
off and got:

> **Run actions**
> 🚫
> ↻ Refresh this list · 9 seconds ago
> 🔗 Copy a link to this

A bare red circle-slash, above two rows that wear their names. The one item with
no label was the destructive one.

## Why

`PaneToolbar` has two slots that both take secondary things, and they behave
differently on a narrow bar:

- **`controls`** RELOCATES. The popover renders the same nodes the wide bar does.
- **`actions`** are declared as VALUES and re-authored in the popover as labelled
  rows.

The cancel button was hand-written JSX in `controls`:

```tsx
<Button size="sm" variant="ghost" color="danger" shape="square" aria-label="Call this run off">
  <Icon glyph={faBan} className="size-4" aria-hidden />
</Button>
```

`aria-label` gives a screen reader the name. It gives a sighted person nothing.
In a bar that is survivable because POSITION carries meaning and a tooltip covers
the rest; in a menu there is no position to read and no hover on a touch screen.

Both of the files involved say this in their own headers:

> "an unlabelled glyph is a button with no meaning. Those two controls now take
> `presentation="menu"` and wear their labels."
> — `pane-toolbar-overflow.tsx`

> "narrow — icon only in the bar is NOT an option — that is the bug."
> — `pane-toolbar-actions.tsx`

The problem was named, the mechanism was built, two controls were converted, and
this one was left in the other slot. [[feedback_a_fix_leaves_its_neighbour_behind]]

## Why it was left behind, which is the interesting part

`ToolbarAction` had no destructive tone. Every action rendered `color="module"`.
So the only way to give **Call it off** / **Delete** / **Disconnect** the `danger`
color RULE #4 requires was to hand-write the button — and hand-written buttons
go in `controls`, the slot that loses its name.

**A missing option in the shared component was quietly pushing every destructive
action into the wrong slot.** That is a single-point-of-change failure, not a
call-site one, and patching this one pane would have left the pressure in place.

## What was changed

- `ToolbarAction` gained `tone?: 'danger'`, honored by both the bar renderer and
  the menu-row renderer.
- The run's cancel moved from `controls` to `actions` in both consoles.
- sparx's copy of the pane had its whole toolbar in one `controls` fragment,
  including **Mark it made** — a commit action in the slot that relocates, against
  that toolbar's own hard rule ("A COMMIT ACTION IS ALWAYS `primary`"). Split into
  `status` / `primary` / `actions`.

## The sweep that was NOT done, and why

A probe over 382 panes found **23** icon-only controls in a `controls` slot. Three
were checked by hand and the hit rate did not hold up:

- **`cms/content-detail.tsx`** — false positive. The button's label is
  `{isScheduled ? 'Publish now' : 'Publish'}`, a JSX expression, which the probe
  cannot see as text.
- **`scheduling/calendar-toolbar.tsx`**, **`staff/schedule.tsx`** — real, but a
  different shape: paired previous/next PAGERS with a date between them. Two bare
  chevrons in a vertical menu is a problem, and labelling each one is not the fix;
  a pager does not belong in a menu at all.

So the remaining candidates need reading one at a time, not a codemod.
[[feedback_codemod_diff_your_own_sweep]] and the reason issue 685 added no
mechanical plural check: a sweep whose hit rate is unverified is how a correct
screen gets edited.

The `tone` option is what makes the rest of them a one-line move when they are
done, so the blocker is removed even where the work is not.

## Confirmed

Same menu, same width, after:

> **Run actions**
> 🚫 **Call this run off** (in danger red)
> ↻ Refresh this list
> 🔗 Copy a link to this

Pressed it. The confirm named the run, the run went to **Called off**, and the
held part came back.
