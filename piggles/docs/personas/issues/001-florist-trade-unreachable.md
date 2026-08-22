# 001 — A florist cannot pick "florist", and gets the generic setup instead

**Status:** fixed
**Severity:** minor
**Found by:** roster design · while allocating one persona per trade
**Surface:** getpiggles › /onboarding › "What do you do?"
**Filed:** 2026-08-18
**Fixed:** 2026-08-20
**Confirmed by:** P01 · Thistle & Rye — the picker read on the screen at
`localhost:3021/onboarding`

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

The list is no longer kept by hand. It is DERIVED from the packs that exist:

```ts
export function tradeOptions(): TradeOption[] {
  const available = Object.keys(SAMPLE_DATA_PACKS).filter((slug) => slug !== GENERIC_TRADE);
  const named = TRADE_ORDER.filter((slug) => available.includes(slug));
  const rest = available.filter((slug) => !named.includes(slug)).sort();
  return [...named, ...rest, GENERIC_TRADE].map((slug) => ({
    value: slug,
    label: TRADE_LABELS[slug] ?? SAMPLE_DATA_PACKS[slug]!.label,
  }));
}
```

This answers the question the issue actually raised — "what happens when the
platform adds an eleventh?" A pack nobody has named yet is offered under its
OWN label rather than being unreachable: it reads a little like a catalogue
until somebody writes it a better name, which is a visible prompt instead of a
silent gap. Drift in the other direction is gone too — a label for a pack that
does not exist is simply never offered.

Florist is now named and ranked like the rest:

- `TRADE_LABELS.florist` → **Flowers & plants**
- `TRADE_SHELF.florist` → `retail`
- `TRADE_WORDS.florist` → florist, flower, floral, bloom, botanic, plant, garden,
  nursery, bouquet, wedding, workshop, greenhouse — so a florist is offered the
  templates that are ABOUT flowers, the same way #007's fix works for food

## Where the fix lives

- `piggles/apps/account/lib/trade-options.ts` — labels + order, browser-safe
- `piggles/apps/account/lib/trades.ts` — `tradeOptions()`, reading the packs
- `piggles/apps/account/app/onboarding/page.tsx` — reads them on the server
- `piggles/apps/account/lib/looks.ts` — the florist shelf and words

## Confirmed, and what is still not

Read off the live picker — ten trades where there were nine, florist third:

```
food : Food & drink            fitness : Fitness & wellbeing
salon : Beauty & salon         auto-parts : Car parts & repair
florist : Flowers & plants     electronics : Electronics & tech
apparel : Clothing & accessories   wholesale : Wholesale & trade supply
professional : Professional services   generic : Something else
```

**Not** confirmed: what a florist actually GETS after picking it — the starter,
the pack and the ranked template shelf. That is a full signup, and it belongs to
P05, the florist persona, rather than to a bakery's run.
