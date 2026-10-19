# 264 — A board "kept to you" was open to everyone

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · the search work for issue 261 (checking who may see a board before putting its name in search)
**Surface:** Customers › Boards, and Build a report, sparx console and Piggles (one API)
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** sparx as Mike, 2026-10-14
**Blocked on:** —

## What happened

The new-board form has a switch, "Share it with your team", that says: "Everyone can
open it. Off keeps it to you." Doty's boards and reports store who made them
(`ownerId`) and whether they are shared (`shared`).

Nothing reads either one. `GET /v1/crm/dashboards` and `GET /v1/crm/reports` list every
board and report in the business, private or not, and the services open, change and
delete any of them for any teammate. A board Doty kept to himself is on Mike's, Kendra's
and Alyssa's screens too.

The same kind of promise sits on two other CRM screens and must be checked the same
way: a saved view ("Everyone sees it and can use it; only you can delete it") and a
saved paragraph ("off for something only you would ever send").

## What should have happened

A board or report with sharing off is seen, opened, run, changed and deleted only by
the person who made it, in its list, in search, and on any shared board that shows it.

## How to reproduce

1. As Doty, make a board with "Share it with your team" off.
2. Sign in as Mike (editor). The board is in his list.

## Why it matters

A promise about who can see something is a privacy promise. An owner keeps a board
private because of what is on it.

## Where it lives

- `wizeworks/packages/crm/src/services/dashboard-service.ts`, `report-service.ts`, and
  their routes in `wizeworks/services/api-rest/src/routes/v1/crm/report-builder.ts`.
- Search: the `report` and `dashboard` projectors added for issue 261 index every row.

## The fix

**One rule, one place.** `wizeworks/packages/crm/src/services/owner-visibility.ts`: a row
is visible when it is shared, when it has no maker (the ready-made reports, older rows),
or to its maker. A caller with no person behind it sees only shared and no-maker rows.

|                                          | Its maker   | A teammate                                                                       |
| ---------------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| List boards and reports                  | in the list | not in the list                                                                  |
| Open, change, delete, lay out, run, copy | allowed     | "not found" (404), exactly like a missing row, so its existence is not confirmed |

- **A private report on a shared board:** teammates get the card's place and size but
  not its name, words or numbers. The card shows a lock and "This card shows a report
  kept private by the person who made it.", with only the width and remove controls.
  Adding a private report to a shared board warns first: "This report is kept to you,
  so teammates who open this board will see its card but not its name or numbers."
- **The board Dashboards opens on** is chosen from the boards the viewer can see. It is
  one slot for the whole business, so only a shared board can hold it: the server
  refuses a private default ("Only a board shared with your team can be the one
  Dashboards opens on, because it opens for everyone."), and the form moves the two
  switches together (turning "Open this board first" on shares the board; turning
  sharing off stops it opening first), each saying so. A board already left private and
  default by an older version can still be renamed.
- **Search:** board and report entries carry `visible_to` (`everyone`, or the maker), and
  "Search everything" matches them only for those viewers. A shared board's search words
  leave out the names of private reports on it.
- **The other two promises:** saved views already kept private views private; changing
  or deleting someone else's private view now answers "not found" rather than "only the
  person who made this view…", which confirmed it existed. Saved paragraphs did NOT keep
  their promise: change, delete and use-count ignored the owner. Fixed; private
  paragraphs are their owner's alone. Saved emails (templates) had the same gap and were
  fixed the same way.

Tests, each red first: crm `private-boards-and-reports.test.ts` (18, including the
default-board rule), `owner-visibility.test.ts` (7), `private-paragraphs-and-views.test.ts`
(6); search and commerce `kept-to-you-search.test.ts` (4 each); both consoles'
`report-privacy.test.ts`, `report-widget-private.test.ts` and
`dashboard-board-switches.test.ts`. crm services 421/421; both consoles' CRM folders
green; crm tsc clean.

## Confirmed by

- sparx as Doty: a new board "Doty's cash notes" with "Share it with your team" off.
  Turning on "Open this board first" turned sharing on too; turning sharing off turned
  "Open this board first" off. Saved private (`shared = false`); its search entry is
  visible only to Doty, and Doty's "cash notes" search finds it.
- sparx as Mike: the board's own link says "That dashboard is no longer here". "cash
  notes" in "Search everything" finds no board. His board menu lists only "Monday
  numbers".

## Rating effect

—
