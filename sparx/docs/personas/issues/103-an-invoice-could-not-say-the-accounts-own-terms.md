# 103 — An invoice could not say the account's own terms

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 6 (reading Salt Lake County's INV-000015)
**Surface:** the printed and previewed bill, its frozen copies, and the invoice email (every console and the buyer's site, which all print through one renderer)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06 (INV-000018)
**Blocked on:** —

## What happened

Salt Lake County is on Net 45. INV-000015 was due Nov 20, correctly, and its footer, Doty's own template text, said "Fleet and wholesale accounts: payment due Net 30 from the invoice date." Nothing on the bill could say the account's own terms, so one template had to tell every account the same thing. Brandon chose to build it (2026-10-06, option 1).

Found on the same path: the invoice email printed "PO number: …" twice on every invoice that carried one. Its test used `toContain`, which passes with two.

## What should have happened

The bill states the terms it was issued on, next to its due date, and keeps them if the account's terms change later. The email says it once.

## How to reproduce

Before the fix: any invoice on account, Preview. Number, Issued, Due, PO number; no terms anywhere but the template's own words.

## Why it matters

A county's accounts department pays on the terms printed on the bill. "Net 30" on a Net 45 bill is a dispute or an early payment the county did not owe.

## Where it lives

A billing document had no record of its terms. The PO number already rode the right path: frozen in the document's metadata when issued (`withPoNumber`), read by `poNumberOf` in the live render, the frozen snapshot, the draft preview and the email.

## The fix

The terms follow that path exactly:

- `paymentTermsOf`, `withPaymentTerms`, `paymentTermsWords` in `@wizeworks/crm-schemas` (`invoicing.ts`). Only a day count is stored or printed ("Net 45"); "pay up front" and "nothing agreed" print nothing. A bill that already has terms keeps them.
- Frozen when a bill is issued: `createOrderArDocument` (orders on account, quotes accepted, bills raised by hand) and a bill entering its payable stage in the editor (`payerTermsOf`, the account's or the payer's employer's).
- Printed: "Terms Net 45" under Due in the bill's header (`billing-document-html.ts`), from the live document, a frozen copy, or the draft preview; never on a quote. The email: "It is due by November 20, 2026 (Net 45)."
- The email prints the PO number once.

Bills issued before this carry no terms and print none: what an older bill was issued on is not on record, and a guess from today's account would be a claim.

Tests, each proved red against the old code:

- `crm-schemas/src/payment-terms-words.test.ts` (new, 5).
- `crm/test/unit/billing-document-html.test.ts` "prints the terms beside the due date, on a bill only", and `ar-document-order-link.test.ts` "freezes the account's terms onto the invoice, by order or by hand": the old code reddens 2.
- `email/src/templates/invoice-sent.test.tsx` "prints the PO number once" and "names the terms beside the due date": the old template reddens 2.

## Confirmed by

On screen, 2026-10-06: Dana ordered 4 × FPPF Total Power Fuel Treatment at her contract $19.25 on account, PO SLCO-FM-26-1210 (O-000019, $77.00). INV-000018 stored `net45`, due Nov 20, and its Preview reads "Due Nov 20, 2026 · Terms Net 45 · PO number SLCO-FM-26-1210".

Not seen: the email itself, which the dev console prints to the terminal running the event worker; covered by the template test above.

Doty's footer still says "Net 30": it is his own text, and with the terms now printed per account he can change it to "payment due by the date above".

## Rating effect

—
