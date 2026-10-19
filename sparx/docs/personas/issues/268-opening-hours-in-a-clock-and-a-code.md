# 268 — Response times summed up her hours as "09:00–17:00 (America/Denver)"

**Status:** fixed (sparx); Piggles screen listed as debt
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · rating Customers › Response times
**Surface:** Customers › Response times › "Right now", sparx console and Piggles
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

The "Right now" box read:

> Mon 09:00–17:00, Tue 09:00–17:00, Wed 09:00–17:00, Thu 09:00–17:00, Fri
> 09:00–17:00 (America/Denver)

The form under it shows "09:00 AM" and "05:00 PM". Doty runs a shop in Utah. She says
"nine to five, Monday to Friday, Mountain time". The function's own comment promised
"business hours in the words a person would use".

## What should have happened

"Mon–Fri, 9:00am–5:00pm, Mountain time".

## How to reproduce

1. Sign in as Doty. Open Customers › Response times.

Every time.

## Why it matters

A 24-hour clock and a zone code where the owner's own words belong, on the box that
exists to say her hours back to her.

## Where it lives

`describeHours` in `surfaces/crm/tickets-data.ts`, both consoles (the same code).

## The fix

- `surfaces/crm/business-hours-words.ts` (new, both consoles): runs days with the same
  hours together, says times with `clockLabel` ("9:00am", "noon"), and names the zone
  with `zoneWords` ("Mountain time"). Both helpers already existed.
- sparx: `sla-policies.tsx` uses it; the old function is removed from `tickets-data.ts`.
- Piggles: `tickets-data.ts` (449 lines) and `sla-policies.tsx` (656 lines) are over its
  250-line rule. The new helper and its test are in place; wiring the screen waits on
  splitting those files. This is the same policy as 263.

Tests: `surfaces/crm/business-hours-words.test.ts` in both consoles (4 each). The old
function failed all 4; the new one passes. sparx crm 106/106, Piggles crm 111/111.

## Confirmed by

sparx as Doty, light and at 360px: "Right now: Mon–Fri, 9:00am–5:00pm, Mountain time".

## Rating effect

crm.sla-policies: her hours, in her words.
