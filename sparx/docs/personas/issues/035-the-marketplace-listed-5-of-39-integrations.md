# 035 — The marketplace listed 5 of 39 integrations, and its refresh command deleted them

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 2 (running the catalog refresh Brandon approved for [023])
**Surface:** marketplace shelf (`marketplace_integrations`), `pnpm --filter @wizeworks/api-rest marketplace:self-register`
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran the command: "integrations published 39"; the table holds ai 2, dropship 5, payments 8, sales_channels 10, shipping 3, social 9, tax 2, with names filled ("sparx Pay", "sparx Shipping")
**Blocked on:** —

## What happened

Two defects, found together.

1. **The documented refresh command deleted the shelf.** Run as written, it
   reported `integrations published 0 / retracted 5` and deleted every
   integration listing. The listings are derived from a registry the API fills
   at boot; the script never filled it, read "none", and retract-by-absence
   removed everything.
2. **The shelf only ever listed dropship.** The filter kept descriptors whose
   publisher is `'sparx'`. The shared packages moved to the `{platform}` brand
   token, so payments, shipping, tax, sales channels, social and AI (34
   integrations) fell off without a sound. The Integrations panel uses the right
   test (`{platform}` or `sparx`); the marketplace did not.

## Where it lives and the fix

- `api-rest/src/scripts/marketplace-self-register.ts`: calls `bootstrapProviders()` first, as boot does.
- `api-rest/src/lib/marketplace/self-register.ts`: throws when the integration list is empty, instead of retracting the whole shelf.
- `api-rest/src/lib/marketplace/first-party-integrations.ts`: `isFirstParty` is `{platform}` or `sparx`; names, blurbs and scopes are filled with the shelf's brand.
- Test `api-rest/test/unit/first-party-integrations.test.ts`: every category listed, no unfilled token. Proved red by restoring the old filter (1 fails) and by removing the fill (1 fails).

Checks: api-rest tsc 0, eslint 0, prettier clean, 2/2 tests.

## Rating effect

—
