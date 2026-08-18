# 001 — A florist cannot pick "florist", and gets the generic setup instead

**Status:** open
**Severity:** minor
**Found by:** roster design · while allocating one persona per trade
**Surface:** getpiggles › /onboarding › "What do you do?"
**Filed:** 2026-08-18
**Fixed:** —

## What happened

The onboarding trade picker offers nine options
(`piggles/apps/account/components/onboarding.tsx`, `TRADES`):

`food · salon · apparel · professional · fitness · auto-parts · electronics · wholesale · generic`

The platform ships **ten** industry starters and **ten** sample-data packs, and
the tenth of each is `florist`:

- `wizeworks/services/api-rest/src/lib/industry-starters.ts` — `slug: 'florist'`,
  including a scheduling preset (`florist-workshops`) written specifically for
  the wedding-and-workshops half of that trade
- `wizeworks/packages/db/src/sample-data/packs/florist.ts`

Neither is reachable from Piggles. A florist signing up picks "Something else",
`industry` resolves to `generic`, and the furnish call installs the generic
starter and the generic pack over a business the platform has purpose-built
content for.

Meanwhile `piggles/apps/account/components/brand-panel.tsx:96` tells that same
person, on the screen before: **"For bakeries, barbers, florists, garages and
workshops."**

## What should have happened

Either the picker offers florist, or the florist starter and pack are
deliberately sparx-only and that decision is written down somewhere. Advertising
florists on the signup screen and then having no florist is the combination that
cannot be right.

## How to reproduce

1. `http://localhost:3020` → Get started → sign up.
2. Read the panel beside the form: it names florists.
3. Reach `/onboarding`, open the trade list: nine options, no florist.
4. `grep -n "slug: '" wizeworks/services/api-rest/src/lib/industry-starters.ts` —
   ten slugs, `florist` among them.

Every time; it is a static list.

## Why it matters

Small in blast radius, precise in what it costs: the one trade the marketing
copy names by example is the one trade that gets the catch-all setup. It is also
the cheapest possible fix — one entry in `TRADES` and one in `TRADE_SHELF` — so
leaving it is a choice rather than a constraint.

Worth deciding rather than patching, because it raises the real question: is the
picker meant to track the starter list, and what happens when the platform adds
an eleventh?

## Where it lives

- `piggles/apps/account/components/onboarding.tsx` — `TRADES`, `TRADE_SHELF`
- `wizeworks/services/api-rest/src/lib/industry-starters.ts`
- `wizeworks/packages/db/src/sample-data/packs/florist.ts`

## The fix

—
