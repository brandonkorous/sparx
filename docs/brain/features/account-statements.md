---
title: Account statements for trade (B2B) accounts
node: features
type: entry
status: active
applies-to: [both]
sources:
  - wizeworks/packages/crm/src/services/b2b-statement.ts (the arithmetic, pure)
  - wizeworks/packages/crm/src/services/b2b-statement-service.ts (the read + recipients)
  - wizeworks/packages/crm/src/services/b2b-statement-html.ts (the print page)
  - wizeworks/services/api-rest/src/routes/v1/b2b/statements.ts (staff API)
  - wizeworks/services/api-rest/src/routes/v1/public/b2b-portal-statement.ts (buyer API)
  - wizeworks/services/api-rest/src/lib/statement-mail.ts (the `account-statement` email)
  - wizeworks/packages/email/src/templates/account-statement.tsx
  - sparx/apps/workbench/surfaces/b2b/account-statement.tsx (+ piggles twin)
  - wizeworks/apps/site/app/account/(authed)/b2b/[accountId]/statement/page.tsx
  - docs/10-b2b-wholesale-prd.md §7 Account statements
---

Version: 1.0 · Author: Brandon Korous · Last Updated: 2026-10-02

A **statement** is one trade account's money for a period: what it owed at the start
(opening), every invoice issued, payment received, refund and write-off in the period in
date order with a running balance, what it owes at the end (closing), what is still
open, and how late (aging: not yet due, 1 to 30, 31 to 60, 61 to 90, over 90 days late,
as of the LAST day of the period). Every invoice row and every payment row carries the
**buyer's own PO number**, because that is what their accounts department reconciles
against. Part of the **b2b** module. No schema: it is computed from existing rows.

- **What counts as a bill:** `ISSUED_BILL_WHERE`, scoped `companyId = account`, the same
  rule and scope as the buyer's invoice list, the aging report and `credit_used`. Quotes,
  estimates, drafts and void-stage documents never appear. A bill written off
  (`voidedAt` on a final stage, the `write_off_b2b_invoice` path) stays, with a write-off
  row for what was still owed that day, so last month's statement and this month's add up.
- **Dates:** issued = `finalizedAt ?? createdAt`; paid = `billing_document_payments.receivedAt`
  (refunds add back). Calendar days in UTC like every printed date. Blank period = first of
  this month to today on the BUSINESS's calendar; an end after today is refused.
- **Money** is whole cents end to end; closing = opening + charges - credits by construction.
- **Aging** files through `agingBucketKey` in `billing-ar.ts`, the one copy of the 30/60/90
  boundaries the AR aging report also uses.
- **Where:** workbench and Piggles account pane, a Statement section (period picker, print,
  "Email it to them" behind a confirm naming who it reaches); the buyer's site at
  `/account/b2b/<id>/statement`, linked from the account page. Both print through the
  same branded HTML (the invoice letterhead: `resolveInvoiceBrand`).
- **Email** (`account-statement`, sent by publishing `email.send`): to the account's main
  contact and the address on its latest invoice; only if neither exists, to everyone on
  the account. Lists open invoices beside their PO numbers and links to the site page for
  the same period.

**Why:** the B2B marketing page promises the buyer's PO number "rides onto the invoice and
every statement, so AP can reconcile without a phone call." The invoice half was built in
issue 077; there was no statement anywhere until persona run P01 (a diesel shop billing
fleets on Net 30).

**How to apply:** a new money event on a bill (a credit note, say) must become an event in
`computeStatement` or the statement stops adding up. Keep the bill filter on
`ISSUED_BILL_WHERE`; never re-spell it.

Related: [[features]], [[modules]], [[ship-gate]], [[core-charges]]
