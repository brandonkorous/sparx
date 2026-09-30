# 762 — The quote screen called it an invoice, and asked when it would be paid

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 270
**Surface:** mypiggles + sparx workbench — the invoicing editor, for every document that is not a bill
**Filed:** 2026-09-21
**Fixed:** 2026-09-21
**Confirmed by:** P03, on screen, and against the stored columns
**Blocked on:** —

## What happened

She pressed the new **Price up a quote** button (issue 761) and the screen that
opened talked about an invoice five times, about a price she had not sent yet:

```
Customer
  [                                                    ]
  The customer record this INVOICE belongs to.

When it should be PAID
  [ mm/dd/yyyy ]
  Leave it empty if there is no deadline. Without one this INVOICE
  never counts as late, so it will not show up when you look for
  who owes you.

Billing name                      Email
  As it should be printed          Where the INVOICE
  on the INVOICE                   gets sent
...
Payments                                    [ Record a payment ]
  $1,008.00 still owed of $1,008.00.
```

**$1,008.00 still owed**, on a quote nobody had seen, let alone agreed to.

## MEASURED, before the fix

Two columns, two promises, and only one of them was ever written:

| column        | what it means                           | what the editor wrote |
| ------------- | --------------------------------------- | --------------------- |
| `due_at`      | a bill falls due, then counts days late | always                |
| `valid_until` | an offer runs out                       | never                 |

The Quotes list has a **Valid until** column and an **Expired** badge, both of
which read `valid_until`. So a quote priced up in the console could never show
an expiry and could never expire, on a screen built to show exactly that.
[[feedback_a_screen_over_a_function_nobody_calls]]

## Why: one editor, three documents, one vocabulary

The invoicing editor is the single screen for every document the billing engine
holds — an invoice, a net-terms receivable, a B2B quote, a customer estimate,
and any workflow a tenant invents. That is the right architecture. What it did
not have was a way to know which one it was looking at, so every sentence on it
was written for the common case and the other cases read as nonsense.

`AR status` is the same shape. Every billing document carries one, and on a
quote it is `unpaid` — which is not a fact about a quote, because nobody owes
anything on a price they have not accepted. The Payments panel printed it as a
debt.

## What was done

**The screen knows what it is showing.** One value resolved once per render:
the workflow slug, from the document's own workflow for an existing one, or
from the kind the caller asked for on a new one. Everything that has to name
the thing reads it — the tab, the field help, the save messages, the confirm on
close, and which date column the date goes in.

**The rule lives in one place.** `isPriceOfferWorkflow` and
`billingDocumentNoun` in `@wizeworks/crm-schemas/builtins`, beside the slugs
they key on, because the renderer that prints the page a customer receives has
to agree with the screen it was typed on (issue 764 is what happens when they
do not). `check:price-offers` fails on a second copy.

**The date goes where it is read.** `headerBody` sends BOTH `dueAt` and
`validUntil` every time and only one of them carries the date, so changing a
document's kind cannot leave a stale date in the column its new kind ignores.
The editor seeds from `validUntil ?? dueAt` for the same reason: reading only
`dueAt` showed an empty box on every quote that HAD an expiry, and the next
save wrote that emptiness back over it.

**The money panel says what is true.** On an offer it is titled **Deposits**,
and it reads "Nothing is owed on a quote. Record a deposit here only if you
have taken money to hold the job." Recording one still works, because a deposit
to hold a job is a real thing that a real amount of money was paid for.

## Files

- `wizeworks/packages/crm-schemas/src/builtins/invoicing.ts` — `isPriceOfferWorkflow`, `billingDocumentNoun`
- `wizeworks/packages/crm-schemas/src/builtins/index.ts` — exported
- `piggles/apps/workbench/surfaces/invoicing/document-words.ts`, `sparx/…` — new, the console's phrasing over that rule
- `piggles/apps/workbench/surfaces/invoicing/invoice-editor.tsx`, `sparx/…` — resolves the kind once
- `piggles/apps/workbench/surfaces/invoicing/bill-to.tsx`, `sparx/…` — the four sentences and the date field
- `piggles/apps/workbench/surfaces/invoicing/payments.tsx`, `sparx/…` — Deposits
- `piggles/apps/workbench/surfaces/invoicing/save.ts`, `sparx/…` — the date routing, the messages
- `piggles/apps/workbench/surfaces/invoicing/types.ts`, `sparx/…` — `validUntil`
- `scripts/check-price-offers.mjs`, `package.json`, `.githooks/pre-push` — the guard

## Proof

Read on screen 2026-09-21:

```
Customer            Tamsin Vale  [Wholesale]
                    Loom and Larder · tamsin@loomandlarder.com
  The customer record this QUOTE belongs to. It shows up in their history.

Good until
  [ 10/31/2026 ]
  After this date the quote is marked as run out, so you can see at a
  glance which prices you no longer stand behind.

Billing name                      Email
  As it should be printed          Where the QUOTE gets sent
  on the QUOTE

Deposits                                    [ Record a payment ]
  Nothing is owed on a quote. Record a deposit here only if you have
  taken money to hold the job.
```

And in the database, for **Q-000016**:

```
  number  | status | due_at |      valid_until
 Q-000016 | unpaid |        | 2026-10-31 12:00:00+00
```

The date landed in the column the Quotes list reads, and the list now shows
**Oct 31, 2026** against it. `due_at` is empty, which is correct: nothing is
due.

A plain invoice is untouched — INV-000013 still reads "When it should be paid",
"printed on the invoice", and a Payments panel saying "$22.00 still owed of
$52.00". crm 251, api-rest 243, automation-actions 25, and 61 structural checks
pass.

## Still true after this

`billing_documents.status` is `unpaid` on a quote, because every billing
document has an AR status and the column has no "not applicable". Nothing shows
it to anybody any more — the screen and the printed page both read the stage
instead — but a report that groups by `status` will count quotes among the
unpaid. Whether an offer should carry an AR status at all is a question about
the billing schema rather than about these screens.
