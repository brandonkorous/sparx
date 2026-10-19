# 312 — The connect page read {platform} in braces

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › Settings › Integrations › an integration not yet connected; api-rest providers routes
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17, in part
**Blocked on:** —

## What happened

Opening "sparx Shipping" from Integrations showed "Connect {platform} Shipping" and "Shipping & delivery · by {platform}". The integrations list fills the brand name into each descriptor. The provider metadata and "available" routes sent the raw text.

## What should have happened

The brand’s own name, on every route that sends a descriptor.

## How to reproduce

1. Open Settings › Integrations.
2. Open "sparx Shipping".

## Why it matters

A placeholder in braces on the page where the owner is asked for keys makes the whole step look unsafe.

## Where it lives

`wizeworks/services/api-rest/src/routes/v1/commerce/providers.ts`; `lib/fill-platform-deep.ts` (new).

## The fix

`fillDeep(value, brand)` fills every string at any depth, so a new field is covered too. `/v1/commerce/providers/available` and `/v1/commerce/providers/metadata/:slug` both use it with `tenantPlatformBrand`.

Test: `fill-platform-deep.test.ts`, 2 passed. Making it skip lists turns it red.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. The page now reads "Connect sparx Shipping" and "Shipping & delivery · by sparx".

Not checked: Piggles on screen (its brand fills the same way).

## Rating effect

See the pane's row in `rating.md`.
