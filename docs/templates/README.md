# Reference-driven site templates

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-04

## What this is

A set of first-party sparx **site blueprints** whose designs are modelled on the
biggest, most-proven storefronts on the market (late 2026) rather than invented
from scratch. Each template mimics a real flagship's **layout, section rhythm,
PDP structure, nav behaviour and overall aesthetic** — rendered in sparx's own
silica design system, paired with a fitting theme, and populated with our own
example-business content.

**Why reference real sites.** The biggest storefronts have had their layouts
A/B-tested against enormous revenue. Modelling their structure gives templates
that actually convert and that span genuinely different design languages, instead
of twenty near-identical grids. It is a better basis than picking abstract designs.

## The rules (binding for every template here)

1. **Structure & aesthetic, not identity.** We mimic layout, rhythm, PDP anatomy,
   nav, type feel and colour mood. We NEVER copy a brand's logo, name, trademarks,
   product photography, or literal brand palette. Every template ships sparx
   branding, our own example business, and royalty-free / original imagery.
2. **Tenant sites get full design freedom.** These are tenant blueprints, so the
   sparx-surface restraints (no shadow / no glass / no gradient / RULE #3) do NOT
   apply — see [[feedback_design_restraints_are_sparx_only]]. Use whatever the
   reference design calls for.
3. **silica-native.** Compose from the `SPARX_CATALOG` sections
   ([packages/silica-catalog/src/sections/](../../packages/silica-catalog/src/sections/))
   and the golden blueprint spine. New patterns a reference needs that the catalog
   lacks are added to the catalog (so they propagate), never hand-inlined per bundle.
4. **Industry-agnostic.** Vary the example verticals — never default to one industry.
5. **Faithfulness bar: "closest clone allowed"** (Brandon, 2026-08-04): match the
   reference's structure AND overall aesthetic feel as closely as we can while
   staying on sparx components + branding and using no trademarked assets.

## The ten templates

Each row is a distinct design language. Folder holds the design doc + screenshots.
`sparx slug` is the eventual blueprint key (`sparx-<slug>`); the theme direction is
finalised in the design doc (an existing preset from the 20, or a bespoke one that
echoes the reference's colour mood).

| #   | Reference        | Archetype                          | Example business (ours)               | sparx slug          | Bespoke theme                      | Status         |
| --- | ---------------- | ---------------------------------- | ------------------------------------- | ------------------- | ---------------------------------- | -------------- |
| 1   | SKIMS            | Minimal luxury / muted editorial   | premium skincare                      | `luxe-minimal`      | muted-neutral (no accent)          | ✅ doc ☐ build |
| 2   | Gymshark         | Bold athletic DTC                  | **Threshold** — endurance cycling     | `bold-athletic`     | `velodrome` (dark chrome + hi-vis) | ✅ doc ☐ build |
| 3   | Allbirds         | Natural / sustainable clean        | eco everyday housewares               | `natural-clean`     | `sage-oat` (tinted-paper)          | ✅ doc ☐ build |
| 4   | Kith             | Streetwear editorial grid          | **Atelier Nord** — design furniture   | `editorial-grid`    | `atelier` (mono + serif display)   | ✅ doc ☐ build |
| 5   | Bombas           | Playful colourful mission          | **Rally** — pet supplies + giveback   | `playful-mission`   | `romp` (bright marigold + bands)   | ✅ doc ☐ build |
| 6   | Bokksu           | Warm subscription / food editorial | **Latitude Coffee Club** — sub + shop | `warm-subscription` | `roastery` (cream + terracotta)    | ✅ doc ☐ build |
| 7   | Victoria Beckham | High-fashion luxury serif          | **Vérane** — jewellery + fragrance    | `couture-serif`     | `maison` (serif-across, pure B/W)  | ✅ doc ☐ build |
| 8   | DJI              | Tech / cinematic product           | **Aphelion** — premium audio          | `tech-cinematic`    | `flux` (true-dark + electric blue) | ✅ doc ☐ build |
| 9   | Sephora → Huda   | Beauty counter grid                | **Maeve** — colour cosmetics          | `beauty-counter`    | `gloss` (blush + magenta)          | ✅ doc ☐ build |
| 10  | Fashion Nova     | Dense fast-fashion catalog         | **Voltage** — apparel                 | `catalog-dense`     | `voltage` (bright + sale-red)      | ✅ doc ☐ build |

Consolidated Phase-2 catalog additions the ten docs converge on: [CATALOG-ADDITIONS.md](CATALOG-ADDITIONS.md).
_(Sephora hard-blocked automated capture with a 403; #9 was studied on Huda Beauty, the same archetype.)_

## How a template is built (once the doc is done)

Mirrors the existing `sparx-<name>` clone flow (see
[[active_theming_spine_golden_default]]): a blueprint bundle under
`marketplace-catalog/blueprints/sparx-<slug>/` with `site.json` (home + pages
composed from catalog sections), a `theme`, `brand` (identity only), example
`content.json` / `commerce.json`, and `sparx.json` manifest. The catalog
self-publishes at api-rest boot, so no manual ingest step ships them.

## Available primitives (build reference)

- **20 themes** across 4 groups (`SPARX_THEME_GROUPS`) — shops, trades, care, studios.
  Grounds: paper / tinted / mid / dark; primaries: mono / deep / bright.
- **80 catalog sections** — 75 in `SECTION_CATALOG` (9 groups: layout, gallery,
  compare, process, people, place, convert, content, offer) + 5 in `COMMERCE_CATALOG`
  (products, product_carousel, product_card, buy_box, collection_header).
- Golden spine: hero → shop → journal → features → more-ways → cta.

See [\_TEMPLATE.md](_TEMPLATE.md) for the per-brand doc format.
