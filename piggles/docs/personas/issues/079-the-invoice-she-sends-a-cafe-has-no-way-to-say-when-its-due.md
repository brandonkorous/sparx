# 079 - The invoice she sends a cafe had no way to say when it is due

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · standing checks - dates
**Surface:** mypiggles › Invoices › an invoice
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P01 · Marisol · on screen 2026-08-21

## What happened

She supplies two cafes with loaves and invoices them monthly. Two of her three
invoices read **"No due date"**, so neither could ever be chased.

The Invoices list has a **Due** column, a **Late** filter, sorts by due date
ascending as its default ("most urgent first"), and a `describeDue()` that
phrases the answer properly: _1 day late_, _Due today_, _Due tomorrow_, _Due in 5
days_. The invoice editor has **Bill to, Line items, Notes, Summary, Signature
and Payments, and no due date anywhere**. Neither toolbar menu has one either:
the `...` offers Print and Copy payment link.

The whole read side was built against a value the console could not write.

## Where the one date that DID exist came from

`billing-document-stage-service.ts` sets `dueAt` from the payer's company terms,
but only on the transition INTO a payable stage, and only when `dueAt` is
currently null:

```ts
const becomingPayable = stage.stageType === 'open' || stage.stageType === 'final';
if (becomingPayable && document.dueAt === null) { ... }
```

So it fires once, on a stage change, and never again. In her tenant:

| invoice    | company            | terms   | stage     | due date   |
| ---------- | ------------------ | ------- | --------- | ---------- |
| INV-000001 | Ferrous Coffee Bar | `net14` | `47159e…` | **none**   |
| INV-000002 | The Reading Room   | `net14` | `47159e…` | **none**   |
| INV-000003 | The Reading Room   | `net14` | `47159e…` | 2026-09-04 |

**Same company, same terms, same stage, and one of the two has a date.** The
terms were recorded at 09:20 and 09:22, before all three invoices existed. The
only difference is whether the document was ever ADVANCED into that stage rather
than raised in it.

The comment in that service even anticipates a hand-set date - _"a date already
set by hand, or on an earlier entry, is never overwritten"_ - and nothing in her
console could set one by hand.

## Why it matters

Without a date an invoice never counts as late, never enters an aging bucket, and
never appears under the filter built to find exactly it. For a bakery whose
wholesale money arrives by invoice, that is the feature.

It is also [[feedback_absent_behaves_like_fine]]: "No due date" is a calm,
ordinary-looking row. Nothing about it says _this invoice can never be chased_.

## The fix

**A due date field on the invoice**, in the Bill to card under the customer,
because it is a fact about the arrangement with that customer. The endpoint
already accepted it - `DraftPreviewBody` has `dueAt`, and `create`/`update` both
apply it - and the console's `headerBody()` simply sent five fields and not this
one. It sends six now.

**Seeded from the document on load.** This file already carries a comment about
`notes` being hardcoded to `''`, which made the box look empty on every load AND
wiped the stored note on the next save, twice reporting success. A field the
editor does not read is a field the next save destroys, so `dueAt` is seeded from
`doc.dueAt` for the same reason.

**Stored at midday UTC, not midnight.** A due date is a DAY. Midnight UTC lands
on the previous day for anyone west of it, so the invoice would read as due a day
early and go late a day early with it.

**And the empty state says what empty costs**, rather than leaving her to find
out:

> Leave it empty if there is no deadline. Without one this invoice never counts
> as late, so it will not show up when you look for who owes you.

The list's tooltip for a dateless invoice said **"No payment terms set"**. Both
her companies have `net14` terms, so that sentence sent her to redo work she had
already done - [[feedback_one_outcome_two_causes]], where one outcome has two
causes and the message names the wrong one. It now says where the date is
actually fixed: _"No date set, so this never counts as late. Open it to give it
one."_

## Confirmed on screen - 2026-08-21

Opened INV-000002 (The Reading Room, $624.00, no due date), typed **07/08/2026**
into **When it should be paid**, pressed Save.

- Stored as `2026-08-07 12:00:00+00`, midday as designed.
- The server flipped the status to `overdue` on its own.
- The list row reads **"14 days late"** with a **Late** chip.
- The **Late** filter returns it: _Showing 1-1 of 1_.

That chain - set a date, it goes late, it gets counted, the filter finds it - had
never been able to run.

## Left behind on purpose

INV-000002 keeps the 2026-08-07 due date. It is a real record and the persona
brief says not to remove what the run creates; it also leaves her tenant with one
genuinely overdue invoice, which is a better fixture than three that can never be
late.

## Not fixed, and worth Brandon's call

The server could derive `dueAt` on CREATE as well as on the stage transition,
which would have given all three invoices a date without anyone typing one. That
lives in `wizeworks/packages/crm`, shared with sparx, so it changes behaviour for
sparx tenants too. Worth doing, not worth doing unilaterally.
