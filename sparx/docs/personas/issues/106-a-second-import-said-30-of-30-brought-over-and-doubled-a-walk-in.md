# 106 — A second import said "30 of 30 brought over" and doubled a walk-in

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 7 (standing check: import the retail customer file twice)
**Surface:** workbench › Move in › a customer file (both consoles; the import worker)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Doty imported his 30 Shopify customers a second time. sparx said "Your business is here … 30 of 30 rows brought over", the same as the first time, then 29 notes that each customer "already had an address on file". Nothing said that nobody was new. And Desmond Achterberg, a walk-in with a phone and no email, was now in sparx twice.

## What should have happened

A second import of the same file says nobody in it is new, before and after. A customer with no email is matched by name and phone, as the file check already treats phone as an identity.

## How to reproduce

Import the same customer file twice. Before the fix: the same "brought over" line both times, and one more copy of every customer without an email each time.

## Why it matters

"30 of 30 brought over" reads the same for 30 new people and 30 overwritten ones. Every re-import made a new copy of each phone-only customer.

## Where it lives

- The Piggles console had already fixed the wording (`run-outcome.ts`: "Nobody in this file is new", "29 new · 1 already here"). sparx never got it.
- `processCustomerRows` and `previewCustomerRows` (`import-worker/processors/customers.ts`) matched by email only.
- Piggles' warning said a re-import "replaces their name, phone, tags and address"; the importer keeps an address already on file.

## The fix

- `run-outcome.ts` ported to sparx; its run banner, counts and Past moves list use it, as Piggles does. The address sentence corrected in both: "Addresses they already have are kept."
- `existingByNameAndPhone`: a row with no email matches someone with the same first and last name and the same phone digits ("(801) 555-0193" = "+18015550193"). Name and phone together, because a household or shop shares a phone. The practice run uses the same lookup.

Tests, each proved red:

- `import-worker/src/processors/customer-phone-import.test.ts` (the real import function and the practice run): without the match, 2 of 2.
- `customer-phone-match.test.ts`: the lookup itself (4).

## Confirmed by

On screen, 2026-10-06, as Doty, a third time with the same file: "Nobody in this file is new. All 30 are people you already have. Doing this for real replaces their name, phone and tags … Addresses they already have are kept.", and under the count "none of them new: every one is somebody you already have". Desmond is matched.

The second Desmond and the two Brynn O'Hara-Løvdal records (her counter-sale email differs from Shopify's) are merged in act 7 with the duplicates finder.

## Rating effect

—
