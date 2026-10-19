# 194 — The Orders page stopped at ten orders

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 13 (the other side)
**Surface:** the Gillett site › Your account › Orders (and six other account lists)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09 (with a limit: see below)
**Blocked on:** —

## What happened

Renée's Orders page listed her 8 orders. The page asks for the first 10 and has no
Previous or Next, so a buyer's 11th order could never be reached from it. A fleet buyer
reaches 11 orders in a few weeks. No Gillett buyer has more than 8 yet, so this was found
reading the page, not by losing an order on screen.

The six other account lists that do page (estimates, bookings, requests, and the
wholesale account's invoices, orders and quotes) each kept their own copy of the pager,
and the copies had drifted: "1 to 20 of 45", "1–20 of 45" (with inline styles), and
"Page 1 of 3".

## What should have happened

Every list that can grow pages, the same way, with the same words.

## Where it lives

- `wizeworks/apps/site/app/account/(authed)/orders/page.tsx`: `getOrders(tenantSlug)`
  with its default of 10, and no pager.
- The six pagers in `estimates`, `bookings`, `requests`, `b2b/[accountId]/invoices`,
  `orders` and `quotes`.

## The fix

- `components/account/list-pager.tsx` `ListPager` (offset, page size, total, onMove)
  and `lib/pager-words.ts` `pagerWords`: "1 to 20 of 45", nothing when it all fits.
- The Orders page asks for 20 at a time and pages with it.
- The six other lists use it; their own copies are gone. Two that count by page number
  convert at the call.

Tests, red first: `lib/pager-words.test.ts` (the words; that no account page draws its
own Previous and Next; that the Orders page pages, proved red against the old page).
Site 468 pass; lint and format clean.

## Confirmed by

P01 on screen, 2026-10-09: the Orders page (Renée, 8 orders), the wholesale account's
Orders page, and Returns all load and list as before, with no pager since each fits on
one page.

A list longer than 20, on screen 2026-10-19: Renée placed O-000038 and O-000039 on account
(a Stanadyne additive each), her 20th and 21st orders. Her Orders page read "1 to 20 of 21"
under "Previous" and "Next"; Next showed O-000007 alone, "21 to 21 of 21". Wasatch's invoice
list (18 rows) still fits, with no pager.

## Rating effect

—
