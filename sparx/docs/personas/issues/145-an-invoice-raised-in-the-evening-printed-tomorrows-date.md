# 145 — An invoice raised in the evening printed tomorrow's date

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 10 (Renée opening 4459 from the reminder)
**Surface:** the printed invoice and quote (site › trade account › a document; workbench › Print or save as PDF; the editor's live preview)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01, 2026-10-06
**Blocked on:** —

## What happened

Doty raised 4459 at 11:14pm on Oct 6 in Denver. Renée opened it from her reminder. The printed copy read "Issued Oct 7, 2026".

The issue date is the moment the document was made, printed as a UTC date. 11:14pm in Denver is 05:14 UTC the next day. Any document raised after 6pm in Denver (5pm in winter) prints tomorrow's date, while its due date is counted from the business's own day ([099]): a Net 30 bill reads 29 days from "Issued" to "Due".

## What should have happened

"Issued Oct 6, 2026": the day it was in the shop.

## How to reproduce

1. Business clock America/Denver. Raise an invoice after 6pm.
2. Print or save it as a PDF. "Issued" is tomorrow.

## Why it matters

The date on a bill is a fact the customer files it under. A bill dated the day after it was sent reads as a mistake.

## Where it lives

- `wizeworks/packages/crm/src/services/billing-render-service.ts`: `issuedAt: (doc.finalizedAt ?? doc.createdAt).toISOString()`, and the snapshot reprint's `snap.createdAt`.
- `billing-draft-render.ts`: the preview's "issued today" is `new Date()`.

## The fix

- `crm/src/services/billing-ar.ts`: `businessDayOf(moment, zone)`, the business's day of a moment as noon UTC on that day (the form a due date is stored in).
- `billing-render-service.ts` (a live document and a frozen copy) and `billing-draft-render.ts` (the editor's preview): "Issued" is that day.

Siblings: the account statement has the same shape and more to it: filed as [146], for act 11.

Test, proved red:

- `crm/test/integration/billing-document-render.test.ts`, "prints the issue date on the business calendar": Denver, made at 05:14 UTC Oct 7, prints "Oct 6, 2026". The old code prints "Oct 7, 2026". `buyer-output-has-no-cost.test.ts` gained the business row in its fake database.

## Confirmed by

On screen, 2026-10-06, as Renée on Gillett's site: Invoice 4459 reads "Issued Oct 6, 2026 · Due Sep 29, 2026 · Terms Net 30".

## Rating effect

—
