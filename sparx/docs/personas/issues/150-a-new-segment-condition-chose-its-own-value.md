# 150 — A new segment condition chose its own value

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 10 (one email to the fleets)
**Surface:** workbench › Customers › Segments › a segment's conditions (sparx and Piggles)
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08
**Blocked on:** —

## What happened

A brand-new segment opened with one condition already filled in: "Customer · Relationship is Individual". Before Doty chose anything, the bar read "31 of 38 match" and "Create segment" was ready to press.

He set the group to "any of" and pressed "Add a condition" to add his second tier. The new condition again came in as "Relationship is Individual", and the count jumped from 5 to 35. Under "any of", one condition nobody chose put 30 more people in the audience. Saved in that state, the email would have gone to 35 people instead of 6.

Changing a condition's field to a yes/no field ("Do not send marketing", "Subscribed to marketing") filled in "yes" the same way.

## What should have happened

A new condition waits for its value. The bar says "Finish the rules to preview", and the segment cannot be saved until the owner picks one.

## Why it matters

The value of a segment rule decides who gets an email. A value the screen picked is a choice nobody made, and under "any of" it widens the audience without a word.

## Where it lives

`newPredicate` in `sparx/apps/workbench/surfaces/crm/segment-rules.ts` (Piggles: the same file) fills in the first option of a choice field, and `'true'` for a yes/no field. Next to it, `serializePredicate` accepts an EMPTY yes/no value and saves it as "no" (`kind !== 'boolean'`), so a blank yes/no value cannot simply be left empty either.

## The fix

- `newPredicate` (sparx and Piggles) starts every condition with no value, for every kind of field. The bar says "Finish the rules to preview" and "Create segment" stays off until a value is picked.
- `serializePredicate` treats an empty value as unfilled for every kind, a yes/no field included. Before, an empty yes/no value was saved as "no".

Tests, proved red: `surfaces/crm/segment-new-condition.test.ts` in sparx and in Piggles. A new condition has no value for a choice field and a yes/no field; a new segment cannot be serialized; an empty yes/no value is unfilled, and "false" still saves as no. Against the committed code, all 3 fail in each app.

## Confirmed by

P01 on screen, 2026-10-08. Customers › Segments › New segment, as Doty: the first condition reads "Customer · Relationship is" with an empty value, the bar reads "Finish the rules to preview", and "Create segment" is off. Before the fix the same screen read "31 of 38 match" with "Create segment" ready.

## Rating effect

—
