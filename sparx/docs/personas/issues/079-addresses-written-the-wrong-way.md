# 079 — Addresses written "Salt Lake City, UT, 84119", and United States picked by hand every time

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 5 (billing addresses for five trade accounts)
**Surface:** workbench › a customer's addresses; order addresses; repeat orders; scheduling places (both consoles)
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** On screen, 2026-10-02, as Doty: Lars Høgberg's card reads "Post Falls, ID 83854" under a plain "Delivery & billing" badge; "Add address" opened with Country already "United States".
**Blocked on:** —

## What happened

1. Each saved address read "Salt Lake City, UT, 84119" and "Post Falls, ID, 83854". Nobody writes a comma before a ZIP; on a business's own billing card it looks mistyped. Six copies of the same join did it: the customer card, order addresses, the repeat-order and scheduling one-line addresses, in both consoles.
2. Every new address opened with no country, and the save refused it until one was chosen. Five accounts in Utah and Idaho each needed "United States" found among 250 countries, though Business details already says US. Stock locations got this fix in [043]; customer addresses did not.
3. The address kind badge ("Delivery & billing") was gray `neutral`, which is not ours to choose without Brandon.

## Fix

- `lib/address-format.ts` (new, both consoles): `localityLine` ("Salt Lake City, UT 84119"; "Bristol, BS1 4TR" with no region) and `oneLineAddress`. The six copies use it. Tests: 4 per console; joining with commas again reddens 2. A repeat-order test pinned the old comma ("Bristol, Avon, BS1 4TR"); its point was keeping the second line, so its expected text follows the new rule.
- `surfaces/crm/customer-addresses.tsx` (both consoles): a new address starts in the country from Business details, shown before saving and never refilled once the owner touches the country. The kind badge is plain.
- Found while confirming [075] during a server restart: "Could not load addresses just now." had no way back but reopening the page, while the tax section beside it offered "Try again". The address section now says "Nothing has been lost." and offers "Try again" (both consoles).
- Adding a buyer from a trade account ("Add Renée as a customer") filled the Wholesale account but left the Company box empty above it. `customer-detail.tsx` (both consoles) now starts Company with the account's name. Seen on screen: a new customer opened from Wasatch Front reads "Wasatch Front Utility Contractors, LLC" in Company.
