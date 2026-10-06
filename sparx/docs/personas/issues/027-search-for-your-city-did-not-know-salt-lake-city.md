# 027 — "Search for your city" did not know Salt Lake City

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › Business details › Time zone (and every time zone picker)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 2 — "Salt Lake City, Mountain Daylight Time (GMT-06:00)" offered and saved `America/Denver`
**Blocked on:** —

## What happened

The time zone box says **Search for your city…**. Doty typed **Salt Lake City**:
"No time zone matches that city." The list is the IANA one, which names one city
per zone (Denver), so Utah's capital, Dallas, Seattle, Boston and most big US
cities found nothing.

## The fix

`lib/timezones.ts` (both consoles, used by Business details, SLA policies and the
Piggles scheduling editors): a short list of big cities that share another city's
zone (US, Canada, UK), each added as its own item that saves the shared zone.
Real entries sort before their aliases within a zone, so a lookup by the stored
zone still finds "Denver". `lib/timezones.test.ts` in both (2 each); removing the
ordering rule reddens 1.

Left as is: after picking "Salt Lake City" the box reads "Denver, Mountain
Daylight Time (GMT-06:00)", the zone's own name. Same zone, correctly saved.

## Confirmed by

> Re-ran P01 act 2: typed "Salt Lake City", one result "Salt Lake City, Mountain
> Daylight Time (GMT-06:00)"; picked it; saved; `tenant_businesses.timezone` =
> `America/Denver`.

Checks: sparx and Piggles workbench tsc 0; eslint 0; prettier clean.

## Rating effect

—
