# 077 — Wasatch Front's quote came out at full price, made out to the wrong name, with nowhere for their PO number

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 5 (quoting a fleet customer on a trade account)
**Surface:** workbench › Invoices › "Price up a quote" (the invoice editor and its line editor), both consoles; api-rest `/v1/b2b/resolve-price`; the MCP tool `resolve_b2b_price`; the printed quote and invoice; the invoice email
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** not yet confirmed on screen
**Blocked on:** —

## What happened

Doty opened "Price up a quote" to quote Wasatch Front Utility Contractors, LLC, a fleet customer on the Fleet group (12% off, Net 30), for a Bosch remanufactured injector.

1. **The part could not be found by its own code.** The product box said "These are the first 100 of your 653 products ... For any of the others, open it in Selling and add it from there." Typing "0986435621" found nothing.
2. **The price was another part's.** He picked "Bosch Remanufactured Fuel Injector (0986435621)", a second "which version" box appeared, and it read "0986435621 · $635.00". That part is $600.00.
3. **The line said the code twice**: "Bosch Remanufactured Fuel Injector (0986435621) (0986435621)".
4. **No trade price.** The line opened at the $600.00 list price. Nothing on the screen knew Wasatch Front pays 12% less. The first line type, "Product", asked for a "Cost*" and a markup, so the price box Doty expected was not even there.
5. **Bill-to was the person, with no address.** Picking Renée Castañeda filled "Billing name" with "Renée Castañeda" and left "Billing address" empty, although her default address (delivery and billing, "Main office": Accounts Payable, Wasatch Front Utility Contractors, LLC, 2275 S 900 W, Suite 200, Salt Lake City, UT 84119, US) was on file.
6. **No place for their PO number**, WFUC-24-0817. Wasatch Front's accounts department will not pay an invoice they cannot match to it.
7. **The tax box wanted a decimal**: "As a decimal: 0.0875 is 8.75%".

## What should have happened

Type the part's code, get the part. The line reads the part's name once, at Wasatch Front's own price, and says why ("Fleet price: 12% off $600.00"). The quote is made out to the business at its accounts payable address, carries their PO number, and the order and invoice made from it carry the same price and the same PO number. The tax box takes 8.75.

Done-when for act 5: "Wasatch Front's quote converts to an order at their tier price and the invoice reads Net 30 with their PO number."

## How to reproduce

1. Sign in as Gillett Diesel (tenant 5944fe23-be83-4ce5-aafc-ef56b8594508). Open Invoices, "Price up a quote" (`/invoicing/invoices/new?workflow=b2b-quotes`).
2. Customer: Renée Castañeda. Billing name reads "Renée Castañeda"; the address stays empty.
3. Add a line. In Product, type 0986435621. Nothing.
4. Scroll and pick "Bosch Remanufactured Fuel Injector (0986435521)", one digit off and in the first 100. A version box reads "0986435521 · $635.00".
5. Every time.

## Why it matters

Wrong money, in front of the customer: a fleet account is quoted list price, or a different part's price, on a document addressed to a person instead of the business, with no PO number, so it is either sent back or paid late. A trade counter does this every day.

## Where it lives

The cause of each, found in the code and the dev database:

1. `surfaces/invoicing/product-picker.tsx` (both consoles) fetched `/v1/commerce/products?take=100&status=active` and filtered in the browser. Products come back newest-updated first; the 0986435621 injector sat 468th, its near twin 0986435521 sat 96th.
2. **The $635.00 was the right price for the wrong part.** No query key collided and no price list applied: the variant combobox showed the variants of the product Doty actually picked, 0986435521 (variant 7b14f849…, `price_cents` 63500), whose name differs from his part by one digit. He could not pick the right one because it was not in the list. The second box appeared at all because the product list's `variantCount` (`commerce/src/services/product-service.ts`, `_count: { variants: true }`) counted the "-DEFER-CORE-CHARGE" version retired at 03:18 that morning (issue 057), so a part with one live version read as two. The same count drove the Products list's version column and the stock transfer picker.
3. `product-picker.tsx` appended `(variant.title ?? variant.sku)` to a title that already carries the code. The invoice raised from an order did the same (`crm/src/services/billing-from-order-service.ts`, `${it.name} (${it.sku})`).
4. Nothing asked for a trade price. And `/v1/b2b/resolve-price` (b2b `pricingTierService.resolveB2bPrice`) called the `resolve_b2b_price()` SQL function directly, which never reads a signed agreement (`commerce_contract_prices`) although its own comment and the MCP tool's description said it did; it also ran on the bare client, outside the tenant's RLS context. Checkout charges through `pricingService.resolve`, contract first. On the line editor, "Cost" on the default "Product" type is the cost basis for a markup, not the charge.
5. `bill-to.tsx` filled the name through `billingName(customer)` (the typed employer, else the person) and never read the account or the addresses.
6. Web checkout writes `order.metadata.poNumber`; nothing in `@wizeworks/crm` read it. No input for it existed on the editor or on the API.
7. `invoice-summary.tsx` (sparx) took the stored fraction.

## The fix

1. **One search over versions, on the server.** The picker is the console's `SearchPicker` over `useVariantSearch` (`GET /v1/commerce/variants?q=`, the same search the till and bundle picker use since issue 069): name, code, version name or option value. Picking a version is one step; the product-then-version combobox and the 100 cap and its sentence are gone. Rows read "name · version · code (only when the name lacks it) · price"; a draft product is marked "Not on sale"; retired ones are left out; a failed search says "Your products could not be searched just now." with a "Try again" button. `useVariantSearch` gained an `enabled` option. What a row and a line say is `surfaces/invoicing/product-pick.ts`.
2. `product-service.ts` counts live versions only (`_count: { select: { variants: { where: { deletedAt: null } } } }`, five places).
3. `lineDescription`: the product's name, plus in brackets only what it lacks: a version name ("Shop towels (Case of 12, TOW-12)") and the code when the name does not carry it. "Bosch Remanufactured Fuel Injector (0986435621)" now. The order-to-invoice path uses `invoiceLineName` with the same rule.
4. **Trade prices.**
   - `pricingService.resolveForAccount` (commerce) prices through `resolve`, the engine checkout uses, with channel `b2b_portal`, and returns `listPriceCents`, `effectivePriceCents`, the kind of rule and a sentence from `trade-price-words.ts`: "Agreed price until Dec 31, 2026, instead of $600.00", "Their own price, instead of $22.99", "Fleet price: 12% off $600.00", "Bulk price for 10 or more, instead of $22.99", "Their wholesale price, instead of …" when the explanation does not add up to the number.
   - `GET /v1/b2b/resolve-price` answers from it (takes `quantity` and `property_id` too). The b2b `resolveB2bPrice` and its false comment are deleted; the MCP tool `resolve_b2b_price` moved to `api-mcp/src/b2b-price-tools.ts` over the same function, still `read:b2b`.
   - The editor, on a tenant with wholesale switched on and a document billing an account, asks for the price when a part is picked, puts it in the price box and shows the sentence on the line in wholesale's color ("Fleet price: 12% off $600.00"), stored in the line's metadata as `priceNote` so a reopened quote still says it. Typing over the price drops the sentence; a changed quantity asks again. A failed lookup says "Wasatch Front Utility Contractors, LLC's own price could not be looked up just now, so this is the list price. Check it before you send." The core deposit is never discounted.
   - Picking a part on a cost-and-markup line type moves the line onto the "Catalog item" type so the part's own price lands in the box that bills (Piggles already did this; sparx now does too). The two boxes read "Price each" ("What they are charged.") and "Cost to you" ("Optional, and never shown to them. It is how you see your margin." / "What it cost you. The price is worked out from this.").
   - Proof data, read from the dev database: FPPF Total Power Fuel Treatment (90343, $22.99) for Salt Lake County Public Works: the $19.25 set today landed in `b2b_account_product_overrides` (not `commerce_contract_prices`); `resolve_b2b_price` returns 1925, and no contract, price list or bulk price exists for it, so the new code answers $19.25, "Their own price, instead of $22.99". Wasatch Front's injector: `resolve_b2b_price` 52800 and nothing above it, so $528.00, "Fleet price: 12% off $600.00". Both are worked out from the rows and pinned by the unit tests on the same figures; the running API was NOT called (it needs a restart to load the change).
5. **Bill-to** (`bill-to-party.ts`): a customer on a wholesale account is billed as the account ("Wasatch Front Utility Contractors, LLC"), the email stays the person's, the address comes from the default billing (or delivery and billing) address ("Accounts Payable / 2275 S 900 W / Suite 200 / Salt Lake City, UT 84119 / US"), and the document's `companyId` is set to the account. A retail customer keeps their own name and gets their address too. The fill rule (`bill-to-fill.ts`) covers the address the way it covers the name: an empty box, or one still saying what the previous customer's did, follows; anything typed stays. Address box is five rows, with "Filled in from their billing address when you choose the customer. Change it here if this one goes somewhere else."
6. **PO number**, no migration:
   - `crm-schemas`: `poNumber` on create/update document input (63 characters, checkout's limit), `poNumberOf` / `withPoNumber`; it lives in `metadata.poNumber` and is MERGED, so a header save never wipes the send record beside it.
   - Editor: "Their PO number", "If they gave you an order number of their own (a PO number), it is printed on this quote and on the order and invoice made from it, so their accounts team can match them. Leave it empty if not."
   - Quote to order (`billing-document-conversion-service.ts`): `order.metadata.poNumber`. Order to invoice (`billing-from-order-service.ts`): the order's PO number, else the quote's; and an order made from a quote is invoiced to the quote's bill-to and its account (it fell back to the person with no address). Net-terms AR invoices (`b2b-ar-service.ts`, from checkout and from an approved held order) read it off the order.
   - Printed: "PO number WFUC-24-0817" beside the document number on the quote, the invoice, the live preview and frozen snapshots (`billing-document-html.ts`, `billing-render-service.ts`, `billing-draft-render.ts`, `billing-snapshot.ts`, the preview route's body); `{{ document.poNumber }}` for custom templates.
   - Invoice and quote email: "PO number: WFUC-24-0817" (`invoice-sent.tsx`, `invoice-mail.ts`). The email worker's gate (`template-schema.ts`) now names `poNumber`, and also `priceOffer` and `validUntil`, which it had been STRIPPING: every quote email reached the renderer as a bill, "Due on receipt".
   - Order screen (both consoles): "Their PO number: WFUC-24-0817" under who bought it.
   - Statements: there is no customer statement listing invoices in either console or the API (searched), so nothing to carry.
7. Tax: the box takes "8.75" (`tax-rate.ts`), stores 0.0875, can be cleared and retyped, refuses "8,75" or 150 with "Type the rate as a number up to 100, like 8.75." Piggles already took a percent; it now uses the same field, which also fixes its box snapping back to 0 when cleared.

Also, in the files touched: `color="neutral"` removed from the Preview button, the Cancel button, the line badges and the row's edit button; the locked-document notice is `info`.

Tests, each proven red by breaking what it guards:

- commerce `resolve-for-account.test.ts` (5) and `trade-price-words.test.ts` (8). Skipping the contract lookup in `resolve` reddens 1; dropping the "does it add up" check reddens 1.
- crm `po-number-carry.test.ts` (7): conversion without metadata reddens 2; no quote fallback reddens 1; the old code-appending line name reddens 1; the old bill-to reddens 1. `billing-document-html.test.ts` (+1): no PO row reddens 1.
- crm-schemas `po-number.test.ts` (6): replacing the bag instead of merging reddens 2.
- email `invoice-sent.test.tsx` (+1): no PO paragraph reddens 1. email-worker `template-coverage.test.ts` (+40, one per template): leaving `priceOffer` or `poNumber` out of the gate reddens 1 each.
- workbench, both consoles: `product-pick.test.ts` (8, appending the code always reddens 2), `bill-to-party.test.ts` (5, billing the person reddens 1), `bill-to-fill.test.ts` (+4, the address branch off reddens 3), `tax-rate.test.ts` (6, no rounding reddens 1). `customer-picker-data.test.ts`'s bill-to guard now reads `bill-to-party.ts`, where the name is decided.

Sibling screens checked: the till and the bundle picker already search the server (069); the stock transfer picker had the same `variantCount` defect and is fixed by the same count. Piggles had every defect except the cost-and-markup line (it already moved to the catalog type) and the tax box; fixed in both.

## Confirmed by

Not yet confirmed on screen. The API needs a restart to serve the new `/v1/b2b/resolve-price`, and the workbench to load the new editor.

## Rating effect

Not rescored until confirmed on screen.
