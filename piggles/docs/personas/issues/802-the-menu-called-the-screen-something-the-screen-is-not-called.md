# 802 — The menu called the screen something the screen is not called

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 280
**Surface:** mypiggles — 66 panes, console-wide
**Filed:** 2026-09-24
**Blocked on:** —

## What happened

Devi was on **What fits what** and opened the menu beside the search box. It
opened headed:

```
Compatibility list controls
  ✦ Starter library
```

Two words in one small popover that appear nowhere else in her console.
"Compatibility list" is the sparx category name for the screen she is standing
on, which is called **What fits what** on its own tab. And "Starter library" is
a library of starters: the button's own tooltip already said the plain thing,
**"Start from a ready-made list"**, and so did the empty state.

## Why

A pane's tab takes its name from `lib/console/vocabulary.ts`. Its toolbar
carries a separate `label=` written into the surface file, which is the
toolbar's accessible name AND the heading the overflow popover prints. Nothing
kept the two in step.

Counted, not guessed: **66 of the 81 named toolbars** in the Piggles console
introduced their screen under a different name than the tab above it.

```
Photos and files           ->  "Media library controls"
Start a repeat order       ->  "Subscriptions list controls"
Help requests              ->  "Support queue controls"
Baskets left behind        ->  "Carts list controls"
Batches and serial numbers ->  "Lots and serials controls"
Build-your-own             ->  "Configurator list controls"
What fits what             ->  "Compatibility list controls"
```

Every one of those left-hand names was written for this brand on purpose. The
right-hand ones are the words the brand exists to avoid, sitting one click
inside the screen that avoids them.

## What was done

Every toolbar now carries the name of the pane it sits in, in whichever of the
house's two shapes fits:

- a NOUN takes `"<name> controls"` — "Photos and files controls";
- a CLAUSE takes `"Controls for <name>"` — "Controls for what fits what",
  because "What fits what controls" does not read. Six labels already used that
  shape ("Controls for how people find you"); it is the house's, not a new one.

"Starter library" became **"Ready-made lists"**, the words the empty state and
the tooltip already used. In sparx the same button hid its label below `@xl`,
so a docked pane showed a bare sparkle with no name on it at all; it wears its
name at every width now.

## Two bugs in the sweep, both caught by reading its own diff

**It renamed one file four times.** Resolving a surface by BASENAME collided:
`reports.tsx` exists under commerce, crm, inventory AND scheduling, so four keys
pointed at one file and each pass overwrote the last, leaving
`surfaces/commerce/reports.tsx` labelled "How bookings are going controls". It
resolves by the catalog import's full path now.

**It gave seven list panes the name of a button.** `vocabulary.ts` exports two
maps keyed alike on purpose — the screen names and the create-button labels —
and the parse read both, so the last value won. The list of orders to suppliers
came out labelled "New order controls"; the list of repeat orders came out
"Start a repeat order controls". The parse is bounded to the screen-name map now
and asserts it did not run into the second one.

Both were found by diffing the sweep against a copy taken before it ran, which
is the only reason either is in this paragraph rather than in the console. Final
diff: **66 files, 66 lines, every one of them a `label=`**.

## Guard

`pnpm check:toolbar-names` (new), which pairs each pane's vocabulary name with
its surface file by the catalog's own import path and accepts either house
shape. A pane with no vocabulary entry keeps the platform title and is not
checked — there is no second name to compare against.

Proved red four ways:

| broken thing                                             | what it printed                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| one old label put back                                   | `✗ What fits what / toolbar says "Compatibility list controls"` |
| the scan root pointed at a directory that does not exist | `✗ the screen-name map is not at …/apps/nope/…`                 |
| the screen-name floor raised past the real count         | `✗ only parsed 120 screen names`                                |
| the two vocabulary maps allowed to run together          | `✗ the two vocabulary maps ran together`                        |

The last two are the ones that matter: they are this sweep's own two bugs, and
the guard now fails on both rather than printing green over them.

## Files

- `piggles/scripts/check-toolbar-names.mjs` (new)
- `package.json` — `check:toolbar-names`
- 66 files under `piggles/apps/workbench/surfaces/`, one line each
- `piggles|sparx/apps/workbench/surfaces/commerce/fitment-list.tsx`
