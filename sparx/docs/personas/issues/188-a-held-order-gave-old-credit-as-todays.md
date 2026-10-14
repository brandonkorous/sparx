# 188 — A held order gave the credit left at placement as today's figure

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 13 (a fleet goes over its credit limit)
**Surface:** Workbench › Wholesale › Approvals; the Gillett site › a held order's page
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

O-000022 was held because Wasatch had $1,676.08 of credit left. Doty then recorded
Wasatch's check for the late invoice 4459, so the account had $3,795.68 left. The
Approvals list still said "the account has $1,676.08 of credit left", in the present
tense, for a figure that was true only when the order was placed.

The site's held-order page (written for issue 187 an hour earlier) said the same:
"your account has $1,676.08 of credit left".

## What should have happened

The figure is what held the order, so it is worth showing, as what it was: "When it was
placed, it came to $2,026.38 and the account had $1,676.08 of credit left."

## Where it lives

- `sparx/apps/workbench/surfaces/b2b/approval-hold-notice.ts` `holdReasonWords`, and
  Piggles' copy.
- `wizeworks/apps/site/lib/sign-off-words.ts` `overCreditSentence`.

## The fix

- `sparx/apps/workbench/surfaces/b2b/approval-hold-notice.ts` and Piggles' copy: the
  reason is past tense ("when it was placed, it came to … and the account had …"), and
  adds "It has $3,795.68 now." when today's figure differs.
- `@wizeworks/b2b` approval queue: each item carries `accountCreditLeftCents`
  (`creditLeftNowCents`, the account's limit less what it has used, today).
- The approve dialog, both consoles: warns "will go past their credit limit: they have
  $X left" only when today's figure says so, and says "It was held for their credit limit,
  and they now have $3,795.68 of credit left, enough for this order" when it has freed up.
- The site: "When it was placed, it came to … and your account had …". It first said
  "When you placed it", which Teodora read about an order Renée placed; reworded, test
  red first.

Tests, red first: `approval-hold-notice.test.ts` and the sign-off words tests in each
console, `approval-credit-hold.test.ts` (b2b), `sign-off-words.test.ts` (site). sparx b2b
93, Piggles b2b 103, b2b 110, site 46 in the file; lint clean.

## Confirmed by

P01 on screen, 2026-10-09. Approvals, after the check for 4459: "Over the credit limit:
when it was placed, it came to $2,026.38 and the account had $1,676.08 of credit left. It
has $3,795.68 now." The approve dialog: "It was held for their credit limit, and they now
have $3,795.68 of credit left, enough for this order." On the site, as Teodora: "When you
placed it…" was seen and reworded (re-proved by test; the order was approved before a
second look).

Piggles not opened; its tests pass.

## Rating effect

—
