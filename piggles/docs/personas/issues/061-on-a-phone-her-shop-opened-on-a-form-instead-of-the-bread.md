# 061 — On a phone, her shop opened on a form instead of the bread

**Status:** fixed
**Severity:** **major** (every tenant storefront, on the device most shoppers use)
**Found by:** P01 · Thistle & Rye · act 8's outstanding 390px pass — the shop
**Surface:** the tenant's live site — **All products** (and every collection / category page)
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · the same page, same width — see **Confirmed by**

## What happened

Her shop at 390px, top to bottom:

> Home / All products
> **All products**
> **PRICE** · `Min` – `Max`
> **AVAILABILITY** · ☐ In stock only
> **[ Apply ]** Clear
> 9 products · Sort `Featured`
> …then, finally, a loaf.

**The first product started 549 pixels down an 844-pixel screen.** Two thirds of the
opening screen of a bakery's shop was a price box and a checkbox.

## What should have happened

A shop opens on what it sells. Filters are how you narrow ten things to three — they
are not the thing you came for, and on a phone they are not what should greet you.

## How to reproduce

1. Open the published site at 390px wide.
2. Go to **All products** (or any collection or category page).
3. Measure the top of the first product card. 549px, every time.

## Why it matters

Phone width is where most shoppers are. A shopper who lands on a form instead of a
photograph has to work out that scrolling is required before anything is for sale — and
some of them just leave. This is not Marisol's page: it is the product-listing chrome
`wizeworks/apps/site` renders for **every tenant**, and no tenant can edit it.

## Where it lives

`wizeworks/apps/site/components/products/scoped-product-browser.tsx` — the layout is
`grid-cols-[248px_minmax(0,1fr)] … max-[900px]:grid-cols-1`. Below 900px the two columns
simply stack, and the sidebar is the first child, so it lands on top. Nothing collapsed
it, and nothing moved it.

## The fix

**The products come first; the filters go below them, with a `Filter` control in the
toolbar that jumps to the panel.** Zero client JS, which is the component's stated
design property ("All state lives in the URL, so … the form needs no client JS") — an
in-page anchor and a CSS `order` swap under the existing 900px breakpoint.

While in the three facet components, four things that were wrong on every width:

- **Group headings were 12px uppercase letterspaced `<h4>`s** — below the 16px body floor
  and the 14px caption floor, and the eyebrow shape the design rules ban. They read as
  ordinary headings now. Row labels went 14px → 16px; counts 12px → 14px.
- **Fifteen inline `style={{…}}` props** across `facet-panel.tsx`, `search-facets.tsx`
  and `browse-facets.tsx` became utilities. One of them was doing nothing at all:
  `COLUMN_LABEL` set `flexDirection` and `alignItems` on a `<label>` **with no
  `display: flex`**, so every fitment drill label has been laying out inline rather than
  stacked since it was written.
- **`color="neutral"` on Clear**, three times. A dismiss beside a solid Apply is a
  genuinely untyped action, so it is colorless now (`variant="ghost"` with no color) —
  which is the theme-correct answer rather than the grey one.
- **`const YEAR_NOW = 2026;`** — the vehicle-year filter offered fifty years back from a
  literal. On 2027-01-01 every fitment shop would quietly stop offering the newest model
  year, which reads to a shopper as "they don't carry it". It reads the clock now.

Checked the siblings: `search-facets.tsx` (search results) and `facet-panel.tsx` (the
fitment PLP) carried the same headings, the same inline styles and the same neutral
Clear, and got the same treatment. Only `scoped-product-browser.tsx` has the stacking
layout, so only it needed the order swap.

## Confirmed by

Re-opened **All products** at 390px in the same harness. The page now reads
`9 products · [Filter] Sort` and **the first loaf starts at 317px** — a product is on
screen without scrolling. Tapping **Filter** scrolls to the panel, which reads
**Price / Availability / Apply · Clear** in normal-case 16px headings. No horizontal
overflow at 375 CSS px (`scrollWidth === clientWidth`).

Desktop re-checked at 1264px: the 248px sidebar is still on the left, the Filter jump is
correctly hidden above 900px, and the filter headings read as headings rather than
micro-caps.

## Rating effect

The shop at phone width — the first thing a shopper sees is now a product.
