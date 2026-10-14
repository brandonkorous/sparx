# 185 — A core credit reads as a "Payment" on the fleet's statement

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · act 13 (a core comes back on an account order)
**Surface:** Workbench › Wholesale › an account › Statement (printed and emailed to the fleet)
**Filed:** 2026-10-09
**Fixed:** 2026-10-10
**Confirmed by:** P01 on screen, 2026-10-11 (the statement)
**Blocked on:** —

## What happened

Renée's old injector came back on O-000007, and its $150.00 deposit came off INV-000001.
Wasatch's statement shows that line as:

> Oct 9, 2026 · Payment, ref Core returned · INV-000001 · −$150.00

Wasatch paid nothing. The shop credited their invoice for an old part they returned.
The totals are right ("Payments and credits $150.00", "Owed at the end $8,323.92").

## What should have happened

"Credit for a returned core" (or similar): a credit, not a payment. Renée reads this
statement to match her own books, and a payment she never made is a question for Doty.

## Where it lives

- `wizeworks/packages/commerce/src/services/core-service.ts` `receiveCores` records the
  credit through `billingPaymentService.recordPayment` with `kind: 'payment'`,
  `method: 'other'`, `reference: 'Core returned'`.
- `wizeworks/packages/crm-schemas/src/invoicing.ts` `BillingPaymentKind` is
  `deposit | payment | refund`: there is no word for a credit.
- `wizeworks/packages/crm/src/services/b2b-statement.ts` `paymentDescription` prints the
  kind as the noun.

## What it would take

A `credit` kind on invoice payments, threaded through every place a payment kind is
read: the statement and aging (`b2b-statement.ts`, `billing-ar.ts`), the invoice's own
payment list in both consoles, receipt emails, and the accounting sync, which must post
a credit note rather than a payment. Matching on the reference text instead would be a
copy edit that breaks the next time somebody rewords it. Larger than the surface under
test, so filed rather than patched.

## The fix

A `credit` kind on invoice payments: money taken off what is owed when nobody paid.

- `crm-schemas/src/invoicing.ts`: `BillingPaymentKind` gains `credit`. The column is
  plain text, so no schema change.
- `commerce/src/services/core-service.ts` `receiveCores`: a returned core's deposit
  taken off an open invoice is recorded as `kind: 'credit'`, reference "Returned core".
- `crm/src/services/b2b-statement.ts` `paymentDescription`: a credit prints "Credit for
  returned core", never "Payment". It still takes the amount off what is owed.
- The invoice print (`billing-render-service.ts`) and the payment list in both consoles
  (`surfaces/invoicing/payments.tsx`) say "Credit".
- `billing-payment-service.ts`: the order payment a credit mirrors onto its order
  carries the note "Credit for returned core", so the order's payment list says it too.
- `b2b/src/invoices.ts`: the "paid by" and "paid with" on a paid invoice come from the
  last real payment, never from a credit.
- `invoicing-reporting-service.ts` (the collected chart and "collected this month")
  and `finance/src/rollup.ts` (Profit): a credit is never counted as money collected
  or as a sale.
- The activity feed names it "Credit taken off an invoice"; the AI tool
  `record_billing_payment` lists the new kind and says what it means.
- Migration `20270530000034_returned_core_deposits_are_credits` moves rows the old
  code wrote (kind payment, method other, reference "Core returned") to the new shape
  and notes their order payments. Only that exact shape is touched.

Tests: `b2b-statement.test.ts` (22 pass; the credit test went red with the credit
words taken out), `core-service.test.ts` (29 pass, now expects a credit). Lint clean.
Typecheck clean for crm-schemas, crm and b2b.

## Confirmed by

Data, 2026-10-10: migration 34 applied to local docker; Gillett's $150.00 on INV-000001
now reads kind `credit`, reference "Returned core", and its order payment carries the
note "Credit for returned core". On screen, 2026-10-11, as Doty: Wholesale › Wasatch Front Utility Contractors, LLC ›
Statement, This month so far: "Oct 9, 2026 · Credit for returned core · INV-000001 ·
WFUC-24-0823 · -$150.00 · $8,323.92", the next line "Payment by check · 4459 · -$2,119.60";
"Payments and credits $2,269.60"; INV-000001 still open, "$528.00 left of $678.00". Not
checked: the printed and emailed copies, and Piggles.

## Rating effect

—
