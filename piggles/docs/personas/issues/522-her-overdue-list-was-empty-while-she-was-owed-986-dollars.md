# 522 — Her Overdue list was empty while she was owed $986.50

**Status:** fixed and proven
**Severity:** critical
**Found by:** Devi, reading an order with an invoice on it
**Surface:** `@wizeworks/crm` billing services, `crm-schemas`, api-rest invoicing route + saved-view presets
**Filed:** 2026-09-15

## What she saw

Order O-000016. Under **Asking for payment**:

```
INV-000005
$67.00 asked for · $40.00 in
Sent Sep 7, 2026 to marguerite.adeyemi@example.com
Due Sep 7, 2026
$27.00 still owed                                    [ Part paid ]
```

Today is **September 15**. That bill was due **eight days ago** and $27.00 of it
is still outstanding. The pane states the due date as a flat fact and badges it
**Part paid**, in the calm blue that means "in progress".

The pane has a **Late** badge, in red. It could not be reached.

## Why

`billing_documents.status` is written by `recomputeTotals`, and `recomputeTotals`
runs when something is **done** to a document: a line is edited, a payment is
recorded, it is voided. **A due date passing is not something being done.** So a
bill that goes late while nobody touches it keeps saying `partial` or `unpaid`
for ever.

The status machine itself is right. `deriveDocumentStatus` in `billing-ar.ts`
has always known that a past-due balance is `overdue`. It was simply only ever
consulted at write time, and the answer it gave then was about a date that had
not yet arrived.

**B2B looked fine, and that is what hid it.** The dunning ladder
(`b2b-escalation-service`) re-marks its own accounts on a schedule. A shop
billing ordinary customers has nothing doing that for it:

| who                 | status    | late, with money owed |
| ------------------- | --------- | --------------------- |
| has company (B2B)   | `overdue` | **21 of 21**          |
| no company (retail) | `overdue` | 9                     |
| no company (retail) | `partial` | **9**                 |
| no company (retail) | `unpaid`  | **15**                |

## What it cost

Every tenant ships with a saved view called **Overdue**, seeded by
`saved-view-presets.ts`, filtering `status = 'overdue'`.

The **aging report**, on the same platform, derives from `due_at` and has always
been right. So two screens answered one question two ways:

```
aging report (derives from due_at)      54 invoices    $51,456.69
"Overdue" saved view (status column)    30 invoices    $26,983.76
```

**$24,472.93 — 48% of the late money — was missing from the screen built to show
late money.**

Per shop it was not a rounding error, it was total:

```
demo-studio      $34,305.75 late     $14,167.50 shown
juniper-row         $986.50 late          $0.00 shown      (8 invoices, 0 shown)
halo-and-hem        $600.00 late          $0.00 shown
```

Devi's Overdue list was **empty** while she was owed $986.50 across eight late
invoices.

**And her own console said so, on another screen.** Finance → _Owed to you_
derives from the due date, like the aging report, and had it right the whole
time:

```
Total outstanding    $1,645.50   across 9 invoices
Not yet due            $659.00
1–30 days late         $986.50
```

Every row on it carries an **8 days late** badge. So the same console, on the
same morning, told her $986.50 was late on one screen, showed her an empty
Overdue list on another, and badged the invoice **Part paid** on the order it
belonged to. Three surfaces, one question, and only the two doing arithmetic
were right.

## What changed

**Lateness is asked of the clock, not of the column.** The schema file already
had the precedent one field up: `sent` is deliberately separate from `status`
because "status is about the MONEY and this is about whether the bill was ever
handed over". Lateness is the same shape — status is about the money, this is
about the date — and the column cannot hold both, because it holds one word.

- **`ListBillingDocumentsInput.pastDue`** (crm-schemas) — a new filter beside
  `sent`, for the same stated reason.
- **`billingDocumentService.list`** implements it as
  `status in (unpaid|partial|overdue) AND balance > 0 AND dueAt < midnight UTC
today` — the aging report's own filter, exactly. `paid` and `void` documents
  have past due dates too and nobody is waiting for them. A bill due **today** is
  not late, so the comparison is against the start of the day, not the instant.
- **The `/v1/invoicing/documents` route** passes it through. The route whitelists
  every field by hand, so a filter the service understands and the route drops is
  a filter no screen can reach — worth saying, because that is the shape of half
  the defects in this journal.
- **The shipped "Overdue" preset** now points at `pastDue: true`.
- **`listInvoicesForOrder`** asks `deriveDocumentStatus` with the clock instead of
  returning the stored word, so the order pane's Late badge is reachable.

**And a migration, because a preset never updates itself.** `saved_views` rows
are seeded find-or-create by (tenant, target, name) and `if (existing) continue`
— so changing the shipped preset fixes new tenants and leaves **63 existing ones
with the broken filter**. `20270509000000_overdue_view_asks_the_due_date` rewrites
exactly those rows whose config still matches what shipped, byte for byte; a
merchant who edited their own copy does not match and is left alone. It loops
tenants with `set_config`, because `saved_views` is FORCE RLS and an unscoped
UPDATE would report success over zero rows in production.

Dry-run in a rolled-back transaction first: `Overdue view now asks the due date
on 63 tenant(s)`, the `/b2b/invoices` view untouched, database unchanged
afterwards.

**Applied for real on 2026-09-15**, once the dev stack was down and the database
free, after a `pg_dump` taken first. Every one of the 63 now reads the same
thing and there is no other spelling left:

```
config                          count
{"params": {"pastDue": true}}      63
```

## Left alone, on purpose

The `/b2b/invoices` "Overdue" view still filters on the status column. It is
measurably correct today — every late B2B invoice is marked, because the dunning
scan writes it — and it reaches a different endpoint that does not take this
filter. Changing it is a separate piece of work, not a silent one.

## Proven

Six integration guards in `invoice-past-due.test.ts`, against a real RLS-scoped
database, each setting the status and due date by hand because that is exactly
the state time alone produces. Removing both halves of the fix reddens **five**:

```
expected 'partial' to be 'overdue'
expected [ …(2) ] to not include 'e2d36137-…'     (the filter stopped filtering)
expected [ …(5) ] to not include 'cfb03fa9-…'     (a bill due today counted as late)
expected [ …(6) ] to not include 'bd6b61c9-…'     (a paid bill counted as late)
expected [ …(7) ] to not include '08d1fd73-…'     (a bill not yet due counted as late)
```

The sixth stays green on purpose: it asserts the OLD filter cannot see the late
invoice, which is a statement about the status column and remains true either
way. That is the green twin that explains why this shipped.

The first guard asserts **both** that the late invoice is returned and that a
not-yet-due one is not. "Contains the late one" alone passes just as happily
when the filter is ignored and the list returns everything, which is precisely
what it did before — a test written that way could never have gone red.

Live, on Devi's own tenant, through the authenticated endpoint:

| filter           | invoices | money       |
| ---------------- | -------- | ----------- |
| `status=overdue` | 0        | $0.00       |
| `pastDue=true`   | **8**    | **$986.50** |

and on her order pane, where it read `Part paid`:

```
INV-000005 · $67.00 asked for · $40.00 in · Due Sep 7, 2026 · $27.00 still owed · Late
```
