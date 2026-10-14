# 240 — A record type that does not exist drew a working, empty list

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · pane ratings (a "Projects" list still in Doty's saved layout)
**Surface:** Customers › a record type's list (`/crm/records/<type>`), sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** P01, 2026-10-13, the Projects list in Doty's workbench (light, dark, 360px) and a new Project form
**Blocked on:** —

## What happened

Doty's saved layout holds a list for a record type called `project`. Gillett has no
such type: Record types lists only the four that come with sparx (Companies, Customers,
Deals, Requests), and the database has no `project` row.

The pane still opened as a working list: a search box, Views, an "Add record" button,
"0 in total", and an empty state that said "No records yet. You made this record type
up, which means nobody else's software has it. Add the first record and it will show
here." Every word of that is wrong for a type that is not there.

The pane fetches the type (`GET /v1/crm/objects/project`), and that request fails with
"not found". Nothing on screen reads the failure: the title falls back to "Records" and
the label to "record", so a missing type renders exactly like a real, empty one.

## What should have happened

The shared "gone" state every other pane uses: "That record type is no longer here. It
has been deleted, or the address points at something that is not in this business.
Nothing of yours has been lost." No search, no Add button.

## How to reproduce

1. Open `/crm/records/project` on a business with no `project` record type (or delete a
   record type while its list is in a saved layout).
2. Read the pane.

## Why it matters

The screen invites the owner to add records to something that does not exist. A button
that cannot work, under words that promise it will, is the worst kind of broken: it
looks fine.

## Where it lives

- `sparx/apps/workbench/surfaces/crm/records-list.tsx`: reads `type.data` (for the
  built-in redirect and the labels) but never `type.isError`.
- `piggles/apps/workbench/surfaces/crm/records-list.tsx`: the same.

## The fix

When the type cannot be loaded, the pane shows the shared `PaneLoadError` with the
type's error and the noun "record type": "That record type is no longer here", no
search, no Add. A failed connection still offers Try again.

- Sparx, `surfaces/crm/records-list.tsx`: the gate sits after the built-in check and
  before the toolbar.
- Sparx, `surfaces/crm/record-detail.tsx`: the same gate. A new record of a missing type
  drew its form and Add button too, and would only have failed on Save.
- Piggles had both panes over 250 lines (320 and 314). Both were split, code moved
  unchanged, each file under 250 lines and each function under 50:
  `records-table.tsx` (the rows), `records-toolbar.tsx` (search, saved views, Add),
  `records-list-states.tsx` (built-in, load error, no records, and the new
  `RecordTypeMissing`), `record-toolbar.tsx` (Save, Remove), `use-record-editor.ts`
  (the draft, Save and Remove). `records-list.tsx` is now 201 lines and
  `record-detail.tsx` 220, each with the same gate through `RecordTypeMissing`.

Tests: `surfaces/crm/records-list-missing-type.test.ts` in both consoles. Run against
the old files: red (sparx 2 of 2, Piggles 2 of 3; the third reads the new states file).
Green on the new. CRM tests: sparx 71, Piggles 78 pass. Lint clean. Typecheck not run.

## Confirmed by

P01, 2026-10-13: Doty's saved Projects list opens on "That record type is no longer
here. It has been deleted, or the address points at something that is not in this
business. Nothing of yours has been lost." in light, dark and at 360px. A new Project
form (`/crm/records/project/new`) opens on the same state. Piggles, as The Marrow
Review: the list opens on the same state. Making a real record type to check a working
list after the split found issue 241.

## Rating effect

—
