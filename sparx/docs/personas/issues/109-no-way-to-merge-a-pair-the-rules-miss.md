# 109 — No way to merge two records of one person that the rules did not pair

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 7 (cleaning up after the Shopify import)
**Surface:** workbench › CRM › customer › Details (both consoles); CRM › Duplicates
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Brynn O'Hara-Løvdal was in sparx twice. The Shopify import brought her old record (Lehi, brynn.ohara@zionsmail.test, +18015550142). She had since moved to Kanab and ordered seven times on the new site with a new email and phone. No duplicate rule pairs a new email with a new phone, so Duplicates never showed her, and her customer page had no merge at all. The merge existed on the server; no screen offered it for a pair the rules missed.

On the way, three more:

- Duplicates' "not compared" sentence named only phone. With email or surname-and-employer turned off, it still read as the full check ([108]'s neighbor).
- "Keep this one" on Duplicates was `color="neutral"`, never approved (RULE #4).
- The first confirm read "Merge Brynn O'Hara-Løvdal into Brynn O'Hara-Løvdal?", which says nothing about which one goes.

## What should have happened

An owner who knows two records are one person can merge them from either record, sees which details survive, and is told which one is retired.

## Why it matters

Her history was split: seven orders on one record, her address and Shopify notes on the other. Every search, report and email treated her as two people.

## Where it lives

`/v1/crm/customers/merge` takes any two records on one site. Only `duplicates.tsx` called it, and only for groups the scan returned.

## The fix

Both consoles:

- New `surfaces/crm/customer-merge.tsx`: "Merge with another customer" above Remove on the Details tab (owner and admin only, as on the server). Search by name, email or phone (same site only, never this record). Pick which one to keep. It says which email and phone are not kept. Confirm, merge, and if this page's record was retired, open the one that is left.
- `duplicates-data.ts`: `mergeDropsWords` (phones compared by digits) and `mergeConfirmWords` (when both names match, each side is named by its email).
- `workspace-data.ts`: `duplicatesCheckedWords` names every rule that is off.
- `duplicates.tsx`: "Keep this one" is colorless; "Keeping" stays `success`.

Tests, each proved red:

- `surfaces/crm/merge-drops-words.test.ts`, both consoles: returning nothing reddens 1 of 4; dropping the same-name branch reddens 1 of 4.
- `surfaces/crm/duplicates-checked.test.ts`, both consoles: naming only phone reddens 1 of 3.

## Confirmed by

On screen, 2026-10-06, as Doty: Brynn (Kanab) › Details › Merge with another customer › "Brynn" listed only the Lehi record ("no orders"). "Keep this one" swapped both sides and both sentences. The confirm read "Merge the two records for Brynn O'Hara-Løvdal?", naming each by email. After Merge them: one Brynn, tags vip, retail and cummins, the Lehi address on file, the Kanab email and phone kept. Database: 36 live customers, 1 Brynn, the retired record's `merged_into_customer_id` points to her.

## Rating effect

—
