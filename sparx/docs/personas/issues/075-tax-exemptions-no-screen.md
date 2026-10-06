# 075 — Doty had nowhere to put a customer's tax exemption certificate

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 5
**Surface:** workbench › Wholesale › Accounts › an account; CRM › a customer › Details; Sell › Tax (both consoles); checkout and repeat deliveries (commerce)
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** On screen, 2026-10-02, as Doty: "tax exempt" in the search box lists Wholesale › Accounts first. O'Malley Ranch & Hay Co.: Add certificate, Agricultural, Utah, UT-AG-58821, starting today, no end: "Certificate UT-AG-58821 added", row "Agricultural · Utah", "From Oct 2, 2026 · No end date", In force. Seamus O'Malley's Details tab: "O'Malley Ranch & Hay Co., the wholesale account they buy for, holds a certificate that covers them (Utah), so you do not need to add one here as well." Høgberg Diesel & Performance: Resale, Idaho, ID-ST101-447902, Ends typed from empty as 12/31/2027 (every keystroke took): "Resale · Idaho", "Until Dec 31, 2027", In force. The remove dialog opened and was kept. Its words said Høgberg "will be charged sales tax again", which is false for a business that collects no tax (Gillett's one tax zone is off); reworded to "Orders from … delivered to Idaho stop being exempt: they pay sales tax wherever you collect it." Checkout with a certificate: not driven (no tax is collected here yet; act 9).
**Blocked on:** —

## What happened

Two of Doty's trade accounts hand him tax exemption certificates: O'Malley Ranch & Hay Co. (agricultural, Utah) and Høgberg Diesel & Performance (resale, Idaho). He went to put them on file.

1. Sell › Tax says: "Customers who don't pay tax (resellers, charities, wholesale accounts) are handled on their own customer record, not here, so their certificate stays with them."
2. The wholesale account page for O'Malley Ranch & Hay Co. has Who they are, How they buy, Who can order, their fleet and their trade activity. Nothing about tax or a certificate.
3. A customer page (Details tab) has Addresses and Who they are connected to. Nothing about tax or a certificate either.
4. Searching the launcher for "tax exempt", "tax exemption", "resale certificate" or "exemption certificate" did not lead to either page.

So the sentence on the Tax page was false: there was no screen anywhere that could add, see or remove a certificate.

Underneath, two more things were wrong:

- There was no way to READ certificates at all. The platform could create one (an API call and an AI-client tool) and delete one, but nothing listed them, so even a certificate added another way was invisible.
- Checkout only looked for certificates filed on the PERSON buying. A trade business keeps its certificate on the business, so a certificate filed on O'Malley Ranch & Hay Co. would have been ignored every time someone at the ranch checked out, and they would have been charged sales tax the shop had paperwork to stop. Repeat deliveries had the same blind spot.

## What should have happened

The Tax page's own sentence: a buyer who does not pay tax is handled on their own record. Doty opens O'Malley Ranch & Hay Co., adds "Agricultural, Utah, certificate number …, starts today, no end date", and from then on anyone ordering for the ranch at checkout is not charged Utah sales tax.

## How to reproduce

1. Signed in as the Gillett Diesel owner, open Wholesale › Accounts › O'Malley Ranch & Hay Co.
2. Look for anywhere to record a tax exemption certificate. There is none (every time).
3. Open Sell › Tax and read the line at the bottom of the page.

## Why it matters

Wrong money and a false sentence. A reseller or a farm that hands over a valid certificate expects not to be charged sales tax; with no way to file it, the shop either charges tax it should not (the customer is overcharged and calls) or stops selling online to them. And the Tax page told the owner where to go, and nothing was there.

## Where it lives

- `wizeworks/services/api-rest/src/routes/v1/commerce/shipping.ts`: only POST and DELETE existed for `/v1/commerce/tax/exemptions`.
- `wizeworks/packages/commerce/src/services/tax-service.ts`: `listExemptionsForCustomer` / `listExemptionsForCompany` had no callers.
- `wizeworks/packages/commerce/src/services/checkout-service.ts` `quoteTaxForSession`, and `renewal-pricing.ts` `priceRenewal`: read certificates `where: { customerId }` only.
- `sparx/apps/workbench/surfaces/commerce/tax.tsx` (and Piggles): header comment and the on-screen line promising a place that did not exist.

## The fix

**Checkout honors the account's certificate.** New `wizeworks/packages/commerce/src/services/tax-exemption-holders.ts`: `buyingAccountId` and `exemptionIdsForBuyer`. The account is resolved by the same rule wholesale prices and terms already use (`resolveActiveB2bAccountId`: the customer's own account, and only while they are an active contact on it), so someone taken off the account stops getting its certificate along with its prices. Checkout (`quoteTaxForSession`, line ~1819) and repeat deliveries (`priceRenewal`, line ~169) both read through it.

**An API to read them.** `GET /v1/commerce/tax/exemptions?customer_id=` or `?company_id=` (exactly one; both or neither is a 400). Viewer role and the Sell module, like every other tax read. For a customer, the answer also carries the wholesale account they buy for and that account's certificates (`taxService.exemptionsForCustomer`), from the same resolver checkout uses, so the screen and the till cannot disagree. Creating a certificate whose end is before its start is now refused with a plain sentence.

**A "Tax exemption" section** (`surfaces/commerce/tax-exemptions-section.tsx`, words in `tax-exemption-words.ts`, data in `tax-exemptions-data.ts`, one of each per console) on the wholesale account page (after Who can order) and on the customer page's Details tab (after Addresses). Shown only while selling is on, since a certificate does its work at checkout. On a new, unsaved account it says to save first. Each certificate reads as kind and place ("Agricultural · Utah"), its number, and "From … · No end date" / "Until …", with a state badge: In force (green), Starts {date} (blue), Expired {date} (amber). Adding one: kind, where it covers (the whole country or one state, by name), number, starts (today by default), ends (optional). The add form registers as unsaved work. Removing one asks first, names the certificate number, and says what changes at checkout; it does not claim tax comes back when another certificate still covers that place, or when the one being removed was not covering anything. On a customer whose account holds a certificate, one line says so ("O'Malley Ranch & Hay Co., the wholesale account they buy for, holds a certificate that covers them (Utah), so you do not need to add one here as well.") with a button to open the account.

The section says what a certificate does and no more: it stops sales tax at checkout on the website (and on repeat deliveries). Quotes and invoices written by hand carry the tax rate typed on them, and the section says that too, rather than promising they drop tax.

**Sell › Tax:** the stale header comment now says where certificates live; the on-screen line became a "Customers who don't pay tax" section that says where to add a certificate, with buttons to Wholesale accounts (when that app is on) and Customers.

**Launcher:** "tax exempt", "tax exemption", "resale certificate" and "exemption certificate" now put Wholesale › Accounts first, in both consoles.

**Sibling screens checked:** the Piggles console had the same gap and the same false line on its Tax page; fixed the same way there ("wholesale customer" in its words). The AI-client tools can create a certificate but still cannot list one; not changed here.

**Tests**

- `checkout-tax-exemption.test.ts` (5): reverting checkout's read to the customer only reddens 2; dropping the "still an active contact" rule reddens 1 (with the renewal one below, 2 across both files).
- `renewal-tax-exemption.test.ts` (2): reverting the renewal read to the customer only reddens 1; dropping the active-contact rule reddens 1.
- `renewal-pricing.test.ts`: its fake database gained the two reads the shared resolver makes; its 9 tests still pass.
- `tax-exemption-words.test.ts` (13 per console): treating a second certificate as not covering reddens 1; counting an expired account certificate as covering reddens 1; dropping the "also holds" wording reddens 1.
- `launcher-owner-phrases.test.ts`: the 4 new phrases were red in each console before the keywords were added (4 failed / 35 sparx, 4 failed / 33 Piggles).

## Confirmed by

Not yet confirmed on screen.

## Rating effect

—
