# 011 — A new owner opened onto another company's tabs

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 1 (isolation)
**Surface:** workbench › shell › saved tab layout
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 — `/api/token` returns `propertyId: null` for Doty; the workspace opened empty, not on the other company's tabs
**Blocked on:** —

## What happened

Doty signed up on a computer another sparx customer (WizeWorks LLC) had used.
During a server blip (issue 012) the workspace opened, and it was full: **141
tabs**, with titles like "Q-000001", "sparx — Editorial", purchase-order numbers
and "Broadcasts". None were his. His site picker read just "Site".

## What should have happened

A new owner sees his own empty workspace. Nothing another company opened, named
or numbered is ever shown to him.

## How to reproduce

1. Sign in as company A, switch to any site, open some records.
2. Sign out. Sign in (or sign up) as company B in the same browser.
3. Company B's workspace restores company A's tabs.

## Why it matters

A parts counter is a shared computer. The tab titles are other businesses' quote
numbers, page names and customer records. Data behind them was safe (api-rest
ignores a site that is not the caller's), but the titles are shown, and every
layout change Doty made would have been saved into the other company's slot.

## Where it lives

- The `sparx_active_property` cookie is a one-year preference; signing out does
  not clear it.
- `app/workbench-entry.tsx` and `app/api/token/route.ts` forwarded it raw. The
  shell (`components/workbench-shell.tsx`) uses it as the key for the saved
  layout in browser storage.
- Same three files in the Piggles console (`piggles_active_property`).

## The fix

- New `lib/active-site-cookie.ts` in both consoles: the value is
  `<tenantId>.<siteId>`; `readActiveSite` returns the site only when the tenant
  matches the signed-in one.
- `app/api/active-site/route.ts` writes it with the session's tenant;
  `workbench-entry.tsx` / `console-entry.tsx` and `app/api/token/route.ts` read
  it through `readActiveSite`.
- `lib/api/shell-data.ts`: the browser-side fallback write is removed (it cannot
  know the tenant, and if our own origin is down the reload after it fails too).
- A bare site id written before this cannot be checked, so it is dropped: an
  operator on a non-primary site lands on the primary once and picks again.
- `active-site-cookie.test.ts` (both consoles): 4 tests. Removing the tenant
  comparison turns 1 red ("drops a site set under another tenant").

## Confirmed by

> Re-ran P01. Before: `/api/token` returned `propertyId:
bac86a9f-…` (WizeWorks LLC's primary site). After: `propertyId: null`, so the
> shell keys on Doty's own primary site. The next fail-open load showed an empty
> workspace, not the 141 tabs.

Checks: sparx and Piggles workbench `tsc --noEmit` exit 0; eslint 0; prettier
clean; cookie tests 4/4 in each console.

## Rating effect

—
