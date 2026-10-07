# 104 — An import dropped "Tax Exempt" without a word

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 7 (moving in his Shopify customers)
**Surface:** workbench › Move in › any file (both consoles); the shared migration package
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Doty dropped his Shopify customer export (30 customers) into Move in. The report said: "3 columns in this file have no home here and will be left behind: accepts_sms, total_orders, total_spent". Those are sparx's own field keys, not the columns in his file. And Shopify's "Tax Exempt" column, which three of his customers had set to "yes" (Villaseñor Ranch, Thornquist Farms, O'Malley), was not in the list at all: nothing read it, so nothing reported it.

## What should have happened

The report names what will be left behind in words he knows: his file's own column names, and plain words for what sparx does not keep. A tax exemption does not vanish silently.

## How to reproduce

Move in › Shopify › drop a customer export with a "Tax Exempt" column. Before the fix: the list above, every time, and the three exempt customers came over with no sign of it.

## Why it matters

A farm that is exempt gets charged tax at the counter, and nobody knows why. "accepts_sms" means nothing to an owner.

## Where it lives

- `validateRows` (`migration/src/validate.ts`) listed canonical keys no field spec claims. A source column no mapping read never became a key, so it never appeared.
- Both consoles printed the keys as they were.
- sparx keeps an exemption as a certificate (type, state, number). Shopify's file has only "yes", so it cannot become one.

## The fix

- The shared mappers record which of the file's columns they read (`trackingReads`, `markRead` in `vendors/_helpers.ts`; the six adapters that carry leftover columns record each one). `readSource` reports the rest as `unreadColumns`, in the file's own words.
- `leftBehind(report)` (shared) gives the list a person reads: the file's column names, and plain words for fields sparx does not keep ("SMS opt-in", "Total spent", "Number of orders"). Both consoles print it: "Left behind, with nowhere here to keep them: …".
- Shopify's "Tax Exempt: yes" rides on the customer's note: "Tax exempt in Shopify. Add their exemption certificate under Tax exemption to stop charging them tax."

Run on Doty's three real files: customers leave behind "SMS opt-in, Number of orders, Total spent, Customer ID"; products "Taxable, Published, Variant Inventory Policy, Variant Fulfillment Service" (now visible: none of these were ever imported).

Test: `migration/src/left-behind.test.ts`. The old mapping code reddens 3 of 3.

## Confirmed by

On screen, 2026-10-06, as Doty: "Left behind, with nowhere here to keep them: SMS opt-in, Number of orders, Total spent, Customer ID." Imported: 30 of 30; the three exempt customers each carry the note.

## Rating effect

—
