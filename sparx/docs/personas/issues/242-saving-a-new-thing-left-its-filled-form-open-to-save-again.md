# 242 — Saving a new thing left its filled form open, ready to save again

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · confirming issue 241 (in Piggles as The Marrow Review)
**Surface:** five "new" forms, sparx console and Piggles: Record types, Shelves (bins), Count schedules, Supplier invoices, Supplier returns
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** sparx as Doty and Piggles as The Marrow Review, 2026-10-13
**Blocked on:** —

## What happened

Rosalind made a new record type, "Review copy", and pressed Save. It saved. A new tab
opened on "Review copies". The tab she had been typing in, "New thing to track", stayed
open next to it, still holding "Review copy" and "Review copies". The tab count went from
12 to 13.

The code meant to swap the pane. Its own comment says the leave-guard is "Cleared BEFORE
the pane swap". But it calls `ctx.open(...)` with no target, and the workbench's default
target is `'tab'`: a new tab in the same group. The form it came from is never closed.

The same shape is on four more create forms, in both consoles. On each of them the old
form is still filled and its button still says what it did, so a second press tries to
make a second copy:

| Form | A second press |
| --- | --- |
| Record types › New | Fails: the short name is taken |
| Stock › Shelves › New | Fails: that label is already a shelf at that location |
| Stock › Count schedules › New | A second schedule, so the count is asked for twice |
| Stock › Supplier invoices › New | Fails: their invoice number is already entered for that supplier |
| Stock › Supplier returns › New | A second return claiming the same credit |

Every other create form in the workbench (about 70 of them) passes
`{ target: 'replace' }`, so the pane becomes the thing it just made.

## What should have happened

The form becomes the saved thing, in the same tab, as everywhere else.

## How to reproduce

1. Customers › Record types › New record type.
2. Type "Review copy". Save.
3. Look at the tabs: "New thing to track" is still open and still filled.

## Why it matters

A second return claims the same credit twice, and a second schedule asks for the same
count twice. Where the server does refuse the copy, the owner meets an error for a thing
they already did. And a stray filled form is a trap: an owner who comes back to that tab
later cannot tell whether it was saved.

## Where it lives

`ctx.open(<detail>, { id | key })` with no target, right after a create succeeds:

- `surfaces/crm/object-type-detail.tsx`
- `surfaces/inventory/bin-detail.tsx`
- `surfaces/inventory/count-schedule-detail.tsx`
- `surfaces/inventory/supplier-bill-new.tsx`
- `surfaces/inventory/supplier-return-detail.tsx`

in both `sparx/apps/workbench` and `piggles/apps/workbench`.

## The fix

Each of the five passes `{ target: 'replace' }`, the same as every other create form, so
the pane becomes the record it just made. Both consoles.

Guard: `surfaces/create-becomes-the-record.test.ts` in both consoles reads every surface
for a just-created record (`saved` / `created`) opened with no target. It was red on the
old code in both consoles and is green now.

The Piggles files were over the 250-line rule, so each was split, moving code only:
object-type-detail (860 lines, now 10 files), bin-detail (667, 9 files),
count-schedule-detail (625, 8 files), supplier-bill-new (458, 6 files),
supplier-return-detail (892, 7 files). Lint is clean and the Piggles inventory and CRM
tests pass (288 and 79).

## Confirmed by

Each form was used for real, and the tab count before and after was read:

- Record type: Piggles "Review copy" (first try, which found this) and "Galley proof"
  (the "new" tab became "Galley proofs"); sparx "Rebuild job" (252 tabs before and after).
- Shelf: sparx "B-02-04" at Warehouse (Concord Park), toast "B-02-04 added", 254 tabs
  before and after; Piggles "BACK-03" at Main Warehouse, 15 and 15.
- Count schedule: Piggles "Top-value stock, monthly", toast "Schedule set up", 16 and 16.
- Supplier invoice: sparx AP-2026-104417 against PO-000002 (Alliant Power, $880.00), 259
  and 259; Piggles KP-48812 against PO-000001 (Kestrel Paper Co., $480.00), placed for
  the purpose. Both panes became the invoice.
- Supplier return: sparx RTV-000001 (2 × AP0002 at $38.50, $77.00 to claim back), 265 and
  265; Piggles RTV-000001 (12 × NB-DOT-A6 at $2.40, $28.80), the "Send something back"
  tab became "RTV-000001".

Each of these also proves the split Piggles screen it ran on.

## Rating effect

Ease on the five create forms: no stray filled form is left behind after a save.
