# 807 — Ten accounts told they could order, and none of them can

**Status:** fixed
**Severity:** correctness
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles + sparx workbench — `crm.accounts.list`, `crm.account.detail`, `b2b.accounts.list`, `b2b.account.detail`, and `checkout-service.complete()`
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi, full width and at 360px; counted in the database
**Blocked on:** —

## What happened

Opening the Customers app on her one trade customer, Devi saw this at the top
of the pane:

> **$1,193.00 of $0.00 used**

and this in the list behind it, under a column headed **Credit limit**:

> $0.00

Under the Status picker, in green:

> Active
> This account can place orders on its agreed terms.

And in the box that sets the limit, empty, with the note:

> The most they can owe you on account at once. Leave blank for none.

Four statements about one account. Loom and Larder owes her **$1,193** and
**cannot place a single order on terms**. Not one of the four says so.

## What a zero actually does

`companies.credit_limit` is `NUMERIC NOT NULL DEFAULT 0`. The checkout is the
only thing that reads it, and it reads it as a subtraction:

```ts
const available = Number(account.creditLimit) - Number(account.creditUsed);
if (orderDollars > available) throw …'your account has no credit left'
```

So a zero is not an absent ceiling. **It is a closed door.** Every order placed
on payment terms against a zero limit is refused at the till.

Counted on the dev database, 2026-09-25:

|                                    | companies |
| ---------------------------------- | --------- |
| a real limit set                   | 18        |
| zero limit, nothing owed           | 10        |
| zero limit, owing money            | 1         |
| **blocked from ordering on terms** | **11**    |

And by status:

| status    | count | of those, blocked by a zero limit |
| --------- | ----- | --------------------------------- |
| active    | 10    | **10**                            |
| inactive  | 1     | 1                                 |
| suspended | 18    | 0                                 |

**Every single Active company is blocked.** Ten for ten. Each one sits under a
green badge and the sentence "This account can place orders on its agreed
terms."

## Why it matters

A business owner sets up a wholesale customer, leaves the credit box empty
because the form says to leave it blank for none, and reads a green Active
badge that tells her they can order. Her customer then gets turned away at
checkout with "your account has no credit left". Neither of them can see why.
She will look for the fault in the checkout, because the account screen told
her the account was fine.

That is one outcome with two causes wearing the same face: "no credit" and
"nobody decided" are the same zero, and the copy picked the wrong one.

## The three states, and why two branches cannot say them

Every reader had two branches, and there are three things to say, because an
account can be shut out of terms **and** still owe money from before it was:

|                           | what is true            | what to say                        |
| ------------------------- | ----------------------- | ---------------------------------- |
| a ceiling is recorded     | they may order up to it | `$1,193.00 of $5,000.00`           |
| zero, money outstanding   | shut out, and owing     | `$1,193.00 owed, no more on terms` |
| zero, nothing outstanding | shut out                | `Cannot order on terms`            |

The two apps failed in opposite directions on the middle row. The Customers app
printed **"$1,193.00 of $0.00 used"**, which reads as a rounding error. The
Trade app printed **"No credit set"** and dropped the $1,193 on the floor
entirely.

## The second defect, found on the way

Four account states exist and the order path checked three of them.
**`inactive` was read nowhere.** The console calls that state "kept on file but
not trading" — the one state whose entire meaning is "we are not doing business
with these people" was the only one that stopped nothing.

A third, in the same four lines: the test was `orderDollars > available`, and
every comparison against `NaN` is false. So a credit limit that would not parse
granted **infinite** credit rather than none. Asking `!(orderDollars <=
available)` refuses instead, which is the right way round for money.

## The fix

**One place decides what is true.** `lib/credit-standing.ts` (new, both
consoles) returns `'limit' | 'owing' | 'noTerms'` and nothing else. It converts
no units on purpose: the Trade app holds cents and the Customers app holds
decimal strings, and a helper that guessed would be one rename away from
reporting a $50 limit as $5,000.

**Each screen says it in its own register**, because a list cell, a toolbar and
a field description need the same fact and different words:

| where                 | before                                  | after                                                                                                           |
| --------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Customers list column | `Credit limit` → `$0.00`                | `Credit used` → `$1,193.00` / `no more on terms`                                                                |
| Customers header      | `$1,193.00 of $0.00 used`               | `$1,193.00 owed, and no more on terms`                                                                          |
| Customers field note  | `Leave blank for none.`                 | `They still owe you $1,193.00, and cannot order on terms until you put an amount here.`                         |
| Trade list column     | `No credit set`                         | `$1,193.00 owed, no more on terms`                                                                              |
| Trade field note      | `Leave at zero for no credit.`          | `They cannot order on terms. Put an amount here to let them, up to that much at once.`                          |
| Active status         | `can place orders on its agreed terms`  | `Nothing here is holding this account back. Whether they can order on terms depends on the credit limit below.` |
| Suspended status      | `switched off and cannot order`         | `They cannot order on terms. They can still buy from you paying up front.`                                      |
| Inactive status       | `dormant: kept on file but not trading` | `Kept on file and not being traded with. They cannot order on terms while this is set.`                         |

The Suspended line changed because all four guards sit inside
`if (activeB2bAccountId && session.paymentTermsRequested)`. None of them stops a
card payment, so "cannot order" overstated what the switch does.

The Inactive line was made **true** rather than reworded around it:
`termsRefusal` now refuses that state too.

**The decision came out of the transaction.** It was four `if`s in the middle of
`complete()`, reachable only through a database transaction, which is why
nothing tested it and one of the four was missing. It is now
`export function termsRefusal(account, orderCents, currency)` beside
`furthestStep`, with eight unit tests.

## The column now says what is owed

The Customers list was already fetching `creditUsed` and drawing nothing with
it, which is how a company could owe $1,193 under a cell reading `$0.00`. The
column is headed **Credit used** now, the same as the Trade app's, so both apps
answer the same question about the same record the same way.

At 360px the cell is 107px wide, so the figure and its qualifier are two
stacked lines rather than one clause. Measured: nothing clipped, nothing
overflowing, and the row is **86px either way** — the company name already
drove that height before this change.

## Proved red

`termsRefusal`, with both original bugs put back:

- dropping the `inactive` branch → **"stops an account marked as not trading"** fails
- restoring `orderDollars > available` → **"refuses rather than allows when a figure cannot be read"** fails

2 of 8 red, each bug caught by its own test.

`creditStanding`, with the two-branch guard both apps shipped:

- removing the `'owing'` branch → **4 of 5** red

## Files

- `wizeworks/packages/commerce/src/services/checkout-service.ts` — `termsRefusal` extracted, `inactive` guarded, the `NaN` comparison reversed
- `wizeworks/packages/commerce/src/services/checkout-terms.test.ts` — NEW, 8 tests
- `piggles|sparx/apps/workbench/lib/credit-standing.ts` — NEW
- `piggles|sparx/apps/workbench/lib/credit-standing.test.ts` — NEW, 5 tests
- `piggles|sparx/apps/workbench/surfaces/crm/companies-list.tsx`
- `piggles|sparx/apps/workbench/surfaces/crm/companies-data.ts`
- `piggles|sparx/apps/workbench/surfaces/crm/company-detail.tsx`
- `piggles|sparx/apps/workbench/surfaces/b2b/accounts-list.tsx`
- `piggles|sparx/apps/workbench/surfaces/b2b/account-detail.tsx`

## Still open, noted not fixed

**Nothing increments `credit_used` when an order is placed.** The only writer in
the tree is the sample-data seeder. So a customer given a $5,000 limit never
uses any of it: the balance stays where it was seeded and the ceiling never
falls. The guard added here is correct and will start doing real work the moment
that writer exists; until then it only ever reads a stale number. That is its
own issue, and it is why "Credit used" on 18 accounts is currently a figure
nobody is maintaining.
