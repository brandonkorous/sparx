# 743 — The rail's + and the pane's own button name the same action differently

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 265
**Surface:** mypiggles workbench — the nav rail's `+` against each list pane's own create button
**Filed:** 2026-09-19
**Fixed:** 2026-10-01
**Confirmed by:** walked on screen as Devi
**Blocked on:** —

## What is wrong

`PIGGLES_CREATE_LABELS` in `lib/console/vocabulary.ts` exists because of issue
729: the rail said "Add a price list" and the pane's button said "Add a special
price", one action with two names depending which one you pressed.

The fix reached the rail and stopped there. `resolveCreateLabel` is read by
exactly one thing, `components/panel/nav-row.tsx`. Every list pane hard-writes
its own button text, and nothing compares the two.

Seen on screen in act 265, on the Wholesale customers list:

```
rail, hovering the +        Add a wholesale customer
the pane's own button       Add a trade account
```

## Measured

```
surfaces with a create label (override, else the catalog's)   58
whose own component file never contains that label            11
```

| surface                       | rail says                |
| ----------------------------- | ------------------------ |
| `b2b.accounts.list`           | Add a wholesale customer |
| `cms.taxonomy.list`           | New way to file content  |
| `cms.types.list`              | New content type         |
| `commerce.products.list`      | Add a product            |
| `commerce.fitment.list`       | New compatibility list   |
| `commerce.product-types.list` | New product type         |
| `commerce.shipping.list`      | Add a delivery region    |
| `crm.object-types.list`       | New record type          |
| `email.broadcasts.list`       | New email campaign       |
| `inventory.warehouses.list`   | New location             |
| `inventory.supplier-bills`    | Enter an invoice         |

Of those, three were read and are definitely two names for one action:

| surface                 | the pane's button says |
| ----------------------- | ---------------------- |
| `email.broadcasts.list` | New broadcast          |
| `crm.object-types.list` | New thing to track     |
| `commerce.fitment.list` | Add a list             |

`b2b.accounts.list` was the fourth and is **fixed** (act 265), because it sat on
the path this act was walking.

Some of the eleven have no create button of their own at all, which is fine —
the rail's `+` is the only way in. Telling those apart from the real ones is
what makes this a piece of work rather than a sweep.

## What it needs

A guard, and the guard is the hard part. "The label appears verbatim somewhere
in the file" is the cheap test and it reports a pane with no button as a
failure, which is the shape that gets a check switched off
([[feedback_structural_checks_go_blind]]). The real test is "find the pane's
CREATE control and compare ITS text", and the create control is written three
different ways across the console (a `createFirst` object shared by the toolbar
and the empty state, a bare `<Button>` in the toolbar, a `firstRun.action`).

So: settle on one shape for a list pane's create control, migrate the eleven to
it, then the guard is a two-line comparison rather than a parser.

## A third way the two can disagree, found in act 267

The rail and the pane can also agree with each other and both disagree with the
TAB that opens. Wholesale orders got an **Enter an order** button in act 267
([748](748-a-shop-phones-an-order-and-there-is-nowhere-to-type-it.md)), pointing
at the till — a surface whose own name is "Take a sale", because from Orders that
is exactly what it is. So the button said one thing and the tab that appeared
said another, about the same press.

Fixed by letting the surface title read its params, and by giving the registry a
`createParams` field so the rail's `+` opens with the same words as the button:

```ts
title: (params) => (params.through === 'wholesale' ? 'Enter an order' : 'Take a sale'),
```

That is not a licence for a screen to have two names. It applies where one
surface genuinely serves two errands, and the LAUNCHER still passes nothing and
gets the ordinary name.

`createParams` was added to BOTH consoles' registries and honoured in both
panels. A field one console reads and the other ignores is the next version of
this bug. [[feedback_absent_behaves_like_fine]]

## Files

- `piggles/apps/workbench/lib/console/vocabulary.ts` — `PIGGLES_CREATE_LABELS`
- `piggles/apps/workbench/lib/surfaces/registry.ts` — `resolveCreateLabel`, `createParams`
- `sparx/apps/workbench/lib/surfaces/registry.ts` — `createParams`
- `piggles/apps/workbench/components/panel/nav-row.tsx` — its only reader
- `piggles/apps/workbench/components/app-panel.tsx`, `sparx/…/components/module-panel.tsx` — the `+`'s params
- the eleven list panes above

## The fix (act 323)

Re-measured first: **11** lists opened their own create form under words that
were not their `+`'s, not the 11 in the table above (two had come right, two
more had drifted). Products and Locations had looked wrong to a file-by-file
grep and were not: their buttons live in a child file and already matched.

One place for the words. `createLabelFor(listKey)` in each console's registry
returns exactly what the rail's `+` says, and each of those lists now reads it
for its button, its tooltip and any sentence that names the button. Where the
pane's own words were the Piggles ones, they moved into
`PIGGLES_CREATE_LABELS`, so the rail took them too:

| list              | both now say        |
| ----------------- | ------------------- |
| Kinds of content  | New kind of content |
| Kinds of product  | New kind of product |
| Things you track  | New thing to track  |
| How things move   | New process         |
| Things to do      | Add something to do |
| Automatic emails  | New automatic email |
| Moving stock      | Start a move        |
| What happens when | Set up a path       |

Tags and topics ("New"), What fits what ("Add a list") and Postage and
delivery ("Add a region") said less than the rail and now say the rail's words.
The sparx console had 5 of the same and got the same treatment.

**The guard** is `lib/surfaces/create-label-agrees.test.ts`, in both consoles.
It reads the catalog with the TypeScript parser, follows each list to its file
and the files beside it that it imports, and only judges a list that opens its
create form with `'new'`, so a list with no button of its own is skipped, not
failed. It asserts its roots exist and that it judged more than 30 lists.
Proved red by putting the old Kinds of content list back: it names that list.

**A check this went blind on, and the fix.** `check:toolbars` keeps a create
button out of the slot that folds on a phone, and it finds one by the words
Save / Create / Add. The sparx What fits what list had "Add a list" in that
slot and was on the check's debt list. Reading `{createLabel}` hid it, and the
check reported it as fixed. The button is moved to the slot that never folds,
and the check now counts `{createLabel}` and `label: createLabel` as a create
action. Proved red by moving it back.

## Confirmed by

> As Devi: the `+` beside How things move reads "New process", and the
> list's own button reads "New process". Searched "Kinds of content": the box
> offers "New kind of content", and the list's button says the same.
