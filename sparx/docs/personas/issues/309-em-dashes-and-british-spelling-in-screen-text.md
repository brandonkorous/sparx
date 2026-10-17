# 309 — Em dashes and British spelling in screen text

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · rating the panes
**Surface:** workbench › several screens; a new repo check; sparx console and Piggles
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty (Gillett Diesel Service), 2026-10-17, in part
**Blocked on:** —

## What happened

Screen text still used em dashes between words (the repeat orders and team empty states, a delivery note placeholder). The shipping groups page said "palletised", and a cost hint said "palletising". The house rule is no em dashes and American spelling. Piggles had a check for em dashes; sparx did not.

## What should have happened

No em dash between words in screen text, enforced by a check. American spelling.

## How to reproduce

1. Search the sparx workbench for an em dash between words.

## Why it matters

Without a check, each one returns.

## Where it lives

`surfaces/commerce/subscriptions-list.tsx`, `commerce/order-address-form.tsx`, `staff/people.tsx`, `commerce/shipping-profile-detail.tsx`, `inventory/costing-data.ts`; `scripts/check-em-dash.mjs` (new).

## The fix

- The copy is reworded with full stops or brackets.
- "palletized" and "palletizing", in both consoles.
- `scripts/check-em-dash.mjs` scans the sparx screen roots (1,145 files). It runs as `pnpm check:em-dash` and in `.githooks/pre-push`.

Test: the check. Putting an em dash back in a sentence turns it red.

ESLint and the workbench `tsc` run out of memory on this machine: not checked.

## Confirmed by

sparx as Doty, 2026-10-17. The check reads "1145 files, no em dash between words in screen text." The shipping group page reads "palletized".

Not checked: the two empty states on screen (Doty has repeat orders and people, so they do not show).

## Rating effect

See the pane's row in `rating.md`.
