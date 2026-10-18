# 335 — A forgotten basket held the last one for good

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 9, a stranger after two sales
**Surface:** Gillett site › a product page off the cluster (local and any environment without the CronJobs); `wizeworks/services/api-rest`
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** sparx as a stranger (Gillett Diesel Service), 2026-10-18
**Blocked on:** —

## What happened

After two injectors sold, Gillett's DDP 6.7L injector page said "Sold out. This one has gone for now." One was on the shelf. A basket left in a closed tab held it: a cart holds what is in it for 30 minutes, and the hold's time had run out, but nothing let it go. Issues 316 and 318 had met the same thing and released holds by hand.

In the cluster a CronJob (`k8s/cronjobs/commerce-reservation-reaper.yaml`) calls `/internal/commerce/reservation-reaper` every minute. Off the cluster nothing called it.

## What should have happened

A hold ends when its time does, wherever the platform runs.

## How to reproduce

1. Off the cluster, put the last one of something in a basket and close the tab.
2. Wait past 30 minutes and open the product as someone else.

## Why it matters

Every local check of stock, carts and checkout drifts further from the truth the longer the API runs, and a tester reads "Sold out" as a stock defect that is not there.

## Where it lives

`wizeworks/services/api-rest/src/lib/reservation-reaper-loop.ts` (new: `runReservationReaperTick`, `startReservationReaperLoop`), `src/index.ts`; `wizeworks/packages/db/src/advisory-locks.ts` (`RESERVATION_REAPER`).

## The fix

Off the cluster, the API does what the CronJob does, on the same minute and the same call (`commerceSchedulers.reapExpiredReservations` for every business that sells), one copy at a time across processes behind its own advisory lock, like every other background tick in the API. In production the CronJob stays the one runner, so nothing there changes. One business that fails is logged and stepped past.

Tests: `src/lib/reservation-reaper-loop.test.ts` (2: every selling business's holds released past one that fails; nothing runs in production).

## Confirmed by

2026-10-18. About a minute after the API reloaded with the loop, the injector's expired hold read `expired` with a release time, and the product page showed the core choice, Quantity and "Add to cart" again.

## Rating effect

None.
