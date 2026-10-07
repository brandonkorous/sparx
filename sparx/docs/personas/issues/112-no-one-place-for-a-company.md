# 112 — No one place for a company: orders on one page, deals on another, and no link between them

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 7 (the done-when: "opening Wasatch Front shows its people, deals, orders and invoices in one place")
**Surface:** workbench › CRM › Companies › a company; Wholesale › Accounts › an account; a new deal (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Wasatch Front has two pages, one record. Search everything opens the Wholesale account: people who can order, the fleet, links to their orders, quotes and invoices, and the statement, but no deals. The CRM company page has people, what they owe, deals and requests, but no orders. Neither page linked to the other, so from the page search opens, the deals did not exist.

The company page's Deals section also had no way to add a deal for that company: "No deals with this company yet." and nothing to press.

## What should have happened

Opening the company shows its people, deals, orders and invoices together, and a deal can be started from there already linked to it.

## Why it matters

The question an owner opens a customer to answer is "what is going on with them". Split across two pages that do not know about each other, the answer is whatever page you happened to land on.

## The fix

Both consoles:

- `surfaces/crm/company-detail.tsx`: a new **Orders** section (every order by anyone who works there, newest first, who placed it, its status and total, "The latest 20 of N" when there are more). The Deals section has **Add a deal**, which opens a new deal already linked to the company. When the wholesale module is on, the Trade terms section has **Fleet, buyers and statement** (in the wholesale color), which opens the wholesale page.
- `surfaces/b2b/account-detail.tsx` (Piggles: `account-detail/activity-sections.tsx`): **Their deals and requests** (in the CRM color, only when the CRM is on) opens the company page.
- `surfaces/crm/deal-detail.tsx`: a `companyId` opening a new deal presets its company, as `customerId` already did.
- `surfaces/commerce/data.ts` (Piggles: `order-queries.ts`): the orders query takes a `companyId`; its parameters are built by `orderListParams`.
- Sparx's deal screens now say "step" where they said "stage", matching the pipeline editor ([110]) and Piggles.
- Found on the same walk and fixed the same way: **People here** had no way to add a person ("Open a contact and set their company…"); it now has **Add someone**, which opens a new customer already at that company. **Requests** had no way to add one; **Add a request** opens a new request naming the only person there when there is one (`newRequestParams` in `companies-data.ts`). "Add a company" said "Set up a business that buys from you at agreed prices", wrong for a prospect; it now reads "Add a business you deal with: a customer, a prospect or a partner…". And a customer page's **+ Deal** brought the person but not their company ("No company linked" for Kekoa at Uintah Basin), while picking the same person on the deal brought both; it now passes their company too.

Tests, proved red:

- `surfaces/crm/new-request-params.test.ts`, both consoles: never naming the person reddens 1 of 2.

Test, proved red:

- `surfaces/commerce/order-list-params.test.ts`, both consoles: dropping the company filter reddens 1 of 2.

## Confirmed by

On screen, 2026-10-06, as Doty: Wasatch Front's company page shows People here (Marcus, Renée, Teodora), Orders (O-000015 Canceled, O-000014 To collect, O-000011 To send, O-000008 To send, O-000007 To collect, all by Renée), What they owe ($5,976.80, [111]), Deals and Requests. "Add a deal" opened "Start a deal" with Company already Wasatch Front; "Service plan for all 38 RAM 3500s, 2027" saved linked to the company and to Renée. "Fleet, buyers and statement" is on the Trade terms section. Uintah Basin Oilfield Services was added as a prospect (24 trucks, label "prospect"); Add someone opened "Add a customer" with Uintah filled in, and Kekoa Aldana-Price saved under it; his + Deal opened with both Kekoa and Uintah; Salt Lake County's Add a request opened with Dana already named.

## Rating effect

—
