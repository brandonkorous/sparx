# Getting paid — Invoices, Money

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-17

15 screens across two apps. 2 app tours, 4 feature tours, 21 steps.
Replaces [lib/tour/app-tours/money.ts](../../apps/workbench/lib/tour/app-tours/money.ts).

**The mascot never appears in any of these walks and never will.** A cartoon
beside somebody's takings is the one place warmth reads as not taking it
seriously ([DESIGN.md](../../DESIGN.md) §7). The voice here is plain and calm
throughout — no jokes, no encouragement, no exclamation marks. Somebody opening
Money at eleven at night is not in the mood.

**Neither app ever mentions what the business pays WizeWorks.** That lives on
getpiggles.com and never in the operating console
([CLAUDE.md](../../CLAUDE.md) RULE #2); `finance.subscription` is hidden from this
console for exactly that reason and must not reappear in a tour step.

---

# Invoices · 3 screens

The smallest app in Piggles, and one of the most used. Three rows, so it gets one
tour and no feature tours.

## App tour · `invoicing` · 4 steps

### 1 · `invoices.list` — `nav-invoicing.invoices.list`

**Everything you have billed**

> Draft, sent, paid, overdue — the whole lot in one list, newest first. Somebody
> can pay straight from the one you send them, and it marks itself off when they
> do.

### 2 · `invoices.templates` — `nav-invoicing.templates`

**What yours look like**

> Your logo, your terms, your wording, your payment details — set once here rather
> than fixed on every invoice you ever send.

> ⚠ **This screen is a `stub()`** — a declared nav row with a placeholder behind
> it ([catalog/invoicing.ts](../../apps/workbench/lib/surfaces/catalog/invoicing.ts)).
> The step is written in the present tense above because that is the copy it
> should carry the day the screen lands. **Until then, either ship this step
> reworded to "this is where that will live", or leave it out.** A tour is the one
> place in the product where a sentence is read as a promise. See
> [README.md](README.md) §8.

### 3 · `invoices.workflows` — `nav-invoicing.workflows`

**Chasing, without doing the chasing**

> Decide what happens when one goes unpaid — a polite reminder after a week, a
> firmer one after a fortnight. Piggles sends them, and stops the moment they pay.

### 4 · `invoices.close` — no anchor

**That is the whole app**

> Three screens: what you have billed, what they look like, and what happens when
> nobody pays. Anything an invoice needs to know about a customer it takes from
> Customers, so you never type an address twice.

---

# Money · 12 screens

## App tour · `finance` · 5 steps

### 1 · `money.payments` — `nav-finance.payments.list`

**What came in**

> Every payment, however it reached you — a card on your site, a bank transfer
> against an invoice, cash you put in by hand. This is the money side of what the
> other apps have been recording.

### 2 · `money.in` — `nav-finance.payouts.list`

**Where it went afterwards**

> Money taken and money actually in your bank are two different days. This group
> covers the gap: what has been paid across to you, what is still owed, and which
> parts of the business it came from.

### 3 · `money.out` — `nav-finance.spending`

**And what goes out**

> Stock, rent, fuel, subscriptions, the accountant. Four screens for costs — the
> one-offs, the bills waiting, the ones that repeat, and who you pay.

### 4 · `money.profit` — `nav-finance.profit`

**Which is the only way to know what you kept**

> In, minus out, by month and by what you sell. It only tells you the truth once
> your costs are in — until then it is honest about being incomplete rather than
> quietly flattering.

### 5 · `money.handoff` — no anchor

**Four groups, four short walks**

> The wand beside a heading starts one. If you already have an accountant, the
> last group is the one worth ten minutes — it is how they get all of this without
> you emailing anything.

---

## Feature tour · Money coming in · `money.money-coming-in` · 3 steps

### 1 · `nav-finance.payouts.list`

**Money paid to you**

> Each lump that has landed in your bank, and which orders made it up. This is the
> screen that answers "what is this £412.60 on my statement".

### 2 · `nav-finance.receivables`

**Owed to you**

> Everything invoiced and not yet paid, oldest first, with how many days late each
> one is. The single most useful screen in this app for a business that bills
> rather than takes cards.

### 3 · `nav-finance.channels`

**Where money comes from**

> Your site, the shop, trade accounts, bookings. Which parts of the business are
> actually earning, rather than which feel busiest.

---

## Feature tour · Money going out · `money.money-going-out` · 5 steps

### 1 · opening — no anchor

**Costs, in four kinds**

> Until these have something in them, the profit figure is only half a sum. You do
> not have to be exhaustive — rent, stock and wages get you most of the way.

### 2 · `nav-finance.spending`

**Spending**

> Anything you have paid out, with a receipt attached if you have one. Put your
> costs in here and the numbers elsewhere stop being turnover and start being what
> you actually kept.

### 3 · `nav-finance.bills`

**Bills to pay**

> What you owe and when it is due, in date order. The other half of Owed to you,
> and the one that keeps you out of trouble.

### 4 · `nav-finance.recurring`

**Repeating costs**

> Rent, insurance, software, the van. Entered once and counted every month
> automatically, because these are the ones people forget and they are usually the
> biggest.

### 5 · `nav-finance.vendors`

**Who you pay**

> Everybody you pay money to, and what you have paid them. Useful at year end, and
> useful when a price goes up and you want to know how long it has been creeping.

---

## Feature tour · Did you make money · `money.did-you-make-money` · 2 steps

### 1 · `nav-finance.profit`

**What you kept**

> Money in, minus money out, by month. Read it after you have entered a month of
> costs, not before — an incomplete cost list makes a flattering figure, and this
> screen says so rather than pretending.

### 2 · `nav-finance.jobs`

**By job**

> If you work job to job — a project, a wedding, a build — this is what each one
> made after what it cost. It is usually a surprise which ones were worth doing.

---

## Feature tour · Setting it up · `money.setting-it-up` · 2 steps

### 1 · `nav-finance.categories`

**Spending categories**

> The buckets your costs go into. Piggles gives you a sensible set; if your
> accountant wants different ones, change them here and everything sorts itself
> that way from then on.

### 2 · `nav-finance.accounting`

**Handing it to your accountant**

> Connect the books you already keep and everything here goes across on its own,
> coded the way you set up once. If you would rather not connect anything, it
> exports instead.
