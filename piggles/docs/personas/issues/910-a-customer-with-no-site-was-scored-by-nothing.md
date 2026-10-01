# 910 — A customer with no site was scored by nothing

**Status:** fixed
**Severity:** **major** — 29 of Juniper Row's 41 customers have no site, and
none of them could ever be scored by the rules Devi wrote
**Found by:** P03 · act 321, checking "7 of 41 scores changed" against the 8
customers who have bought
**Surface:** `wizeworks/packages/crm/src/services/scoring-service.ts`
(`activeModel`)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** `test/integration/scoring.test.ts` (new test; restoring the
old lookup reddens exactly it); on screen, Ravi Naidoo went from 0 to 20

## What happened

Ravi Naidoo has two delivered orders. After "Re-score everyone" under "has
bought something: +20", the other seven buyers read 20 and he read 0.

## Why

His customer row has no site. docs/58 D2 says such a customer is shared by
every site, and the customer list shows him on all of them. The console saves
a scoring model against the site it is open on. The model lookup, given no
site, looked for a business-wide model ONLY, found none, and scored him by
nothing.

## The fix

For a record with no site: a business-wide model if there is one, otherwise the
main site's model. A record with a site is unchanged.

## The same lookup, one door over

`lead-clock.ts` picked the response promise for a new enquiry the same way: a
lead with no site got a business-wide promise or none. A promise set on the
main site started no clock. Same rule now. `test/integration/lead-clock.test.ts`
pins three cases; the old lookup fails exactly "held to the main site's
promise when that is the only one".
