# 035 — The marketplace listed 5 of 39 integrations, and its refresh command deleted them

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 2 (running the catalog refresh Brandon approved for [023])
**Surface:** marketplace shelf (`marketplace_integrations`), `pnpm --filter @wizeworks/api-rest marketplace:self-register`
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** sparx as Doty, 2026-10-17 (Your business › Integrations); the command, earlier
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

## Confirmed by

sparx as Doty, 2026-10-17: Integrations lists Card payments (8), Shipping & delivery (3), Places you sell (10), Social accounts (9), Dropship suppliers (6), Sales tax (2) and AI accounts (2), 40 in all, matching the 40 rows in `marketplace_integrations` today, each with its name ("sparx Pay", "by sparx").

## Rating effect

—
