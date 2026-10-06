# 041 — A deleted policy page stayed on Legal pages until a refresh

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › Content editor › Delete, seen on Legal pages (both consoles)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 2: the deleted Return Policy no longer shows under "Pages" or "Links in your footer"; `GET /v1/legal/placements` returns the five live pages
**Blocked on:** —

## What happened

Doty deleted the starter Return Policy (his Refund Policy covers returns). The
confirm was clear and the row was deleted (`deleted_at` set), but Legal pages kept
listing it as "Needs review" until he pressed refresh. He would think it failed.

Then, after a refresh, "Links in your footer" still listed it, as "Draft": its
footer link outlived the page. And the screen's refresh button reloaded only the
page list, not the footer links or the cookie banner.

## The fix

- `surfaces/cms/data.ts` `useDeleteEntry` refreshes the Legal pages queries, as
  save, publish and unpublish already did. Both consoles.
- `wizeworks/packages/cms/src/entries-service.ts` `deleteEntryTx`: deleting a page
  deletes its footer links.
- `api-rest/src/routes/v1/legal.ts` `GET /v1/legal/placements`: skips links whose
  page is deleted (the public footer and email footer already did), which also
  clears links left by earlier deletes.
- `surfaces/cms/legal-list.tsx` (both): Refresh reloads the page list, the footer
  links and the cookie banner.

Checks: cms tsc 0, 17/17; api-rest tsc 0; prettier clean.

## Rating effect

—
