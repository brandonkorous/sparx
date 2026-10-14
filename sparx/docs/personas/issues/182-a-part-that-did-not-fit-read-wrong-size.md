# 182 — A part that did not fit read "Wrong size" to the owner

**Status:** fixed
**Severity:** copy
**Found by:** P01 · Gillett Diesel Service · act 13 (a retail return)
**Surface:** Workbench › Commerce › Returns (list, detail, approve dialog)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

Brynn sent back an injector and picked "It does not fit". Doty's return read "Wrong
size". An injector has no size; it fits a 2007 Ram 6.7L or it does not. The two sides
named one reason two ways.

## What should have happened

The owner's word matches the customer's: "Does not fit". True for a boot and for an
injector.

## Where it lives

`sparx/apps/workbench/surfaces/commerce/returns-data.ts` `REASON_LABELS.wrong_size`,
and Piggles' `returns-words.ts`. The site says "It does not fit"
(`wizeworks/apps/site/lib/customer-client.ts`).

## The fix

`REASON_LABELS.wrong_size` is "Does not fit" in sparx `returns-data.ts` and Piggles
`returns-words.ts`. Nothing reads the label back as an identity (checked by grep). Test:
the same `return-goods-words.test.ts`, red first in both.

## Confirmed by

P01 on screen, 2026-10-09 (Commerce › Returns › O-000004): "Does not fit · 1 asked back".
Piggles not opened; its test passes.

## Rating effect

—
