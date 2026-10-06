# 085 — The /b2b page promised what a trade order did not do

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 5 (checking the /b2b promises after Renée accepted Q-000002)
**Surface:** site › account › Wholesale account (quotes, invoices, print page, checkout confirmation, orders); workbench › Invoicing › quote; workbench › Wholesale › Approvals; workbench › Automations; email (`invoice-sent`); sparx.works /b2b
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** On screen, 2026-10-02, as Doty and as Renée. (1) Doty priced and sent Q-000006 (4 O-rings at the Fleet price, PO WFUC-24-0902); the email carried the PO and a link to Renée's copy. Renée accepted it on the site: "You accepted this quote. It is now order O-000011." O-000011 was placed from the wholesale portal on Net 30, INV-000007 was issued by itself (due Nov 1, PO WFUC-24-0902) and emailed to her 13 seconds later by "Invoice on terms: email it to the buyer"; credit used went $4,753.60 → $4,768.80 and 4 O-rings left the shelf. (2) Doty turned Salt Lake County's Q-000008 (2 turbo actuators, $3,715.00, PO SLCO-FM-25-0142) into an order: O-000012 waited for sign-off, the queue said "Over your $2,500.00 spending limit.", Doty approved it, INV-000009 was issued (Net 45, due Nov 16, made out to the county, PO kept) and emailed to Dana, credit used $3,715.00, 2 actuators taken. (3) O'Malley's Q-000010 (7 fuel tanks, $11,168.08 against a $10,000.00 limit) waited with "Over the credit limit: it comes to $11,168.08 and the account has $10,000.00 of credit left.", the toast said it was waiting, the task named Seamus O'Malley, and Doty rejected it: canceled, no invoice, no credit used, no stock moved. Renée's quote and invoice print pages showed the shop's branded documents with their PO numbers; the Invoices list shows accepted quotes as "Accepted" and its Owed filter lists only the 3 invoices; Wasatch's account page reads $4,753.60 used, $20,246.40 left. Not checked: the browser's print dialog itself (it would block the shared test browser), the Enter key on sign-in (a password-manager extension in the test browser takes it), and the Piggles console on screen (typechecked and tested).
**Blocked on:** —

## What happened

Doty read the /b2b page as a buyer of the product would, beside what Wasatch Front's quote had just done. Five sentences on it were not true:

1. **"On accept, the quote converts straight to an order."** Accepting only moved the quote to Accepted. The order waited for Doty to notice a task and press a button.
2. **"Orders on terms invoice automatically with the buyer's PO number."** The invoice was written and then sat there. Measured: INV-000001, -003 and -005, every one "Not sent yet". Only the business's Send button ever sent an invoice, so no buyer on terms received one, from checkout or from a quote.
3. **"When an account would run over, the order holds for your approval."** Checkout refused it instead, which reached only the buyer. An accepted quote would have done neither: it made no order to decide about.
4. **"The buyer gets a branded quote PDF."** The buyer got an email with the figures in it and nothing to keep, print or file. Only the business could print the document.
5. **"The PO rides onto the invoice and every statement."** There are no statements. (Built by a helper agent; see its own section below.)

And, found on the way:

6. **A held order told nobody.** `b2b.order.pending_approval` had zero listeners. The order sat in Approvals until somebody looked. The approvals screen said nothing about why an order was waiting.
7. **The checkout confirmation said "Order confirmed ... has been placed" for a held order**, which is neither. The buyer's order list called it "Pending approval", the status code read aloud.
8. **An invoice made from an accepted quote never reached the broker.** `b2b.invoice.created` and `b2b.order.pending_approval` were not in the platform bus's forwarded topics, so the search index and every automation missed them.
9. **Signing off a held quote order would have issued no invoice.** The sign-off reads the order's payment terms, and a quote order never stored them.
10. **Every money figure on the buyer's account pages was printed in dollars** (`'USD'` typed into the page), whatever the shop trades in. The invoice list API never sent a currency.
11. **"Cancelled"** in four buyer-facing labels (British spelling).
12. **The workbench Invoices list called accepted quotes "Owed".** Q-000002 read "Owed · $4,075.60" under INV-000003 for the same order, and the "Owed" filter kept it: a quote carries `unpaid` from the moment it exists, and the filter asked only the payment status. (The Outstanding figure above it was right; only the rows and the filter were not.)
13. **The wholesale price form called a price rise a saving.** "They would pay $559.06 instead of $621.18" compared a new price with the LIST price. Wasatch Front, on Fleet, already pays $528.00 for that injector, so the "discount" raised their price. The price box also showed a made-up "39.99" as a placeholder.
14. **A reopened quote's catalog lines said only "Linked product".** The product's name lived in the editor's memory, so after a reload the badge could not say which product a line draws from.
15. **A task about an order printed a blank where the customer's name goes.** "Order O-000012 from is waiting for your sign-off": the engine's own customer fields (every order, fulfillment, subscription and return event) carried no name at all, so `{{customer.fullName}}` was empty.
16. **The customer search hid the person's name.** A long company line ("Salt Lake County Public Works Department, Fleet Management Division") was set never to shrink, so "Dana Whitcomb-Nguyen" was squeezed to nothing and the Wholesale badge sat on top of the company name.
17. **A held order said "To send"**, asking somebody to pack an order nobody had approved, and **an order made from a quote said "Added by hand"**.
18. **The quote editor's right column was hard to read.** The pinned Summary's text showed through the Signature card, the Deposits sentence stood three words to a line beside its button, and History scrolled sideways to reach its print button.
19. **"B2B Quotes" and "Net-terms AR"** were the names of the two wholesale workflows, shown as the quote editor's document type.
20. **Four automation database tests asserted seed names no seed carries** ("B2B overdue escalation" was renamed "Chase overdue wholesale invoices" weeks ago). CI skips them, so they failed silently.

## Fix

- One rule for a trade order, whoever writes it: `crm/src/services/account-order-gate.ts` (`termsDecision`, `findHoldingRule`, `withApprovalHold`, `approvalHoldReasons`). An account on credit hold, suspended or not trading is refused; an order past the credit limit, or covered by a spending limit, waits for sign-off with both reasons kept on the order. Checkout and the quote conversion both ask it. Checkout's own `termsRefusal` is gone.
- Accepting places the order: `api-rest/routes/v1/public/b2b-portal.ts` accept route refuses a stopped account before the quote moves, accepts, then `convertToOrder(..., { channel: 'b2b_portal' })`. If the order still cannot be made, the buyer is told why and the business gets a task.
- `billing-document-conversion-service.ts`: applies the rule; a held order is `pending_approval`, has no invoice yet, carries `paymentTermsRequested` and its hold reasons, and is announced as `b2b.order.pending_approval`. Returns `{ document, order, invoiceId, held }`.
- `b2b/src/approval.ts`: signing off a quote order bills it as the quote was made out; the queue returns each order's hold reasons.
- Platform bus forwards `b2b.invoice.created` and `b2b.order.pending_approval` (`crm/src/pubsub-bridge.ts`).
- One invoice email for the Send button and the automation: `crm/src/services/billing-document-mail.ts` builds it; `api-rest/lib/invoice-mail.ts` keeps only the immediate publish. New automation step `b2b.send_invoice` (`automation-actions/src/b2b.ts`), a resolver for `b2b.invoice.created`, and the seed "Invoice on terms: email it to the buyer" (skips one already sent by hand).
- Seed "Wholesale order waiting: sign it off" opens a task on `b2b.order.pending_approval`. The uncommitted "Quote accepted: turn it into an order" seed from 084 is retired: there is no step left to do by hand.
- Print or save as PDF: `GET /v1/public/b2b/portal/:accountId/documents/:id/print` serves the buyer the same branded page the business previews (a priced quote, or an issued invoice, on their own account). New page `site/app/account/(authed)/b2b/[accountId]/documents/[documentId]`. Linked from every priced quote, every invoice, and a button in the quote and invoice email (`viewUrl`, named in the worker's prop gate).
- Site: an accepted quote names its order ("It is now order O-…" / "waiting for … to approve it"); a refused accept shows the reason instead of "Please try again"; the checkout confirmation reads "Order received ... waiting for us to approve it" for a held order; a held order reads "Waiting for approval".
- Consoles (both): the approvals queue shows why each order waits ("Over the credit limit: it comes to $X and the account has $Y of credit left." / "Over your $2,500.00 spending limit."); every empty-queue sentence says the credit limit still holds orders; the account status sentence and the convert toast say so too; the convert error shows its reason. The automation catalog knows the new step and both events.
- Currency: the portal summary and invoice list carry the shop's currency; the pages use it.
- /b2b page (`sparx/apps/web/components/marketing/b2b-sections.tsx`): the quote "is sent back" sentence names the email and the copy to print or save as a PDF; the accept sentence says it is invoiced on their terms through the same credit checks and approval rules.
- Invoices list (`crm` `billingDocumentService.list` + both consoles' `invoice-list.tsx`): a payment-status filter asks `ISSUED_BILL_WHERE` too (not for "Written off"); each row knows `priceOffer`, `stageName`, `stageType`; a quote shows where it stands ("Accepted", green) and no balance.
- Wholesale price form (both consoles, `surfaces/commerce/trade-price-now.ts` + `product-trade-pricing.tsx`): compares the new price with what they pay today (one business: `/v1/b2b/resolve-price`; a group: its own price, else its blanket discount, else list) and says a rise out loud. No made-up placeholder.
- Quote lines (both consoles, `invoicing/line-price-note.ts`, `save.ts`, `invoice-editor.tsx`): the picked product's name is saved in the line's metadata beside the price note and read back on reopen; a line no longer linked to a product keeps no name.
- Engine customer fields (`automation/src/resolvers/builtins.ts`): first, last and full name, as the richer resolver in automation-actions always had.
- Search picker results (both consoles, `components/search-picker.tsx`): name and badge on one line, the company and email below it, wrapping.
- Order words (both consoles): a held order reads "Not to send yet" with why; an order made from a quote reads "Made from Q-000008" (`lib/console/channels.ts`, from the `document:` source the conversion writes).
- Editor rail (both consoles): the pinned summary sits above what follows it (`EDITOR_RAIL_STICKY`); every section header wraps instead of squeezing (`FormSection`, the description keeps 16rem); History is a list with its print button beside each record (and the button is colorless, not `neutral`).
- Workflow names: "Wholesale quotes" and "Invoices on account" (`crm-schemas` builtins), and migration `20270530000006_plain_names_for_wholesale_workflows` renames the rows still carrying the old built-in name (applied: 39 and 17).
- Integration tests read seed names from the seeds, and the first reconcile test has the same time budget as its sibling.

## Proof

Each new test was proven red by breaking what it guards:

- `crm/test/unit/account-order-gate.test.ts` (9): putting back "refuse past the limit" reddens 4; dropping the zero floor reddens 1.
- `crm/src/services/po-number-carry.test.ts` (+4): removing the rule from the conversion reddens 3.
- `sparx|piggles workbench surfaces/b2b/approval-hold-notice.test.ts` (+4 each): dropping the credit sentence from one state and printing "$0.00 of credit left" reddens 2.
- `site/lib/trade-account-words.test.ts` (+3): the old "This quote was accepted." reddens 3.
- `email/src/templates/invoice-sent.test.tsx` (+2): hiding the button reddens 1; `email-worker` gate: dropping `viewUrl` reddens 1.
- `crm/test/unit/document-list-quotes.test.ts` (3): asking the payment status alone, and never marking a price offer, reddens 2.
- `surfaces/commerce/trade-price-now.test.ts` (8, each console): comparing with the list price and calling every change a cut reddens 4.
- `surfaces/invoicing/line-metadata.test.ts` (4, each console): not saving the name reddens 2.
- `automation/test/unit/customer-fields.test.ts` (2): dropping the full name reddens 2.
- `lib/console/channel-from-quote.test.ts` (2, each console) and the waiting-order shipping test (1, each console): dropping the quote branch and the waiting case reddens 2.
- `automation-actions/src/seeds/b2b-order-seeds.test.ts` (5): leaving the invoice email out of the seed set and dropping its "already sent" condition reddens 2.
- Test runs: crm 367, commerce 339 (8 moved to crm), b2b 30, automation 46, automation-schemas 19, automation-actions 75 (incl. database suites), email 251, email-worker 84, api-rest 324, site 211, workbench approvals notice 16 + automations 53.
