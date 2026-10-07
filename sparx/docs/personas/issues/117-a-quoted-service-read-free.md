# 117 — A service priced by quote would read "Free" on the booking page

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 8 (the service menu)
**Surface:** workbench › Scheduling › Services › a service (both consoles); site › /book and /book/[service]; the fleet booking on a trade account
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Gillett's menu has two services priced after the job is looked at: an injector set and a turbocharger rebuild. A service had only a price box, "Leave blank for a free booking." The public booking list printed "Free" for a 0 price, and the service's own page printed no price at all. So the turbo rebuild would have read Free to every customer, and the two pages disagreed about a free service.

## What should have happened

A business can say "we quote after we look". The customer sees that instead of a price, and nothing is charged or deposited when they book.

## Why it matters

"Free" is a promise. A customer who books a Free turbo rebuild and gets a $1,400 quote has been misled by the shop's own website.

## The fix

- Database: `scheduling_services.price_on_quote` (migration `20270530000029_a_service_can_be_quoted_after_a_look`; existing services unchanged).
- `scheduling-schemas`: `priceOnQuote`. `scheduling/src/services.ts`: a quoted service is stored with no price, on create and on update, so no deposit or fee can be worked out from one.
- API: the console, public and fleet service shapes return `priceOnQuote`.
- Site: `servicePriceWords` in `lib/service-record-words.ts` is the one place the price is put into words: "Quoted after we look", the price, or "Free". The booking list and the service page both use it (the page now says Free for a free service too), and so does the fleet booking summary.
- Consoles, both: "We quote the price after looking at the job" under What it costs (Piggles: `service-price.tsx`); the price box locks and reads "Quoted after a look: nothing is charged when they book." The services list and the booking form say "Quoted" (`servicePriceLabel`, `servicePriceSuffix` in `setup-data.ts`).

Tests, each proved red:

- `scheduling/src/service-quoted.test.ts`: storing the typed price reddens 2 of 3.
- `site/lib/service-record-words.test.ts`: without the quoted words reddens 1 of 18.
- `surfaces/scheduling/service-price-label.test.ts`, both consoles: without "Quoted" reddens 1 of 2.

## Confirmed by

On screen, 2026-10-06, as Doty: New service "Turbocharger rebuild and balance", 240 minutes, starts every 60, a Technician and a Service bay, one day's notice, 90 days ahead, "We quote the price after looking at the job" ticked; the price box locked. Saved with `price_cents` 0 and `price_on_quote` true. As a customer on localhost:3004/book: "Turbocharger rebuild and balance · 4 hr · Quoted after we look", beside "Diesel oil change · 1 hr · $149.95".

## Rating effect

—
