# 102 — Mark as paid ran two words together

**Status:** fixed
**Severity:** cosmetic
**Found by:** P01 · Gillett Diesel Service · act 6 (Høgberg's paid invoice)
**Surface:** workbench › Wholesale › an invoice › Mark as paid (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

The Mark as paid box read "Records the full $13.84 owed on invoice INV-000005as received, and frees up the account's credit."

## What should have happened

"…on invoice INV-000005 as received, …"

## Where it lives

`invoice-detail.tsx` (both consoles): the sentence was JSX text split across a line break after `{invoice.invoiceNumber}`, and the page held no space there (measured in the DOM).

## The fix

The sentence is one string in both consoles. Measured in the DOM after: "Records the full $13.84 owed on invoice INV-000005 as received, and frees up the account's credit."

No unit test: it is markup, and this repo keeps no UI test scripts.

## Confirmed by

On screen, 2026-10-06, as Doty, then marked INV-000005 paid by bank transfer: "Settled $0.00. Paid Oct 6, 2026 · Bank transfer · recorded by Doty Brown."

## Rating effect

—
