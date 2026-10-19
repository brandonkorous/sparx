# 361 — Invoice emails listed lines with no name, and the receipt counted a credit as paid

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · checking issue 183 (a split core credit), in the dev outbox
**Surface:** every invoice email's item table, and the "Payment receipt" email (`api-rest/src/lib/email-data.ts`)
**Filed:** 2026-10-19
**Fixed:** 2026-10-19
**Confirmed by:** P01 in the dev outbox, 2026-10-19
**Blocked on:** —

## What happened

Dana paid $500.00 and $600.00 on INV-000015, and her 2 old injectors came back, taking the last
$220.00 off as a core credit. Her receipt read "Total paid $1,320.00", and its item table read
"Item Qty Amount · 2 $1,020.00": a quantity and an amount with no item, and no core deposits.

## What should have happened

"Total paid $1,100.00", the money that came in, with the $220.00 core credit named apart. Each
line named, with its core deposit under it.

## How to reproduce

1. Send any invoice email with lines. The item column is empty.
2. Take a core credit off an invoice and pay the rest. The receipt counts the credit as paid.

## Why it matters

A customer's accounts team files the receipt. A list of amounts with no items cannot be matched
to anything, and "Total paid" larger than the money sent reads as a mistake to correct.

## Where it lives

The invoice data gave each line `description`; the shared item table reads `name`. The sample
data used for previews had `name`, so every preview looked right and every send was blank. The
receipt's "Total paid" was `{{invoice.total}}`.

## The fix

`invoiceItemRows` (`email-item-rows.ts`): each line's `name` (and `description` for an email a
business wrote), and its core deposit row. `invoiceMoneyIn`: deposits and payments less refunds
as `invoice.paid`; credits apart as `invoice.credited`, empty when none. The receipt reads "Total
paid {{invoice.paid}}" and a "Core deposits taken off" row that drops when empty. The outgoing
receipt body is on the refresh list.

Test, red first: `email-item-rows.test.ts` (3 new). builder 206 and builder-schemas 383 pass;
api-rest `tsc` clean. Lint and format clean.

## Confirmed by

P01, 2026-10-19, after the email reconcile ran for Gillett. Wasatch paid the $528.00 left on
INV-000001 (its $150.00 core came back on Oct 9); the receipt read "Total paid $528.00 · Core
deposits taken off $150.00 · Item Qty Amount · Order O-000007 1 $678.00".

## Rating effect

—
