# 083 — The quote preview printed without its core deposits, and said "Catalog item" to the customer

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 5 (Wasatch Front's quote, Q-000002)
**Surface:** workbench › Invoicing › quote editor › Preview (both consoles); the printed quote
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** On screen, 2026-10-02, as Doty: Preview of Q-000002 shows the injector line, a "Refundable core deposit" row of 6 × $150.00 = $900.00, the O-ring line, Subtotal $3,175.60, Refundable core deposits $900.00, Total $4,075.60, matching the editor. No "Catalog item" under any line. The Deposits card says "No deposit taken." once. The quote email (seq 102944, acked by the email worker) carried the same lines and total.
**Blocked on:** —

## What happened

Doty built Wasatch Front's quote: 6 × Bosch injector at the Fleet price $528.00 with a $150.00 core deposit each, and 2 × O-ring at $3.80. The editor's summary said $4,075.60. The preview, which is what he checks before sending, said:

- Total **$3,175.60**. The $900.00 of core deposits was gone, with no deposit rows. A buyer shown $3,175.60 is then billed $4,075.60.
- "Catalog item" under every line. That is the editor's name for how the price was found. It means nothing to the person paying.

In the editor:

- Under each line, a badge repeated the line's own description word for word.
- The Deposits card said the same thing twice: "Nothing is owed on a quote. Record a deposit here only if…" and, below it, "No deposit taken. A quote is a price, not a bill, so this stays empty unless…".
- The billing address filled in from the customer ended on "US", from a business in Utah to a customer in Salt Lake City.

## Cause

- The preview route (`POST /v1/invoicing/documents/preview`) names every draft field in a Zod schema. Its line schema had no `coreCharge`, so Zod dropped it before the renderer saw it. The renderer and the saved-document path were right. This is the third time a field went missing this way (the document kind in issue 764, the PO number in 077).
- The renderer printed every line type's label, including the `catalog` pricing mode.

## Fix

- `wizeworks/services/api-rest/src/routes/v1/invoicing/documents.ts`: `coreCharge` added to the draft line schema. A type guard now fails typecheck if the renderer's `BillingDraftLine` or `BillingDraftInput` has a field the schemas do not name, so the next missing field is a type error, not a quietly wrong preview.
- `wizeworks/packages/crm/src/services/billing-render-parts.ts`: `printedTypeLabels` prints no type word on a line priced from the catalog. "Service", "Shipping", "Fee" and the core deposit row keep theirs.
- `surfaces/invoicing/product-pick.ts` (both consoles): `linkedProductBadge` shows the linked product's name only when the description says something else.
- `surfaces/invoicing/payments.tsx` (both consoles): the empty Deposits card says "No deposit taken." once.
- `surfaces/invoicing/bill-to-party.ts` (both consoles): the filled-in address leaves off the country when it is the business's own, and uses the shared `localityLine` instead of its own copy.

## Proof

- Removing `coreCharge` from the schema fails typecheck: `Type 'boolean' is not assignable to type '["coreCharge", never]'`.
- `billing-render-parts.test.ts` (+1): printing every label reddens 1.
- `product-pick.test.ts` (+3, both consoles): always showing the badge reddens 1.
- `bill-to-party.test.ts` (+2, both consoles; 2 changed): always printing the country reddens 3.

## Left as designed

Q-000002 is the first quote but has number 2. Quotes and invoices share one counter on purpose: a quote keeps its number when it becomes an invoice (Q-000002 becomes INV-000002). US law does not require gap-free invoice numbers.
