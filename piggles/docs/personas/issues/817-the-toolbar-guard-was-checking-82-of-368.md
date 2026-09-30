# 817 — The toolbar guard was checking 82 of 368

**Status:** fixed
**Severity:** copy (219 toolbars) + a guard that was reporting green over them
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles + sparx workbench — 219 panes across both consoles
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** the guard, now at 368 toolbars across both consoles, proved red
**Blocked on:** —

## How it was found

Devi's tab said **Build a report**. `check:toolbar-names` was green. The
toolbar's `label` — the bar's accessible name, and the heading its overflow
popover prints on a phone — said:

> Report library controls

A phrase that appears nowhere else in that console, naming a screen which does
not exist in it.

## Two holes, and the second was bigger

**1. It checked only the RENAMED panes.** The guard's own header said why:

> A pane with no vocabulary entry keeps the platform title and is not checked —
> the absence of an entry is the honest statement that the platform's own name
> was already right, and this guard has no second name to compare against.

It has one. The catalog `title` is what the tab shows. `crm.report.library` is
titled "Build a report" and was never renamed, so nothing ever looked at it.
**The rename is where this risk is concentrated, not where it lives.**

**2. It scanned one console.** Exactly the way `check-toolbar-primary` did
until 2026-09-19, which `pane-toolbar.tsx` complains about in its own header:
_"It scans BOTH consoles. It did not until 2026-09-19 — it computed its scan
root from its own location inside piggles/scripts."_ The same file, the same
mistake, a second time.

Measured the moment both holes closed:

|             | toolbars | disagreed with the tab | had been checked |
| ----------- | -------- | ---------------------- | ---------------- |
| **piggles** | 182      | **79**                 | 82               |
| **sparx**   | 186      | **140**                | 0                |
| total       | 368      | **219**                | 82               |

**219 of 368**, under a guard printing green.
[[feedback_structural_checks_go_blind]]

## What it was saying

| the tab says         | the popover said              |
| -------------------- | ----------------------------- |
| Tickets and licenses | Certification controls        |
| People               | Roster controls               |
| Modules              | App list controls             |
| Places               | Places list controls          |
| Sites                | Site list controls            |
| Repeating bookings   | Repeating booking controls    |
| Permissions          | Connected app access controls |
| Automation runs      | Run history controls          |

Some are a whole other word for the screen. Most are a singular where the tab
is plural, or a "list" the tab does not have. Both matter for the same reason:
on a narrow pane the bar folds into a popover and that string becomes the
heading a person reads.

All 219 renamed. Diffed against a copy taken before the sweep: **219 files,
438 changed lines, and not one line that is not a `label=`.**
[[feedback_codemod_diff_your_own_sweep]]

## The dashboards pane had no toolbar in three of its four states

Found on the same pass, looking at `crm.dashboards` on first run. The pane
returns early for loading, for a failed read and for "no board yet", and all
three returned **without a `PaneToolbar`** — so the screen a person meets
first had no name on it, no refresh, and none of the chrome every other pane
in this console keeps in every state.

`tasks-list.tsx` and `reports-library.tsx` each have exactly one `PANE_SHELL`
for that reason: the toolbar is the pane, and the states happen inside it.
`dashboards.tsx` had four.
[[feedback_copy_the_house_layout_before_building]]

The board picker and "Add a report" both need a board, so until there is one
the bar now carries what there IS: a way to make the first board, and a
refresh.

**And sparx had no failed-read branch at all.** The Piggles file carries a
comment explaining that one was added because an unreachable server rendered
as "you have no dashboards" — two facts, one answer. The fix had stopped at
one console. sparx has it now, in its own idiom.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## Proved red

Putting `label="Timesheet controls"` back on sparx's timesheets pane:

```
  Timesheets
    toolbar says  "Timesheet controls"
    should say    "Timesheets controls"
    /sparx/apps/workbench/surfaces/staff/timesheets.tsx

1 of 368 named toolbars disagree with the tab above them.
```

Green it reads: **368 named toolbars across both consoles carry the name of
the pane they sit in (420 pane names, 2 toolbars shared by several panes and
not checked).** Before this act it was checking 82.

The 2 unchecked are the dashboards panes in each console: `crm.dashboards` and
`crm.dashboard.detail` are one file under two titles, and with two names there
is no single right answer to guess at.

## Files

- `piggles/scripts/check-toolbar-names.mjs` — both consoles, catalog-title fallback
- 79 files under `piggles/apps/workbench/surfaces/`
- 140 files under `sparx/apps/workbench/surfaces/`
- `piggles|sparx/apps/workbench/surfaces/crm/dashboards.tsx`
