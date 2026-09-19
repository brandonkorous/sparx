# 594 — I sold $2,350 and the screen only talks about $535

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 202
**Surface:** mypiggles › Money › Where money comes from
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P03 · Juniper Row · act 202 (seen on screen)

## What happened

I opened **Where money comes from** to see whether the website or the orders I
type in myself are doing better. It said:

> Money received in the last 90 days
> **$535.00**
> from 14 orders across 2 places

Then the table:

| Where         | Orders |     Sales | Received | Share |
| ------------- | -----: | --------: | -------: | ----: |
| Your website  |     11 | $2,140.50 |  $325.00 |   61% |
| Added by hand |      3 |   $210.00 |  $210.00 |   39% |
| All places    |     14 | $2,350.50 |  $535.00 |  100% |

I sold **$2,350.50** and the screen only wants to talk about **$535.00**. Where
did the other **$1,815.50** go? Nothing on the page says. I sat and did the
subtraction myself and still did not know the answer, because "sales minus
received" is one number made of two different things.

The answer, which I had to go and find in another pane: **seven orders nobody
has paid for, worth $1,603.50**, plus **$212.00 refunded**. Three quarters of
everything my website sold, and it is not on the screen that exists to tell me
where my money comes from.

There is a Refunds column that would have explained a tenth of it. It is hidden
unless the pane is wider than 576 pixels. Mine opens at **567**.

## What should have happened

Two things.

**The columns should add up.** Sales, Refunds and Received sit in a row and look
like a sum. They are not one. The term that joins them was never computed.

**The biggest number on the screen should be on the screen.** $1,603.50 owed is
more than the $535.00 the pane leads with, and it is the one I can do something
about.

## How to reproduce

Every time, on any shop that invoices rather than taking payment up front.

1. Sign in as Devi, open **Money › Where money comes from**, range 90 days.
2. The headline reads $535.00; the table reads $2,350.50 of sales.
3. Nothing accounts for the $1,815.50 between them.
4. Widen the pane past 576px and a Refunds column appears explaining $212.00 of
   it. The other $1,603.50 has no column at any width.

## Why it matters

This is the screen for deciding where to put effort, and it was answering a
different question than the one it looks like it answers.

**The share is the sharp end.** "Your website 61%" is share of money received.
By sales it is **91%**. "Added by hand 39%" is really **9%**. A shop owner
deciding whether the hand-entered orders are worth the trouble reads 39% and
keeps doing them; the real figure is 9%. Thirty points, on the same row, with
nothing on screen saying which one the column means.

And $1,603.50 unpaid on $535.00 received is not a reporting detail, it is the
state of the business. It belongs in front of her.

## Where it lives

`GET /v1/finance/channels` returned `gross`, `refunds` and `net` (which is
`amountPaid`, money genuinely received). It never returned what was still owed,
so the three did not reconcile:

```
gross − refunds  =  $1,928.50      but  net = $325.00
```

The endpoint already had every field it needed — it selects `total`,
`amountPaid` and `refundTotal` per order and threw the third away.

**Fixed:**

| file                                           | change                                                 |
| ---------------------------------------------- | ------------------------------------------------------ |
| `api-rest/…/finance/channels-fold.ts`          | new; the arithmetic, liftable out of the route to test |
| `api-rest/…/finance/channels.ts`               | returns `owed`, calls the fold                         |
| `workbench/surfaces/finance/channels-words.ts` | new; the sentences, in both consoles                   |
| `workbench/surfaces/finance/channels.tsx`      | the subtitle, the "Still owed" column, the share note  |

Now:

```
gross − refunds − owed = net
$2,140.50 − $212.00 − $1,603.50 = $325.00
```

**`owed` is clamped per order, never on the total.** An overpaid order would
otherwise cancel out a different order's debt, and "someone paid us twice" is
not the same fact as "someone has paid" — netting them hides both.

**The sentence does the work the column cannot.** A column is invisible below
its breakpoint; the subtitle is there at every width:

> from 14 orders across 2 places
> **Another $1,603.50 of these sales has not been paid for yet. $212.00 was
> refunded.**

It says nothing at all when nothing else happened. A shop paid at the till would
otherwise carry "Another $0.00 of these sales has not been paid for yet" on the
screen every day.

**"of these sales" is doing real work.** The first draft read "Another $1,603.50
was sold and has not been paid for yet", and on the next pane along, **Money ›
Owed to you**, Devi is told "Total outstanding **$1,645.50** across 9 invoices".
Two numbers, $42 apart, both in the Money module, both apparently saying "people
owe you". They are not the same measurement: this one is ORDERS through these
channels inside the window she picked; that one is INVOICES, all time. Naming
the scope is what stops the reader having to guess which is right.

Worth recording that this was checked rather than assumed. Nine of Devi's orders
have an invoice for the same customer and the same amount, which looked at first
like the same debt counted twice. It is not: every invoice carries
`billing_documents.order_id` and every one of hers is populated. The product
links them correctly and no defect was filed for it.

**The share now names its denominator**, under "The numbers":

> Share is of money received, not of what was sold.

**Breakpoints: one column per step, never two.** This is issue 591's lesson
applied rather than relearned. Sales at `@lg`, Still owed at `@xl`, Refunds at
`@2xl`. Still owed comes before Refunds because on a shop that invoices it is
the bigger number and the one that is still an action — an unpaid order can be
chased, a refund is history.

Measured across twelve widths after the change:

| pane width | columns shown | sideways scroll |
| ---------: | ------------: | --------------: |
|        390 |             4 |               0 |
|        512 |             4 |               0 |
|        560 |             5 |               0 |
|        620 |             6 |               0 |
|        700 |             7 |               0 |
|        900 |             7 |               0 |

Four, five, six, seven. No step adds two columns, and nothing scrolls sideways
from 390px up.

At exactly **360px** the table is **1px** wider than the space left by the
pane's own vertical scrollbar, and the `overflow-x` wrapper scrolls, which is
that wrapper working as designed. It is not new: the four columns visible at
that width are the same four as before this change.

## Guard

`api-rest/…/finance/channels-fold.test.ts`, 14 tests. The invariant is asserted
on **every row and on the totals**, not just the totals:

```ts
expect(Number((r.gross - r.refunds - r.owed).toFixed(2))).toBe(r.net);
```

across the shop that found it, a till-only shop, a mixed set of four channels,
decimals that do not divide cleanly, a Prisma `Decimal` rather than a number,
and a null amount. Plus the overpayment case, which asserts that one order
paid twice does not cancel another order's debt.

Proven red: replacing `owedOn` with `return 0` — the state this replaced —
fails **7 of the 14**.

`workbench/surfaces/finance/channels-words.test.ts`, 12 tests in each console,
covers the sentences: silent when nothing is owed and nothing refunded, both
facts as two sentences when both happened, and the singular/plural property
tested by comparing the noun at one against the noun at two rather than by
matching a shape I guessed at (issue 587's lesson).

## Still open

Nothing from this issue.

Worth noting for later, not filed: the pane sorts channels by money received.
On Devi's shop that is the right order, but a shop whose biggest channel is also
its slowest payer would see it ranked last. Not a defect today — the column that
would show the problem is now there to be read.
