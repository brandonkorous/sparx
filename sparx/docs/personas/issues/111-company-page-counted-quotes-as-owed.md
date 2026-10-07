# 111 — The company page counted five quotes as money owed

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 7 (opening Wasatch Front's company page)
**Surface:** workbench › CRM › Companies › a company › What they owe; a customer › Invoices (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Wasatch Front's company page said "$13,469.60 outstanding across 9 documents" and listed Q-000002, Q-000006, Q-000011, Q-000012 and Q-000013 as "Owed". The account's own statement, the Wholesale list and Owed to you all said $5,976.80 on four invoices.

## What should have happened

A quote is a price offered. It shows where it stands (Draft, Submitted, Accepted) and nothing owed, on every list of documents.

## Why it matters

"What they owe" is the number that decides whether Doty takes the next order on account. It was more than twice the truth, and Q-000002 was counted twice: once as itself and once as the invoice it became (INV-000003).

## Where it lives

The Invoicing list learned this in issue 085 (`priceOffer`, `stageName`, `stageType` on every list row). Two other lists read the same rows and kept reading the payment status: the company page's "What they owe" (and its total) and the customer's Invoices tab. A fix that left its neighbors behind; [094] fixed the wholesale side of the same question.

## The fix

Both consoles:

- `surfaces/invoicing/types.ts`: `documentRowState(doc)` and `owedOn(doc)`, with `priceOfferTone` moved here from the Invoicing list. One rule for every list.
- `surfaces/invoicing/invoice-list.tsx`: uses it (no change in what it shows).
- `surfaces/crm/company-detail.tsx`: the rows, the Owed column and the outstanding total use it; the description says nothing is owed on a quote until it becomes an invoice.
- `surfaces/crm/customer-related.tsx`: the Invoices tab rows and Owed column use it.

Test, proved red:

- `surfaces/invoicing/document-row-state.test.ts`, both consoles: reading the payment status reddens 2 of 3.

## Confirmed by

On screen, 2026-10-06, as Doty: Wasatch Front › What they owe reads "$5,976.80 outstanding across 4 documents". INV-000014, INV-000007, INV-000003 and INV-000001 read Owed with their balances; Q-000013 Submitted, Q-000012 Submitted, Q-000011 Draft and Q-000006 Accepted show a dash. The figure matches the statement and the credit line ("$5,976.80 of $25,000.00 used").

## Rating effect

—
