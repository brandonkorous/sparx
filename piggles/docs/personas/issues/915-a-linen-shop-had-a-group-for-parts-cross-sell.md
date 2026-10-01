# 915: A linen shop had a group for "parts cross-sell"

**Status:** fixed
**Severity:** copy: true of nobody but one kind of business, in every account
**Found by:** P03 · Juniper Row · act 322
**Surface:** `crm.segments.list` (Groups of customers), both consoles;
`wizeworks/packages/crm-schemas/src/builtins/segments.ts`
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** walked on screen as Devi

## What happened

Every business gets four built-in groups. One of them was **B2B Fleet**,
described as "B2B accounts with a fleet: primary target for parts
cross-sell." Juniper Row sells linen. "B2B" is a word this console does not
use, and "parts cross-sell" is one industry's sales talk, in an account that
has nothing to do with it. Seen in her list and, since 914, under the group in
search.

## The fix

The rule stays: active wholesale customers with a Fleet size of at least 1.
The words now say exactly that, and what happens for a business without
vehicles:

- **Name:** Wholesale customers with vehicles
- **Description:** Active wholesale customers with a fleet size of at least 1.
  If you do not sell to businesses that run vehicles, this group stays empty.

Everything finds this group by its slug, `b2b-fleet`, which is unchanged.
Nothing reads the name, so the rename cannot install a second copy.

Migration `20270527000000_the_fleet_group_fits_any_business` refreshes accounts
that already have it. Name and description are matched separately and exactly,
so a business that renamed the group or rewrote its description keeps its own
words. Local: 29 renamed, 0 old descriptions left. `docs/11-crm-prd.md` lists
the new name.

## Confirmed by

> Opened Groups of customers as Devi: the row reads "Wholesale customers with
> vehicles", Already here. Searched "vehicles": Groups of customers ›
> Wholesale customers with vehicles, with its new description beside it.

## After this ships

Same as 914: run **ops.yml → reindex-search** once, so search shows the new
words.
