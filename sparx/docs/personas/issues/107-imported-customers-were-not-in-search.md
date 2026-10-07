# 107 — Imported customers were not in search

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 7 (looking for the duplicates screen after the import)
**Surface:** workbench › Search everything, after any Move in import (both consoles; the import worker)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

After importing 30 Shopify customers, Doty searched. The box said "Nothing the box can see matches … 30 customers are not in this box yet, so it cannot look at them" and offered "Put them back". "Villaseñor" found nothing.

## What should have happened

What an import brings in can be found the moment the import says it is done.

## Why it matters

The box measured the gap honestly and offered the repair, but the owner had to notice it, read it and press it, after every import, and every search before then said his customers did not exist.

## Where it lives

`customerService.create` and `update` announce on an in-process bus that only api-rest listens to. The import worker is a different process, so the search indexer never heard. `reconcile-segments.ts` already explains and works around the same thing for groups.

## The fix

`reindex-after-import.ts` in the import worker: after a real import that wrote something, it asks for the same rebuild "Put them back" asks for (`search.reindex.requested`), once per job, for the collections those rows live in plus the universal one behind Search everything (customers → customers and entities; products → products and entities; orders → orders, customers and entities; anything else → entities). Never fails the import; the button is still there behind it.

Found on the same screen and fixed with [106]: the after-run sentence "their details now match this file" said addresses were replaced; it now says names, phones and tags match and existing addresses were kept, both consoles.

Tests, each proved red:

- `import-worker/src/reindex-after-import.test.ts`: skipping the request reddens 1 of 3.
- `surfaces/migration/run-outcome.test.ts`, both consoles: the old Piggles wording reddens 1 of 3.

## Confirmed by

On screen, 2026-10-06, as Doty: before the import "Villaseñor" found nothing; after it, with nothing pressed, "Teodoro Villaseñor · teo.villasenor@elkomail.test", and "Achterberg" lists both Desmonds, "2 records matched", no missing-records line.

## Rating effect

—
