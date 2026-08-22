# 066 — A cheque was spelled two ways, and a transfer was called ACH

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Thistle & Rye · standing checks
**Surface:** mypiggles › Money › Invoices › Record payment, and Sell › Orders › Record payment
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P01 · Marisol · on screen 2026-08-21

## What happened

Marisol takes money four ways: cash, a card, a cheque, and someone paying into
her bank. The console named those four things differently depending on which
screen she was standing on.

- The **order** payment control offered **Cheque**.
- The **invoice** payment dialog offered **Check**.
- The wholesale invoice dialog offered **Check** as well, plus
  **"Bank transfer (ACH)"** and **"Wire"**.
- The finance payments list called a cash sale **"Recorded by hand"**, where the
  order pane called the same row **"Cash"**.

ACH is the name of a United States interbank clearing system. It is on a screen
for people who have never heard of it, in brackets, as if it were a clarification.

## What should have happened

One word per thing, everywhere. She is recording the same act — money arrived,
this is how — and which pane she happens to be in should not change its name.
Non-technical audience is a CORE rule; so is the platform's single-point-of-change
rule, and four hand-written label maps is what breaks it.

## How to reproduce

1. Open an unpaid order → **Record payment** → the method menu says **Cheque**.
2. Open **Money › Invoices** → any invoice → **Record payment** → **Check**.
3. Open **Money › Payments** → a cash sale reads **Recorded by hand**.

Every time.

## Why it matters

It is not a typo — it is four screens that were written separately about one
column, which means anything else that column needs (a new method, a report that
groups by it) has four places to go wrong. And a business owner reading "ACH"
does not learn anything; she learns that this screen was not written for her.

## Where it lives

Four maps of the same vocabulary:

- [surfaces/invoicing/payments.tsx](../../../apps/workbench/surfaces/invoicing/payments.tsx) `METHOD_LABELS`
- [surfaces/b2b/invoices-data.ts](../../../apps/workbench/surfaces/b2b/invoices-data.ts) `PAID_METHOD_LABELS`
- [surfaces/commerce/data.ts](../../../apps/workbench/surfaces/commerce/data.ts) `PAYMENT_PROCESSOR_LABELS`
- [surfaces/finance/format.ts](../../../apps/workbench/surfaces/finance/format.ts) `methodLabel`

## The fix

**[lib/payment-methods.ts](../../../apps/workbench/lib/payment-methods.ts)** owns
the words, and all four sites read from it — the same shape as the existing
[lib/payment-terms.ts](../../../apps/workbench/lib/payment-terms.ts), which was
written after the same class of drift about payment terms.

The words: Cash · Cheque · Card · Bank transfer · Wire transfer · On account ·
Account credit · PayPal · Other.

Three judgement calls worth writing down:

- **`ach` is "Bank transfer"** — the ordinary money-into-my-account kind, with no
  clearing-system name in brackets.
- **`wire` stays separate, as "Wire transfer"**, because a distributor settling a
  wholesale invoice by wire means the same-day fee-bearing one, and the two sit
  in the same menu on a B2B invoice. Collapsing them would put two identical
  entries in that menu.
- **The order form's transfer option now stores `ach`, not `wire`.** It is
  labelled for a shop receiving an ordinary transfer, and `wire` did not mean
  that. Rows already carrying `wire` still read "Wire transfer", which is honest —
  nothing is rewritten.

`paidByHand()` in commerce gained `ach` alongside `manual`/`check`/`wire`; it
drives the refund wording, and a transfer that never went through a gateway has
nothing to send money back to.

`finance`'s "Recorded by hand" is gone: the order form writes `manual` only when
the shopkeeper picks Cash — a cheque and a transfer have their own values — so
"Cash" is what that row means, and issue
[044](044-she-could-take-the-money-and-had-no-way-to-write-it-down.md) already
settled that for the commerce pane.

## Confirmed by

Re-run as Marisol on 2026-08-21.

**Invoice side** — INV-000001 › Record a payment › How it was paid:

> Cash · Card · **Cheque** · **Bank transfer** · Wire transfer · Account credit · Other

No "Check", and no clearing-system acronym in brackets.

**Order side** — O-000002 › Money in › How they paid, read as value → label:

```
manual → "Cash"
check  → "Cheque"
wire   → "Wire transfer"
```

Both screens spell a cheque the same way, which is the whole complaint.

**And the write works**: recorded $4.25 against O-000002, a 201, and the row now
reads **$4.25 · Wire transfer · Taken**.

## The correction this needed, found by driving it

The first version of this fix stored **`ach`** on the order form, on the reasoning
that a shop receives ordinary transfers rather than same-day wires. That was
wrong and only the screen found it: the ORDER endpoint's processor enum is
`stripe|paypal|manual|check|wire|net_terms` with no `ach`, so recording a payment
returned **422**. It typechecked, it linted, and 1147 catalog tests passed over it.

Reverted to `wire`, and the constraint is now written into
[lib/payment-methods.ts](../../../apps/workbench/lib/payment-methods.ts) beside
the label so the next person does not repeat it. The B2B invoice endpoint is a
different enum that DOES accept `ach`, which is why the two coexist.

It also surfaced [074](074-the-screen-told-her-request-validation-failed.md) — the
422's toast read "Request validation failed."
