# 714 — A control that loses its name on the way into the menu

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 250
**Surface:** mypiggles + sparx — Stock › Counts from elsewhere › a source
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: the menu reads Pause / Sync now / Remove
**Blocked on:** —

## What happened

Devi opened her **Lyon workshop spreadsheet** source. Under "How often should it
update?" it said:

> How often we fetch on our own. **You can always pull the latest at any time
> with Sync now.**

Her schedule is set to **Only when I ask**, so "Sync now" is the only way numbers
ever arrive. The toolbar showed: a status badge, a greyed **Save**, and a
hamburger. Opening the hamburger:

```
Stock source actions
 ⏸          <- no label
 ↻          <- no label
 🗑          <- no label, red
─────────────
 ↻  Refresh this list      13 hours ago
 🔗 Copy a link to this
```

Three bare glyphs, above two properly labelled rows. The words "Sync now" were
nowhere on the screen.

## Why it matters

The overflow popover is the ONE place a label is the entire point — it is a menu.
And the two least important items in it were the two that had one.

The rule is written down, in the file the buttons import from:

> **WHAT THIS IS NOT.** It is not permission to put icon-only controls in a
> toolbar. Two different actions rendered as two identical glyphs are ambiguous
> to a SIGHTED person too, and an accessible name does nothing for them — those
> belong in the overflow popover **wearing their labels as rows**.
> — `components/action-label.tsx`

And again, in the component that renders the popover:

> a control RELOCATES: in the overflow popover it arrives as a bare red glyph
> with no row label, because only `actions` are re-authored as labelled rows
> there.
> — `components/pane-toolbar-actions.tsx`

`source-detail.tsx` hand-wrote its three buttons into `controls`, which folds
into the popover **verbatim**. `ActionLabel` parks a name with `sr-only` and
brings it back at `@lg` — a CONTAINER query — and the popover is a narrow
container, so inside it the name was `sr-only` at every window size, for ever.

MEASURED across both consoles: 370 panes pass `controls`, 187 pass `actions`.
Only **3 files** hand-write a NAMED button into `controls`. This was two of them.

## What was done

The three are declared as values. The popover re-authors them as labelled rows,
which is why the prop exists.

```tsx
actions={[
  { label: source?.status === 'paused' ? 'Turn on' : 'Pause', … },
  …(type === 'agent' ? [] : [{ label: 'Sync now', title: 'Fetch the latest numbers right now', … }]),
  { label: 'Remove', title: 'Remove this source', tone: 'danger', … },
]}
```

**sparx had the rule exactly backwards.** Its copy of this pane put **Pause** in
`primary` and **Save** in `controls` — so the commit action was the one that
could vanish under 672px, which is the failure `check:toolbars` exists to stop.
It was one of the 21 files pinned in that check's `SPARX_DEBT`. Fixed and
unpinned: **21 → 20.**

**Two more on this pane.**

_The list stopped explaining itself once it had a row._ The sentence saying what
a "source" IS lived only in the empty state. Units, How stock is valued and
Spending limits all keep their sentence whichever way the list goes, and this is
the one whose word is jargon. It now stays.

_And the check that found this was itself a boundary break._ `check:toolbars`
scans both consoles and was living in `piggles/scripts/`, so a file under
`piggles/` named 21 sparx paths — which is precisely what `check:boundaries`
exists to stop. It was red. Moved to `scripts/`, where the platform's other
checks live. Both checks pass.

## Files

- `piggles|sparx/apps/workbench/surfaces/inventory/source-detail.tsx`
- `piggles|sparx/apps/workbench/surfaces/inventory/sources-list.tsx`
- `scripts/check-toolbar-primary.mjs` — moved from `piggles/scripts/`, one fewer
  pinned

## Proof

The menu now reads **Pause / Sync now / Remove**, each with its word, the middle
one in the module hue and the last in danger red. The sentence promising
"Sync now" names something that is on the screen.
