# 913 — Help requests promised a reply time that nobody could set

**Status:** fixed
**Severity:** **major** — two screens promised reply times to a business that
had none, and the screen for setting them had nothing to press
**Found by:** P03 · act 321
**Surface:** `crm.tickets` (Help requests) and `crm.sla-policies` (Response
times), both consoles; `wizeworks/packages/crm/src/services/sla-policy-service.ts`;
`POST /v1/crm/sla-policies/starter` (new)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** walked on screen; `surfaces/crm/tickets-data.test.ts` (4,
red when hours round instead of floor)

## What she read

Help requests, empty: "Every one gets a reply time based on the hours you
work." Filtered empty, whatever the filter: "everything is inside the time you
promised." Juniper Row had no response times at all, so no request would get a
time and nothing could ever be late.

Response times, empty: "One is created for you the first time a help request
comes in." Nothing to press.

## Why

`bootstrapDefaultPolicy` says it "also runs from the `module.activated`
consumer". It had no caller anywhere. The only path to a promise was the first
help request arriving. [[feedback_screen_over_a_function_nobody_calls]]

## The fix

- `POST /v1/crm/sla-policies/starter` sets up the starter promise on request,
  in the business's own time zone (the same reading the first help request
  uses). Response times' empty screen has **Set up my hours**.
- Help requests reads whether a promise exists. With none: "Set the hours you
  reply in, and every one gets a time to answer by", with **Set your hours**.
  The "inside the time you promised" good news shows only on **Late** with a
  promise in place; "Late" without one says nothing can be late yet; any other
  filter says how to widen it.
- The promise boxes take working minutes; each now reads back in words under
  its box ("2400" is "40 working hours").

## On the screen

Set up in America/Denver. Devi set Tuesday to Saturday, Saturday until 6 PM.
Her response times stay, as her own data.
