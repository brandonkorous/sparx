# 569 — Told my orders would be held, by a limit I had switched off

**Status:** fixed and proven
**Severity:** high
**Found by:** Devi, on Trade → Orders to approve
**Surface:** `piggles|sparx/apps/workbench/surfaces/b2b/approvals.tsx` · `wizeworks/packages/b2b/src/approval.ts` · `wizeworks/packages/commerce/src/services/{checkout,discount-conditions,bulk-price}-service.ts`
**Filed:** 2026-09-16
**Family:** [[feedback_a_promise_in_copy_is_a_contract]] · [[feedback_never_present_absence_as_measurement]]

## What she saw

One pane, two halves, contradicting each other.

Top half:

> **Nothing waiting**
> No orders are held for sign-off right now. **When one goes over a limit you
> set below, it lands here.**

Bottom half, four lines down:

> **Over $5000.00** · Every account&nbsp;&nbsp;&nbsp;**Off** ( ○— )

The sentence promises a control the screen below it has switched off. Nothing
will ever land there. She reads "nothing has hit my limit yet" and believes she
has a spending control on her trade accounts. She does not.

And the figure is "$5000.00". No comma. On the one number she is meant to count.

## Measured

Spending limits across the platform:

|                                               |        |
| --------------------------------------------- | ------ |
| tenants with a limit written down             | **38** |
| tenants where **every** limit is switched off | **34** |
| tenants with at least one live                | 4      |

Ten of the 34 are real named businesses: Everson Apparel, Halo & Hem, Harbor &
Pine, Juniper Row, Keen Meridian 4301, Marta's workspace, Midwest Supply, The
Marrow Review, Thistle & Rye, Wildroot Flowers. Every one of them has been told
their orders will be held.

An approval rule is the control that decides whether a trade account can spend
without a person saying yes. "Nothing has hit it yet" and "it is not switched
on" are the same empty screen and opposite facts.

## The cause

The queue's empty state is a fixed string. The rules live in a sibling component
and the sentence never reads them:

```tsx
firstRun={{
  title: 'Nothing waiting',
  description:
    'No orders are held for sign-off right now. When one goes over a limit you set below, it lands here.',
}}
```

## The fix

A pure module, `approval-hold-notice.ts`, with three states and three sets of
words — no ternary inside a sentence, because a plural-only phrase reads fine in
source and only breaks on screen ([[feedback_a_fix_leaves_its_neighbour_behind]]).

| state            | what it says now                                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| no limits at all | **Nothing waiting, and nothing set to wait** — "No order will be held for sign-off, because you have not set a limit yet."                                            |
| limits, all off  | **Your limit is switched off** / **Your limits are switched off** — "…so no order is being held for sign-off, however large. Use the switch beside it to turn it on." |
| at least one on  | **Nothing waiting** — "You are holding every order over $2,500.00, so the next one lands here."                                                                       |

The live branch names the **lowest** live limit, because that is the one an
order actually has to clear. A zero limit reads "every order", not "over $0.00"
— the schema says `0 = all B2B orders` and the sentence should say what the
schema means.

Her screen now reads, verified in the browser:

> **Your limit is switched off**
> You have one limit set below and it is switched off, so no order is being held
> for sign-off, however large. Use the switch beside it to turn it on.

Ported to both consoles.

## The second half: money nobody can count

`$5000.00` came from a hand-built string in the API:

```ts
minAmountFormatted: `$${(rule.minAmountCents / 100).toFixed(2)}`,
```

`toFixed` has no thousands separator. 38 of the 42 rules on the platform are
five figures, so that field has never once rendered readably.

**Four places in two packages built money this way.** Ranked by what a person
actually sees:

| where                       | who reads it                          | live today                                                     |
| --------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| `checkout-service.ts:953`   | a wholesale buyer stopped at checkout | **yes — all 19 credit limits are $10,000 / $25,000 / $50,000** |
| `b2b/approval.ts:74`        | the owner, on this pane               | **yes — 38 of 42 rules**                                       |
| `discount-conditions.ts:43` | a shopper at checkout                 | not yet (biggest minimum basket is $100)                       |
| `bulk-price-service.ts:108` | the owner, on a price-change job      | not yet                                                        |

The checkout one is the sharpest. Every trade buyer who has ever run out of
credit was told:

> Insufficient credit: **$50000.00** available, **$52340.00** required

Two five-figure numbers with no separators, at the moment someone is being told
they cannot buy, in language that never says what to do about it. It now reads:

> This order comes to $52,340.00 and your account has $50,000.00 of credit left.
> Pay down what is outstanding, or ask your account manager to raise the limit.

Both remedies are real: `available = creditLimit − creditUsed`, so paying down
raises it, and the limit is editable on the account. The zero case is its own
branch — "your account has no credit left" rather than "-$500.00 of credit
left".

A new `commerce/src/services/money.ts` carries `formatCents` / `formatAmount`
over `Intl.NumberFormat`, cached per currency (these run inside request paths),
pinned to `en-US` because a server-rendered string formatted in "whatever locale
the container booted with" is a coin toss rather than a reader's preference. A
bad currency code prints the number and the code rather than guessing a symbol,
because a wrong symbol on a figure reads as a fact.

## Proven

**`approval-hold-notice.test.ts`** — 6 tests, both consoles. The last is a
property rather than a case: whatever the shape of the rules, the sentence's
promise and the switches have to agree. Reinstating the old unconditional
sentence:

```
× says the one limit is off, not that orders will be held
× counts them when several are off, and stays plural
× never tells a business its orders will be held while every limit is off
  → expected true to be false
```

3 of 6 red.

**`money.test.ts`** — 7 tests. Restoring `toFixed(2)`:

```
× groups the thousands                  → expected '$5000.00' to be '$5,000.00'
× uses the currency it is given          → expected '$5000.00' to be '€5,000.00'
× prints a number and the code on a bad code
× handles negatives without losing the separator
```

4 of 7 red.

|               |                 |
| ------------- | --------------- |
| commerce      | **221 pass**    |
| b2b           | **3 pass**      |
| both consoles | new suite green |

Verified on screen: the rule now reads **Over $5,000.00**.

## Still open

**`b2b/approval.ts` builds its own formatter** rather than importing the
commerce one. `@wizeworks/b2b` does not depend on `@wizeworks/commerce` and
adding the dependency needs a `pnpm install`, which is the user's to run. Both
are three lines of `Intl.NumberFormat` against the same standard API, so the
duplication is a standard call rather than a house rule in two places — but a
shared home is the right end state.

**A rule carries no currency.** `minAmountCents` has no currency beside it, so
the formatter is pinned to USD. Every order and every variant on the platform is
USD today, so nothing is wrong on screen; it is a stated gap now rather than a
buried one.
