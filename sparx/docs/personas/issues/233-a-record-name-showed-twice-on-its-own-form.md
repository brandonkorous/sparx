# 233 — A record's name showed twice on its own form

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · pane ratings (Wasatch Front's account; the "Seals & O-rings" markup rule)
**Surface:** a trade account (Wholesale › Accounts) and a markup rule, sparx console
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** P01, 2026-10-13, Wasatch Front's account and the markup rule in Doty's workbench
**Blocked on:** —

## What happened

Wasatch Front's account opened with a large heading, "Wasatch Front Utility Contractors,
LLC", and right under it the "Company name" box holding the same words. The markup rule
did the same: "Seals & O-rings: cost plus 250%" as a heading over a "Name" box with the
same text.

The house rule (CLAUDE.md, "Detail surfaces show identity once"): a record's name is its
editable field, never also a read-only heading on top. Change the name in the box and
the heading above still shows the old one until Save, so the screen disagrees with
itself while Doty types.

## What should have happened

The name appears once, in its box. The short summary under the heading (the account's
tier and terms; what the rule does to a price) stays.

## How to reproduce

1. Wholesale › Accounts › Wasatch Front Utility Contractors, LLC.
2. Selling › Markup rules › Seals & O-rings: cost plus 250%.

## Why it matters

The same words twice push the form down a screen on a phone, and while the name is
being edited the two copies disagree.

## Where it lives

- `sparx/apps/workbench/surfaces/b2b/account-detail.tsx`: a `Heading` with
  `account.companyName` above "Who they are".
- `sparx/apps/workbench/surfaces/commerce/markup-rule-detail.tsx`: a `Heading` with
  `rule.name` above "The rule".

## The fix

- `b2b/account-detail.tsx`: an existing account opens on its summary line ("Fleet · 30
  days to pay") with no name heading; a new one keeps "Add a trade account".
- `commerce/markup-rule-detail.tsx`: an existing rule opens on what it does ("Adds 250%
  to the cost."); only a new one has the "Add a markup rule" title. The tab title still
  names the rule.
- Piggles has neither heading.

Test, red first: `surfaces/identity-once.test.ts` (2; both red before, the markup one red
again on the old file after narrowing it to the heading). Lint clean. Typecheck not run.

## Confirmed by

P01, 2026-10-13: Wasatch Front's account opens "Fleet · 30 days to pay" over "Company
name: Wasatch Front Utility Contractors, LLC"; the rule opens "Adds 250% to the cost."
over "Name: Seals & O-rings: cost plus 250%". Each name once.

## Rating effect

—
