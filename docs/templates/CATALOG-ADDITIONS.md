# Phase 2 catalog additions — consolidated from all 10 design docs

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-04

The ten design studies independently converged on a small set of **reusable catalog
additions**. Building these once (in `@wizeworks/silica-catalog` sections + `SPARX_CATALOG`,
and where interactivity is needed, `@wizeworks/silicaui-behaviors`) unlocks all ten
templates AND serves real tenants — never inline a hero per bundle. This is the Phase-2a
work that Phase-2b (the 10 blueprints) builds on top of.

Legend — **[S]** static composition (no runtime, ships today via silica classes) ·
**[B]** needs an interactive behavior (silicaui-behaviors hydration) · **[T]** theme/token
work · **[N]** genuinely new section.

## A. Hero system — one `offer_hero` with modes [S]/[B]

Every minimal/luxury/tech template wants a richer hero than the current single block.

- **media:** `image` | **video** (full-bleed muted autoplay) — Gymshark, VB, SKIMS, DJI. **[B]** for video controls (pause/mute).
- **layout:** `overlay` (text over full-bleed image) | `split` | **`centered`** (centered single-CTA) — Allbirds (overlay), VB (centered), all.
- **slides[]:** multi-slide **carousel / switcher** (auto-advance, dots/chevrons, per-slide title+CTA) — Kith, DJI hero switcher. **[B]** carousel.
- dual-CTA (solid + outline) already expressible.
- **Needed by:** all 10 (each picks a mode).

## B. Tinted section grounds [S] [T]

Let any section take a **soft color-fill background** (a band ground: marigold, navy, sage,
cream, magenta, espresso…). The entire "colored picture-book bands" and "dark-chrome island"
look rides on this.

- **Needed by:** Bombas (core), Gymshark/DJI/Fashion Nova (dark chrome islands), Bokksu (espresso band), Sephora (magenta bands).
- Note: silica `bg-<role> bg-soft` + `surface="dark"` islands already exist — this is confirming a **section-level `ground` prop** that maps to them cleanly on tenant sites.

## C. Buy-box expansion — a `buy_box` kit [S]/[B]

The PDP buy-box is the most-requested expansion; several distinct merchandising modes:

- **subscription / cadence** — plan radio-cards (12/6/3/1-mo), per-month price, SAVE/POPULAR/BEST-VALUE ribbons, gift-with-purchase, struck term total — Bokksu (core). **[B]**
- **pack-size / segmented control** with live pack-savings — Bombas. **[B]**
- **named swatch groups** ("Core" vs "Limited"; shade names) — Bombas, Sephora, Gymshark. **[S]**
- **bargain kit:** comp-value strikethrough, pay-in-4, delivery countdown — Fashion Nova. **[S]** (+ **[B]** countdown)
- **variant-adaptive CTA:** ADD TO BAG / SELECT SHADES / Select a Size / NOTIFY ME — Sephora, Gymshark. **[S]**
- **urgency micro-chip** ("N viewed today" / low stock) — Gymshark, Fashion Nova. **[B]** (bindable, not hardcoded)
- **vertical-thumbnail gallery** (rail + stacked scroll) — Kith, VB. **[S]**
- **Needed by:** all commerce templates (each selects modes).

## D. Products / PLP density variant [S]/[B]

- **density toggle** (3/4/5-up) — Fashion Nova, VB. **[B]**
- **swatch-row + star-rating cards** (`product_card` variant) — Sephora, Fashion Nova, Gymshark. **[S]**
- **sale-badge cards** (% off, comp value) — Fashion Nova. **[S]**
- **color facet / filter rail** + **tab filter** — Fashion Nova, Sephora, Gymshark. **[B]**
- **ranked "Top N in category"** carousel (numbered badges) — Gymshark. **[S]**
- **Needed by:** Fashion Nova (core), Sephora, Gymshark; lighter templates use the plain grid.

## E. Feature-scroll bands (tech/editorial storytelling) [S]

- **`product_subnav`** sticky scrollspy anchor bar **[N] [B]** — DJI.
- **`alternating_rows` full-bleed variant** (edge-to-edge capability rows) — DJI, Allbirds. **[S]**
- **`material_macro` band** (full-bleed macro photo + overlay headline selling a material) **[N]** — Allbirds, Bokksu (provenance). **[S]**
- **full-bleed-photo `how_it_works`** — Bokksu. **[S]**
- **Needed by:** DJI (core), Allbirds, Bokksu.

## F. Comparison — icon-row variant [S]

`comparison_table` with an **icon per row** spec-compare layout — DJI. **[S]**

## G. Gallery / tiles variants [S]/[B]

- **editorial-tile gallery** (full-bleed "House of…" lookbook tiles) — VB, Kith. **[S]**
- **category_tiles flat-color-swatch mode** — Allbirds. **[S]**
- **segment-toggle** on tiles/grid (Women/Men style, bound in-place) — Gymshark. **[B]**
- **editorial-edition `gallery_strip`** (monthly editions / shoppable social strip) — Bokksu, Kith. **[S]**
- **Needed by:** most editorial templates.

## H. Notice / urgency [S]/[B]

- **countdown `notice_banner`** — Fashion Nova. **[B]**
- auto-rotating announcement bar — Gymshark. **[B]** (already expressible via dismiss/rotate?)

## I. Reviews [S]

`review_summary` with **photos + merchant replies** + rating-snapshot bars — Bokksu, Sephora, Gymshark. **[S]**

## J. GWP / cart affordances [B]

- **gift-with-purchase / rewards band** ("FREE BLUSH… choose shade at checkout") — Sephora, Bokksu. **[S]** band + **[B]** cart logic.
- **cart-drawer upsell / free-gift threshold** — Bokksu, Fashion Nova. **[B]** (cart runtime — may be out of scope for v1 static templates).

## K. `product_qa` [N]

A question-and-answer section (VB's AR/AI PDP assistant analog) — VB. Static Q&A list is **[S]**; live assistant is out of scope.

## L. Theme/token coverage [T]

Confirm the theme token bag + catalog-sweep AA handle all ten bespoke themes:

- **serif-across-everything** (`maison`, VB — serif on headings, prices, buttons)
- **serif-display / sans-body** (`atelier`, Kith)
- **no registered accent** (SKIMS muted-neutral — sweep must treat as intentional)
- **bright primary w/ dark ink** (`romp`, `gloss`, `voltage`)
- **true-dark page** (`flux`, DJI) vs **dark chrome + light content** (`velodrome`, Gymshark)
- **tinted-paper** (`sage-oat`, `roastery`).

---

## Build-order implication

Roughly **A, B, C(static parts), D(cards), E, F, G, I** are **[S]** — static silica composition,
buildable now with zero runtime, and cover the bulk of "closest clone" fidelity. The **[B]**
interactive items (carousels, cadence selectors, density toggles, scrollspy, countdowns,
filters, cart logic) depend on `@wizeworks/silicaui-behaviors` — some hydrations exist
(disclosure, tabs, dismiss, counter, toc, theme-toggle, lightbox), others would be new.
**[T]** theme work is per-blueprint and gated by the catalog-sweep AA test.

**Decision to confirm (see check-in):** for v1, build the **[B]** behaviors for full interactive
fidelity, or ship the **[S]** static approximation first (a carousel renders its first slide,
a cadence selector renders the default plan, etc.) and layer behaviors after — every template
still reads as a faithful clone statically, and no template is blocked on a runtime.
