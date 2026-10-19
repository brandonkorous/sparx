# 277 — "-1 left is only 0 days of cover … about 1 orders"

**Status:** fixed (sparx and the shared sentence); the Piggles "Left" column listed as debt
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · rating Stock › Planning › At risk (after "Work it out now")
**Surface:** Stock › Planning › At risk, every row's sentence (both consoles and the AI tools) and the Left column
**Filed:** 2026-10-14
**Fixed:** 2026-10-14
**Confirmed by:** sparx as Doty, 2026-10-14
**Blocked on:** —

## What happened

Three of Gillett's four at-risk rows:

> Bosch Remanufactured Fuel Injector: "Selling about one every 4 days. -1 left is only
> 0 days of cover …" and the Left column said "-1".
> S&S CP4 kit: "0 left is only 0 days of cover …"
> S&B fuel tank: "… so about 1 orders would have nothing to come from."

## What should have happened

"Already 1 short", "None left", "about 1 order". The sentence exists to be read by a
buyer without opening anything.

## How to reproduce

1. Sign in as Doty. Stock › Planning › At risk. Press "Work it out now".

Every time an item is oversold, empty, or one order short.

## Why it matters

The one sentence meant to explain the number reads as a machine wrote it.

## Where it lives

`explainRisk` in `wizeworks/packages/inventory/src/services/planning-reports.ts` (the
sentence, used by both consoles and the AI tools); `surfaces/inventory/planning.tsx`
(the Left column).

## The fix

- `explainRisk`: below zero says "Already N short", zero says "None left", and neither
  claims "0 days of cover"; cover under a day says "under a day"; "1 order", not "1
  orders". Exported for its test.
- sparx `planning.tsx`: the Left column says "1 short" for a negative count.
- Piggles' `planning.tsx` (284 lines) is over its 250-line rule; its Left column waits
  on that split. Its sentence is fixed, since it comes from the server.

Test: `src/services/at-risk-sentence.test.ts` (3), red, then green; inventory services
156/156. Package type check and lint clean.

## Confirmed by

sparx as Doty, At risk: "Already 1 short, and nothing is known about the lead time …",
"None left, …", "about 1 order would have nothing to come from"; Left column "1 short".

## Rating effect

inventory.planning: the explaining sentence reads as a person would say it.
