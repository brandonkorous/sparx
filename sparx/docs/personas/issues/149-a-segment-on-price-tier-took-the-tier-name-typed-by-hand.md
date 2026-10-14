# 149 — A segment on price tier took the tier's name, typed by hand

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 10 (one email to the fleets)
**Surface:** workbench › Customers › Segments › a segment's conditions; the Segments list
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P01 on screen, 2026-10-08
**Blocked on:** —

## What happened

To write to his fleets, Doty built a segment on "Wholesale account · Price tier". The value is a plain text box, with the hint "The name of the tier, as it reads under Price tiers." He typed `Fleet` and got 5 matches.

- The match is exact and case-sensitive (`looseEqual` in `evaluate-segment-rule.ts`). `fleet` or `Fleet ` matches nobody, and the screen gives no sign that anything is wrong. The count reads like a real answer.
- The rule stores the tier's name. If the tier is renamed under Price tiers ("Fleet" to "Fleet accounts"), the rule keeps the old name, and the audience empties when its members are next checked. Nothing tells the owner.
- The screen already has the list of tiers. The "Linked wholesale account" rule beside it is a dropdown of real accounts.

The Segments list has the same gap for that account rule: its one-line summary prints the account's raw id ("Linked wholesale account is 1c0e…"), because the summary has no names to look up.

## What should have happened

Price tier is a dropdown of the business's tiers. The rule keeps working when a tier is renamed. The Segments list names the account and the tier.

## Why it matters

A segment is who gets an email. A typo, or a rename months later, quietly sends the email to nobody, or stops a tier's automation from firing.

## Where it lives

- `wizeworks/packages/crm-schemas/src/segment-rule.ts`: the field list, and the projection schema (`pricingTier: string`).
- `wizeworks/packages/crm/src/consumers/segment-projection.ts`: projects the tier's name only.
- `sparx/apps/workbench/surfaces/crm/segment-rules.ts`: `b2bAccount.pricingTier` is `kind: 'text'`.
- `sparx/apps/workbench/surfaces/crm/segment-summary.ts`: `labelFor` reads only fixed `options`, so a picker value prints as its id.
- Piggles: `surfaces/crm/segment-field-meta.ts`, `segment-fields.ts`, `segment-summary.ts`.

## The fix

- New rule field `b2bAccount.pricingTierId` (`crm-schemas/src/segment-rule.ts`). The projection the server builds (`crm/src/consumers/segment-projection.ts`) carries the id of the tier in effect beside its name, and none for a removed tier.
- The segment builder offers "Price tier" as a dropdown of the business's tiers, stored by id (new value kind `tier`). Piggles calls it "Wholesale group". The old name field is no longer offered. It is kept, labeled "Price tier name (typed)", so a rule saved on it still shows and still matches. No saved segment uses it in the local database.
- The Segments list names what a rule picked: a tier, a wholesale account or a team member (`segment-summary.ts`, with the names from `segment-picked-names.ts`). Before a list has loaded in full, it says "a chosen tier", and for an id no longer in the list, "a removed tier". It never prints the id. Same in Piggles, in its own words.

Tests, proved red:

- `crm-schemas/src/segment-tier-by-id.test.ts`: the server accepts the rule, it matches whatever the tier is called now, and the projection carries the id. Against the committed schema, 2 fail.
- `crm/test/unit/company-price-tier.test.ts`: the projection carries the tier's id, and none for a removed tier. Against the committed projection, 3 fail.
- `surfaces/crm/segment-tier-field.test.ts` and new cases in `segment-summary.test.ts`, in sparx and in Piggles: the field is a picked tier, the typed name is not offered but still shows, and the summary names the tier, the account and the team member and never prints an id. Against the committed code, 4 fail in each app.

## Confirmed by

P01 on screen, 2026-10-08, as Doty. In a new segment, "Wholesale account · Price tier" opens a list: Contract, Dealer, Fleet. Fleet matched 5 of 38; "any of" Fleet or Contract matched 6. "Fleet customers" was created with Renée Castañeda, Teodora Vukić-Hale and Marcus Oyelaran-Pike (Wasatch Front), Seamus O'Malley, Dana Whitcomb-Nguyen and Marisa Delacroix-Ward, which is every fleet. The Segments list reads "Price tier is Fleet or Price tier is Contract".

Not checked on screen: renaming a tier with a segment on it. The test covers it.

## Rating effect

—
