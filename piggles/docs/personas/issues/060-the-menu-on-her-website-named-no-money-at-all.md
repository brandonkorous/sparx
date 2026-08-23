# 060 — The menu on her website named no money at all

**Status:** fixed
**Severity:** **major** (a public menu whose prices name no currency; 146 of them, across seven templates)
**Found by:** P01 · Thistle & Rye · standing checks — reading her own **What we bake** page on a phone
**Surface:** the tenant's live site — the menu page every restaurant/café template installs
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** the shipped payloads + a re-render — see **Confirmed by**

## What happened

Reading her published site at phone width, the menu page says:

> **Country sourdough** · `6.50`
> **Seeded baguette** · `3.80`
> **Sandwich tin loaf** · `4.20`

Not `$6.50`. `6.50`. Every price on the page, and every price on every restaurant
template in the catalog.

The sushi template is the sharpest version of it:

> **Omakase — twelve courses** · `145`

A number next to a phrase about courses, with nothing to say it is money.

## What should have happened

A price on a menu says what currency it is in. The rest of the catalog already does —
**696 price strings across 179 blueprints are written `$50`, `$120`, `$0.00`**, including
the two catering templates, which are the same industry. Seven templates were out of step
with the house they live in.

## How to reproduce

1. Install any restaurant/café template (Marisol's is `sparx-restaurant-cafe`).
2. Open the Menu page on the published site.
3. Every price is a bare number.

Every time — it is in the shipped payload.

## Why it matters

Two ways, and the second is the worse one.

**The shopper** reads a menu that names no currency. On a café that is merely sloppy; on
`Omakase — twelve courses · 145` it is genuinely ambiguous.

**The owner** is a non-technical business owner who edits the template's numbers to her
own. She typed `6.50` over `15` — and there was no symbol in the field to keep. The
template taught her the wrong shape, silently, and she had no way to know: the number she
replaced looked exactly as correct as the one she typed.

## What else it turned up — pounds on a dollar platform

The same sweep found **`£`** in four blueprints, on a platform whose schema defaults every
order, payment, invoice and purchase to **USD**, and where no blueprint declares a
currency at all:

- **fine dining** — `£145` and `£95` in the hero, `£25`/`£50` deposits in its booking
  policy… **beside the bare `46` and `52` in its own à-la-carte list.** One page, two
  currencies, one of them unnamed.
- **wine bar** — "Corkage … is £10"
- **b2b foodservice** — a `£250` delivery minimum, in four places
- **b2b building materials** — "around £2.90 a length"

## Where it lives

- `marketplace-catalog/_gen/gen-restaurant-{cafe,bistro,pizzeria,sushi,vegan,winebar,fine-dining}.ts`
  — `el('span', '… text-primary', { text: item.price })` over data authored as `price: '15'`.
- The emitted payloads, `marketplace-catalog/blueprints/sparx-restaurant-*/site.json`.

## The fix

**In the generators**, one render site each rather than 146 data strings: a shared
`menuPrice()` in `service-sites/harness.ts` beside the existing `price(cents)`. Menu data
stays the bare number a kitchen writes on a board; the currency belongs to the render,
once. The helper passes through anything already carrying a symbol.

The café's prose carried the same bug — "an extra egg to anything for 3." — and is fixed
in both the generator and the payload.

**In the committed payloads**, surgically: **146 price nodes** given a currency, matched
by class and by the child being a bare number, and re-prettied. The diff is
**162 insertions / 162 deletions** — one line per price, nothing else. Regenerating
instead would have re-minted every node id and reverted the bundles' name/author drift
(see [059](059-more-than-half-the-ready-made-sites-showed-a-blank-color-block.md)).

**The pounds** are dollars now, in the generators and the payloads both. Nothing in the
catalog outside the harness's own guard regex carries a `£` any more.

## Confirmed by

Re-ran `gen-restaurant-cafe.ts` with the fix: the freshly generated `site.json` carries
**19** `$`-prefixed prices where it had none. The committed payloads carry the same 146,
verified as a symmetric 162/162 diff, and a repo-wide sweep for `£` in
`marketplace-catalog/**/*.{json,ts}` returns only `menuPrice`'s own pass-through test.

**Her own page is NOT fixed by this**, and that is the honest part: a blueprint fix
reaches the next install, never the sites already built from it. Marisol has to type the
symbol into 19 fields herself.

## Rating effect

None — this is content in the shipped catalog, not a console pane.
