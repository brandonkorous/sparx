# 084 — A trade buyer could not see, accept or be invoiced for the quote she was sent

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 5 (Renée accepts Wasatch Front's quote Q-000002)
**Surface:** site › account › Wholesale account (dashboard, Quotes, Orders, Invoices); workbench › Invoicing › quote; workbench › Commerce › order; the customer sign-in
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** On screen, 2026-10-02. As Doty: sending Q-000002 moved it to Quoted. As Renée: the menu shows "Wholesale account"; Quotes shows Q-000002 "Priced" with its two lines and Accept/Decline; she accepted it. As Doty: an accepted quote shows a solid "Turn it into an order" button; order O-000008 came out at the Fleet prices with PO WFUC-24-0817, and its invoice INV-000003 reads due Nov 1, 2026 (Net 30) with the PO number. A second quote, Q-000004 for Høgberg (4 × O-ring at the Dealer price $3.46, PO HDP-1188), sent, accepted and turned into O-000009, issued INV-000005 by itself: net-terms, due Nov 1, PO HDP-1188. The order page reads "30 days to pay". Measured by curl: Renée's session answered 401 with the workbench's cookie beside it before the cookie fix and 200 after. After both migrations were applied (2026-10-02): Renée's Wholesale account reads credit used $4,753.60, $20,246.40 available, "2 invoices are not yet paid: $4,753.60"; Høgberg's credit used is $13.84; and order O-000009's page lists INV-000005, due Nov 1, 2026, with no offer to bill it again.
**Blocked on:** —

## What happened

Doty priced Wasatch Front's quote and sent it. The email arrived. Then, in order:

1. **Renée could not find it.** Her account menu had no wholesale link after signing in. The site never asked what the shop offers her until a page reload. When it showed, it said "B2B Account".
2. **She was signed out again and again.** The workbench's sign-in cookie, `better-auth.session_data`, was read by the shop's sign-in, which also used the `better-auth` prefix. It failed it and answered "not signed in". A shop owner signed in to the workbench on the same host could not stay signed in to their own site.
3. **The quote said "Draft", with no Accept button.** Sending a quote never moved it to Quoted, the only stage a buyer can accept from.
4. **Her account page was wrong.** "Credit used $4,753.6", "2 unpaid invoices, $4,753.60" over one $678.00 invoice. The unaccepted quote counted as an unpaid invoice and used up $4,075.60 of her credit. The SQL that keeps credit used counted every `unpaid` document, and a quote is `unpaid` from the moment it exists. Two more dev accounts were overstated ($864.00, $302.40). "buyer · NET30", "#O-000007" and "placed" were raw codes. About 70 inline styles and 5 gray `neutral` badges.
5. **The quote card did not add up.** $4,075.60 total over lines of $3,175.60; the $900.00 of core deposits was not shown. Decline used a browser prompt, and Cancel on it still declined.
6. **Accepting told Doty "Q-000002 was approved: take it to the next step".** No name, and not what to do.
7. **"Turn it into an order" was the third row of a menu**, on a quote whose only remaining job was that.
8. **The order had no invoice.** The /b2b page promises "Orders on terms invoice automatically with the buyer's PO number". Only checkout did that. The order also read "Billing address: Not given" and "pays on net30 terms".
9. **Every order invoice on the platform (4 of 4) had no link to its order**, only a note in metadata. The order page then said "You have not asked for the money on this order yet" and offered to make a second invoice.
10. **The order took no stock, and neither did a counter sale.** The /b2b page promises a quote order goes "through the same checkout, inventory, and fulfillment as every other order". Measured on Gillett: nine orders, one stock movement (the web order's). Six counter sales and the two quote orders, 16 units, took nothing. Only checkout, the marketplace import and an approved held order took stock; an order written any other way (counter, quote, typed in by hand) did not. The quote order was also never announced as `order.placed`, so no confirmation email, no "new order" automation and no search entry ("2 orders are not in this box yet").

## Fix

- Sign-in: `customer-auth/src/session.ts` + `server.ts`: the customer instance has its own cookie prefix, `sparx-customer`. Its session cookie keeps its name, so nobody is signed out.
- Site menu: `components/customer-provider.tsx` reads the offers right after sign-in and sign-up; `(authed)/layout.tsx` says "Wholesale account".
- Send: `api-rest/routes/v1/invoicing/documents.ts` `markQuoteQuoted` + `crm` `stageAfterQuoteSent`: sending a wholesale quote that is still being worked on moves it to Quoted.
- Credit: migration `20270530000004_credit_used_counts_only_bills` makes `sync_b2b_credit_used` ask the same three things as `OWED_DOCUMENT_WHERE` and recomputes every account. `credit-used-sql.test.ts` fails if the SQL's lists drift from the app's.
- Portal API: `b2b-portal.ts` summary and invoice list use the new shared `ISSUED_BILL_WHERE` (crm), so quotes and unsent drafts are not invoices. Quotes now return lines, totals, deposits, PO number and the shop's name.
- Portal pages (helper agent): money through `formatMoney`; role, terms and statuses in words (`lib/trade-account-words.ts`); every quote says where it stands; lines, deposit sentence and a summary that adds up; PO number; Decline is an inline panel; no inline styles, no `neutral`, no "B2B" in visible text.
- Task: `automation-actions` `B2B_QUOTE_ACCEPTED_TASK`, "{name} accepted quote {number}: turn it into an order"; the generic approved task skips wholesale quotes.
- Workbench: `invoicing/lifecycle.tsx` (both consoles) shows "Turn it into an order" as the primary button; the menu trigger is colorless. `order-detail.tsx` / `order-detail-parties.tsx` print terms with `paymentTermsLabel` ("30 days to pay").
- Conversion: `crm` `billing-document-conversion-service.ts` issues the net-terms invoice for an account on day terms (`invoiceTermsDays`), made out as the quote was, and announces `b2b.invoice.created`; it fills the order's billing address from the customer's default billing address (`billingSnapshotFrom`).
- Order link: `b2b-ar-service.ts` writes `orderId`; migration `20270530000005_order_invoices_know_their_order` links the 4 already written.
- Stock: `inventory` `linesToSellForOrder` + `commitPlacedOrderSale`, run by a new `order.placed` listener in `commerce/src/consumers` (beside the cancel restock). Any placed order with no sale yet takes its stock, keyed per order line; an order its writer already took stock for is left alone. The conversion now announces `order.placed` like every other order.
- Not backfilled, on purpose: an order placed before this fix may already be reflected in a later stock count (Gillett's six counter sales came before his opening count), so taking it now would count it twice. Gillett's injector and O-ring on-hand are 6 high from O-000008 and O-000009; corrected by a stock count in a later act, not by a script.

## Proof

Each test was proven red by breaking what it guards:

- `customer-auth/src/cookie-prefix.test.ts` (2): removing the prefix reddens 1.
- `crm/test/unit/quote-sent-stage.test.ts` (2): never moving reddens 1.
- `crm/test/unit/credit-used-sql.test.ts` (2): against the previous migration, reddens 2.
- `automation-actions/src/seeds/quote-accepted-task.test.ts` (4): dropping the generic task's exclusion reddens 1.
- `crm/test/unit/conversion-invoice-terms.test.ts` (4): never invoicing reddens 1; taking any address reddens 2.
- `crm/src/services/po-number-carry.test.ts` (+2): skipping the invoice reddens 1.
- `crm/test/unit/ar-document-order-link.test.ts` (2): dropping `orderId` reddens 2.
- `site/lib/trade-account-words.test.ts` (20, helper agent): 14 separate breaks, each reddens at least 1.
- `inventory/src/services/placed-order-sale.test.ts` (4): dropping the "already taken" guard reddens 1.
- On screen: counter sale O-000010, 1 × O-ring; on-hand went 56 → 55 with exactly one `sale` movement.

Measured before the migrations, 2026-10-02: Wasatch Front's credit used is $8,829.20 (INV-000001 $678.00 + INV-000003 $4,075.60 + the accepted quote Q-000002 $4,075.60 counted a second time) and Høgberg's is $27.68 (INV-000005 + Q-000004, the same $13.84 twice). After applying both migrations they should read $4,753.60 and $13.84, and INV-000005 should list on order O-000009.
