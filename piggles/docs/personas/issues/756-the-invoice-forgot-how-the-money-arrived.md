# 756 — The invoice forgot how the money arrived

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 268
**Surface:** `@wizeworks/crm` — an invoice raised from an order; both consoles
**Filed:** 2026-09-20
**Fixed:** 2026-09-20
**Confirmed by:** P03, reading the two screens side by side
**Blocked on:** —

## What happened

The order says how she was paid:

```
Money in
  $30.00 · Cash        Sep 20, 2026, 1:51 AM        Taken
```

The invoice raised from that order, one click later:

```
Payments
  When            Kind        How        Reference    Amount
  Sep 20, 2026    Deposit     Other      —            $30.00
```

**"Other" is the bucket for money nobody could name.** This money had a name on
the row it was copied from, and the screen a bookkeeper uses to match an invoice
against the till is the one that lost it.

## Why

The copy hardcoded it, and the order's payment rows were never fetched at all:

```ts
await tx.billingDocumentPayment.create({
  data: { kind: 'deposit', method: 'other', amount: money.amountPaid, … },
});
```

`money` is `{ total, amountPaid }`, two numbers off the order header. The
`payments` relation was not in the query, so there was nothing to read even if
somebody had thought to. [[feedback_fetched_but_never_rendered]]

## Two vocabularies, not one

They are genuinely different columns, which is why this is a translation rather
than a rename:

```
OrderPayment.processor          stripe paypal manual check wire net_terms
                                card gift_card sparx_pay square
BillingDocumentPayment.method   cash card check ach wire account_credit other
```

`manual` is what the till writes when the shopkeeper picks Cash; a check and a
transfer have their own values, so nothing else lands there (issue 044). Every
gateway is a **card** as far as an invoice is concerned: the How column answers
what the customer handed over, not which company processed it.

## The case that has no answer

Money already in is copied as ONE row, so one method has to cover the lot. When
an order was part paid in cash and part by check, no single word is true, and
`other` is the honest answer rather than the first one or the largest. The note
beside it then says so out loud, so the `Other` does not read as a value nobody
bothered to fill in:

> Already received against order O-000018, in more than one way.

[[feedback_never_present_absence_as_measurement]]

## Files

- `wizeworks/packages/crm/src/services/invoice-payment-method.ts` — new
- `wizeworks/packages/crm/src/services/invoice-payment-method.test.ts` — new
- `wizeworks/packages/crm/src/services/billing-from-order-service.ts` — fetches the payments, uses them

## Proof

10 tests, proved red by putting `return 'other'` back: **3 of 10** fail. The
seven that stay green are the ones that were accidentally right, which is the
point of counting them — `other` for a mixed payment, `other` for buying on
terms, `other` for a processor nobody listed, and the three notes.

Two gateways in one order must NOT fall through to `other`, because they mean
the same thing to an invoice. That case is its own test.
