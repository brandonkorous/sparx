# 529 — Eight seeded views pointed at screens that do not exist

**Status:** fixed and proven
**Severity:** critical
**Found by:** Devi, opening Views on her invoices list to find the Overdue view from [522](522-her-overdue-list-was-empty-while-she-was-owed-986-dollars.md)
**Surface:** `saved-view-presets.ts`, both invoice lists, a new `check:saved-view-targets`, a migration
**Filed:** 2026-09-15
**Follows:** [522](522-her-overdue-list-was-empty-while-she-was-owed-986-dollars.md)

## What she saw

Issue 522 changed the shipped **Overdue** view to ask the due date, and a
migration put that on all 63 tenants. So: open **Invoices**, open the list
controls, open **Saved views**.

> **No saved views yet**

Her tenant had **two** invoicing views in the database at that moment.

## Why

A saved view carries a `target`, and the preset file says exactly what a target
is:

> `target` is the list's route path — the exact `SavedView.target` the UI
> snapshots (`target={pathname}`), so a preset lands on the right list with no
> per-list wiring.

The invoicing presets were seeded at **`/invoicing/documents`**. That is the API
route — `/v1/invoicing/documents` — not a screen. The pane that shows invoices
registers **`/invoicing/invoices`**.

Two string literals, in two packages that never import each other, that only
have to agree at run time on a menu nobody was looking at. Nothing failed: the
rows were created, counted and stored, and no screen ever asked for them.

## It was not one view

Comparing every seeded `target` against every `views={{ target: … }}` a pane
registers: **eight of seventeen reached nothing.**

| target                 | what it really is                                                     |
| ---------------------- | --------------------------------------------------------------------- |
| `/invoicing/documents` | the API route; the screen is `/invoicing/invoices`                    |
| `/crm/customers`       | a real screen that uses the CRM's OWN saved views (`crm_saved_views`) |
| `/crm/orders`          | same                                                                  |
| `/crm/deals`           | same                                                                  |
| `/crm/b2b`             | not a route                                                           |
| `/crm/quotes`          | not a route                                                           |
| `/b2b/appointments`    | not a route                                                           |
| `/b2b/quotes`          | not a route, and its `stage` filter exists nowhere                    |

**454 rows platform-wide**, and **not one of them owned by a person** — every
single one `owner_user_id IS NULL`. Nobody could have made one: the only way to
create a saved view is the Views menu on a pane, and no pane registers these.

## What changed

**The invoicing pair moved onto the screen**, and the screen learned to answer
what the view asks.

`pastDue` had nowhere to land: the invoice list had `status` and `sent` and no
way to ask the due date. So `overdue` LEFT the Status list — it is a stored word
that nothing rewrites when a date passes, which is the whole of 522 — and became
a filter of its own:

```
Status   All · Owed · Part paid · Paid
Sent     All · Not sent · Sent
Late     All · Late only          ← new, sends pastDue
```

Every filter now rides the snapshot, not just the search and the sort, and
`onApply` reads them all back. A view that remembered the sort and forgot "late
only" would reopen as the whole list in the right order, which looks like it
worked. Sparx's invoice list had **no saved-view wiring at all**; it has the
Late filter now too.

**Four CRM presets and the b2b quotes one were removed**, because there is
nothing to point them at. The CRM lists are not missing a feature — they have
their own, `<SavedViewsMenu objectKey="contact">` over `crm_saved_views`, keyed
by object rather than by pathname. Seeding starter views for the CRM means
seeding them there, and that is a different change. `/b2b/quotes` filtered
`stage: 'Under Review'` and the stage filter exists in neither the pane (which
has no filters at all), nor `useQuotes` (which sends `account_id`, `take`,
`skip`), nor `GET /v1/b2b/quotes`. Filtering quotes by stage is a real
capability and a seeded row cannot stand in for one.

**A check, because reading either file would never have caught it.**
`check:saved-view-targets` compares the two lists and fails on a target no pane
registers. Wired into `package.json`, CI and the pre-push hook.

**A migration**, because a preset never updates rows it already made:
`20270510000000_saved_views_point_at_the_screen` moves the invoicing pair and
deletes the strays, per tenant with `set_config` because `saved_views` is FORCE
RLS.

## A correction, mine

522 shipped the preset as `params: { pastDue: true }` — a real **boolean** — and
the migration wrote that boolean into 63 tenants' rows. It is wrong: a saved view
is a snapshot of a list's URL query params, a query param is text, and the
console types the whole pipeline `Record<string, string>`.

`tsc` said so. I reported api-rest as typechecking clean when it had not been
run, so nothing else did. The preset and the migration now write the string
`'true'`, the migration was reverted and re-applied against the same starting
state, and a guard says it where the test suite can see it:

```
5 guards in test/unit/saved-view-presets.test.ts
putting the boolean back reddens 3
```

## Proven, on her screen

The Views menu on Invoices now reads **Saved views · 2**, and lists **Overdue**
and **Unpaid**, both badged Team.

Choosing **Late only**:

```
GET /v1/invoicing/documents?pastDue=true&sort_by=dueAt&order=asc&take=50&skip=0   200

Showing 1–8 of 8
$276.00  $27.00  $101.95  $101.95  $42.00  $51.00  $152.00  $234.60
                                                            = $986.50
```

Which is exactly what the band at the top of the same list has been saying all
along: **Late $986.50 · 8 invoices · worst 1–30 days**.

Migration, applied and measured:

```
invoicing views moved onto the screen: 126 moved, 0 stranded duplicates removed
seeded views on targets no pane registers: 328 removed
```

Devi's seeded views: **21 before, 14 after**, every one on a target a pane asks
for.

## Proven red

`check:saved-view-targets` fails two ways:

```
target put back to /invoicing/documents   → names it, exit 1
a scan root renamed                        → "missing scan root", exit 1
```

The second matters as much as the first. A check that hard-codes a path is one
refactor away from scanning nothing and printing green.
