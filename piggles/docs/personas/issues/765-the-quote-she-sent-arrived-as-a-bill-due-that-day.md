# 765 — The quote she sent arrived as a bill, due the day it was sent

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · act 271
**Surface:** platform — the outbound email, both brands
**Filed:** 2026-09-22
**Fixed:** 2026-09-22
**Confirmed by:** P03, sending a real quote and reading the rendered mail
**Blocked on:** —

## What happened

Issue 764 fixed the page a customer would receive. This is the one that actually
leaves the building.

She pressed **Send** on quote Q-000017 and the console asked:

> **Send this invoice?**
>
> Q-000017 goes to tamsin@loomandlarder.com, with its lines, its total and
> anything you wrote in Notes. **It has no deadline yet, so it will be due when
> they get it.**

She sent it. The **Good until** box, which had been empty, filled itself in with
**09/22/2026** — that day. The quote expired the moment it was made.

## MEASURED, before the fix

The mail was rendered from the real props the send path builds. This is what
Loom and Larder received:

```
SUBJECT: Draft Q-000017 from Juniper Row Textiles LLC

Draft from Juniper Row Textiles LLC

Hi Tamsin Vale, here is draft Q-000017 from Juniper Row Textiles LLC.
It is due by September 22, 2026.

$504.00
Draft Q-000017
Due September 22, 2026

Marlow Knit, mixed sizes, spring range   12 × $42.00   $504.00
Subtotal                                               $504.00
Total                                                  $504.00

Questions about this draft? Reply to this email and it goes straight to
Juniper Row Textiles LLC.
```

And in the database, the row it was rendered from:

| number   | due_at              | valid_until |
| -------- | ------------------- | ----------- |
| Q-000017 | 2026-09-22 19:46:28 | _(null)_    |

## Why

`invoice-mail.ts` loaded the document, its lines, its stage and its customer —
and never its **workflow**. It had no way to tell a quote from a bill, so it
behaved as though every document were a bill. Three consequences, from one
missing `select`:

**It named the document by its STANDING.** `documentLabel: doc.stage.customerLabel`.
On the `invoice` workflow that field holds the document's NAME ("Invoice",
"Receipt") and the line is correct. On `b2b-quotes` it holds where the offer has
got to ("Draft", "Submitted", "Accepted"), so the mail was headed "Draft", every
sentence in it said "draft", and the subject line said "Draft Q-000017". Exactly
the confusion of 764, one renderer further out. [[feedback_a_fix_leaves_its_neighbour_behind]]

**It invented a deadline and wrote it down.** The due-date fill is right and was
argued for at length: a bill with no date is never chased, never ages, and never
dunned. It is right for a bill. A quote asks for nothing, so there is no day on
which it falls due — and `dueDateFromTerms` with no agreed terms returns today.

**And the date came back out of the renderer wearing the other column's name.**
The editor shows `validUntil ?? dueAt` in its Good-until box, and the printed
copy prints the same. So the frozen record the customer keeps read:

```
                              Number      Q-000017
                              Issued      Sep 22, 2026
                              Valid until Sep 22, 2026
```

While the Quotes list, which reads `valid_until` and nothing else, went on
showing **—**. Three screens, two answers, one column filled by a machine.
[[feedback_never_present_absence_as_measurement]]

## What was done

**The send path loads the workflow**, and asks the one shared rule
(`isPriceOfferWorkflow` / `billingDocumentNoun` in `@wizeworks/crm-schemas`)
what kind of document it is holding. Everything below turns on that answer:

- the label is the document's **noun** on an offer ("Quote"), and the stage's
  customer label on a bill, exactly as before;
- `dueAt` is **not computed and not written** on an offer;
- `validUntil` is passed to the template, because that is an offer's own date.

**The email template speaks both languages.** New `priceOffer` and `validUntil`
props. On an offer it says what the price is and how long it stands, never what
is owed and never when. With no end date it says so rather than leaving the
question open:

|              | bill                            | offer                                             |
| ------------ | ------------------------------- | ------------------------------------------------- |
| sentence     | It is due by September 3, 2026. | This price holds until October 31, 2026.          |
| with no date | _(nothing)_                     | Nothing is owed on it. It is a price, not a bill. |
| status pill  | Due September 3, 2026           | Good until October 31, 2026                       |
| headline     | what is STILL OWED              | the TOTAL                                         |
| bottom row   | Still owed                      | Total                                             |

**The console says it too.** The send confirm, the sent toast, the unsaved-changes
warning and the no-address refusal all read the document's noun, and the
deadline sentence is replaced on an offer by _"It has no end date, so the price
stands until you say otherwise."_

**The server's refusals** stopped calling every document an invoice.

## Files

- `wizeworks/services/api-rest/src/lib/invoice-mail.ts` — the workflow, the noun, the deadline
- `wizeworks/packages/email/src/templates/invoice-sent.tsx` — `priceOffer`, `validUntil`
- `wizeworks/packages/email/src/templates/invoice-sent.test.tsx` — three new tests
- `piggles/apps/workbench/surfaces/invoicing/lifecycle.tsx`, `sparx/…` — the send copy
- `piggles/apps/workbench/surfaces/invoicing/invoice-editor.tsx`, `sparx/…` — passes the noun

## Proof

The same template, the same renderer, after:

```
SUBJECT: Quote Q-000017 from Juniper Row Textiles LLC

Quote from Juniper Row Textiles LLC

Hi Tamsin Vale, here is quote Q-000017 from Juniper Row Textiles LLC.
Nothing is owed on it. It is a price, not a bill.

$504.00
Quote Q-000017
No closing date
...
Total                                                  $504.00

Questions about this quote? Reply to this email and it goes straight to
Juniper Row Textiles LLC.
```

With a date set, the middle three lines become _"This price holds until October
31, 2026"_, `Good until October 31, 2026`.

**A real invoice is untouched.** The fixture send still reads "It is due by
September 3, 2026", still leads with **$424.00 · Still owed of $624.00**.

**Sent for real, through the console**, and the columns stayed right:

| number   | due_at   | valid_until         | sent                 |
| -------- | -------- | ------------------- | -------------------- |
| Q-000016 | _(null)_ | 2026-10-31 12:00:00 | 2026-09-22T20:04:21Z |

The confirm read **"Send this quote?"** and the toast **"The quote is in their
inbox, with the lines and the total on it."**

The three new tests were proved red by putting the bug back: removing the
`priceOffer` branch reddens exactly the two offer tests and leaves the invoice
test green. [[feedback_a_test_that_cannot_go_red]]

## Still true, and not this issue

`billing_documents.status` is still `unpaid` on a quote. Nothing on screen shows
it any more, but a report that groups by status counts quotes among the unpaid.
That is a question about the billing schema, carried from 764.
