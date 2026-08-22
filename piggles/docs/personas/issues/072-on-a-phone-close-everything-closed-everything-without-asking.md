# 072 — On a phone, "Close everything" closed everything without asking

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Thistle & Rye · act 11
**Surface:** mypiggles on a phone › Open (the pane sheet) › Close everything
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P01 · Marisol · on screen 2026-08-21

## What happened

By act 11 the session had 67 panes open. The phone's **Open** sheet has a red
**Close everything** button at its foot. Tapping it starts closing them
immediately — no question, no count, no mention of unsaved work.

The desktop's equivalent, the same action from the layouts menu, has always
asked, and asks well:

> **Close everything and start empty?**
> Something here has unsaved edits — starting empty discards them. There is no undo.

Same action, same scope, and whether you get asked depended on which device you
were holding.

## What should have happened

It asks, and says how many. Destructive-actions-need-confirm is a CORE rule —
name the target and the count — and the desktop control already meets it.

## How to reproduce

1. On a phone-width console, open several panes.
2. Tap **Open**, then **Close everything** at the foot of the sheet.
3. They start closing. Every time.

## Why it matters

Small, but it is bulk and it is the one gesture that cannot be undone by another
gesture — a workspace is rebuilt pane by pane. And the inconsistency is its own
defect: a rule the product follows on one device and not the other is not a rule
anyone can rely on.

## Where it lives

- [components/mobile/open-sheet.tsx](../../../apps/workbench/components/mobile/open-sheet.tsx) — `closeEverything`
- [components/rail/layouts-menu.tsx](../../../apps/workbench/components/rail/layouts-menu.tsx) — `resetToEmpty`, which had it right

## The fix

The sheet asks first, through the same `useConfirm` the desktop uses, and counts
both things worth counting:

> **Close all 67?**
> 2 of them have unsaved edits, and you will be asked about each one on the way through.

or, when nothing is dirty:

> Nothing here has unsaved edits. Your saved layouts are not affected.

`controller.dirtyPanes()` already existed for the status bar's count, so the
number is measured rather than guessed.

## What the code already got right, and is now written down

The persona's note said it was **untested whether a dirty document is guarded**.
Reading `controller.requestClose` answers it: **it is**. A dirty pane holds its
guard conversation in its own window's dialog before closing, and returns `false`
if the operator keeps it — at which point the batch loop stops rather than closing
past it. The sheet then stays open showing what is left, instead of dismissing as
though the whole thing had gone through. All three behaviours were already
correct; only the upfront question was missing.

`group-actions.tsx`'s "Close everything in here" is deliberately **left without a
confirm**: it is scoped to one window's tabs, which are the panes you can see, and
each still holds its own unsaved-work guard. The complaint was about closing 67.

## Confirmed by

Re-run on 2026-08-21 at **390×844**, in an iframe harness rather than by resizing
the window. Three panes open; tapping **Close everything** at the foot of the Open
sheet now raises:

> **Close all 3?**
> Nothing here has unsaved edits. Your saved layouts are not affected.
> **[Close them]** [Keep them open]

The count is measured — three panes listed, "all 3" — and the clean-workspace
branch of the description is the one that rendered, correctly, because nothing was
dirty. Choosing **Keep them open** left all three panes exactly where they were.
