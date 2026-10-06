# 074 — "Dealer prices" found nothing

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 5 (setting up what dealers and fleets pay)
**Surface:** workbench › the search box (both consoles)
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** On screen, 2026-10-02, as Doty: "dealer prices" lists Price tiers first; Enter opened it, where the Dealer, Fleet and Contract tiers were then added.
**Blocked on:** —

## What happened

Doty typed "dealer prices" to set what his dealers pay. The search box said "Nothing matches that." The screen is called "Price tiers", and its search words were "trade price", "levels", "discount tier" and "volume". "wholesale" found it in a list of fifteen.

## Fix

- `lib/surfaces/catalog/b2b.ts` (both consoles): Price tiers also answers to dealer price, fleet price, fleet pricing, wholesale price and trade discount.
- `components/launcher-owner-phrases.test.ts` (both consoles): "dealer prices", "fleet pricing", "wholesale prices" and "trade discount" must put Price tiers first. Without the new words 3 of the 4 fail.
- Same act, same shape: "contract price" found only an account whose private note said it. `lib/surfaces/catalog/commerce-product-panels.ts` (both consoles): Product trade pricing answers to contract price, agreed price, special price for one customer, customer price. 3 phrase rows; all 3 red without the words.
- The tier picker on a trade account listed bare names ("Contract", "Dealer", "Fleet"), so choosing one meant remembering what each gave. It now reads "Fleet · 12% off" (both consoles, `account-detail.tsx`, `accounts-data.ts`). Seen on screen in Add a trade account, 2026-10-02.
