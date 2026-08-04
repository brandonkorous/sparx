# Kith — design study → `sparx-editorial-grid`

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-04
**Reference:** Kith — https://kith.com (captured 2026-08-04, real Chrome, ~1245px viewport)
**Archetype:** Streetwear editorial grid — full-bleed cinematic imagery, ultra-minimal monochrome chrome, serif display over sans, lookbook/gallery rhythm.
**sparx slug:** `editorial-grid` · **Example vertical:** design furniture & objects · **Theme:** bespoke mono-serif — `atelier` (see §6; closest preset `gallery`/`press`)

> Faithfulness bar: **closest clone allowed** — mimic structure AND aesthetic feel,
> sparx components + branding only, no trademarked assets. See [README](../README.md).

## 1. Why this reference

Kith is the defining **editorial-streetwear** storefront: a shop that reads like a
magazine. It anchors our set as the **gallery / lookbook** archetype — near-zero
chrome (a tiny centered wordmark, four words of nav), enormous full-bleed cinematic
imagery, and a **serif display face set against a plain sans**, which is what makes a
product grid feel curated rather than transactional. The homepage is not a funnel of
offers; it is a **sequence of collections**, each introduced by a full-bleed editorial
slide and then made shoppable by a tight product carousel. It is the cleanest study of
how restraint — one typeface contrast, one column of whitespace, one huge photograph —
reads as taste and premium.

## 2. Screenshots

Captured to `./images/`.

- `home-fold.png` — Hero fold: full-bleed cinematic photograph (cyclist on a forest road), tiny centered `KITH` wordmark, four-word nav (New/Mens/Womens/Kids) + Hospitality & icons, bottom-left serif overlay title + paragraph, bottom-right outline `SHOP NOW` / `LEARN MORE`, carousel dots; below the fold a 5-up product row on warm-grey grounds.
- `footer.png` — Footer: 5 label columns (Join Our List w/ email+Submit, Learn, Kith, Policies, Follow Us) on a light-grey ground, hairline dividers, small-caps labels; bottom bar `© 2026 KITH NYC` + Select Site / Select Currency selectors + accessibility/privacy controls. Above it, a row of shoppable social tiles.
- `pdp.png` — Product detail: left **vertical thumbnail rail** + huge stacked product images (scroll gallery); right **sticky buy-box** — breadcrumb, collection label, **serif product title**, price, `COLOR:` name, size pills, `VIEW SIZE GUIDE`, full-width black `SELECT A SIZE` button, then `DESCRIPTION / SIZE & FIT / SHIPPING & RETURNS` tabs with two-column detail.

Signature interactive states not separately captured (documented from the live page):
the auto-advancing hero carousel (6 editorial slides) and the repeated "A Closer Look"
editorial-band → product-carousel rhythm down the homepage.

## 3. Design language

- **Palette:** **Monochrome, near-white.** Page ground is white / very light warm-grey; product tiles sit on a soft grey `~#EFEEEC`; ink is near-black `#111`; the wordmark and PDP CTA are pure black `#000` on white (inverted white on imagery). **No brand accent whatsoever** — every bit of color comes from the _photography_. Mood: editorial, quiet, expensive, gallery-like.
- **Typography:** The signature is a **high-contrast serif display** (collection titles, hero overlays, PDP product titles — e.g. "Kith Kids Fall 2026", "Kith for Cinelli Wind Jacket") set against a **plain neutral sans** for nav, body, labels, and prices (small caps, wide tracking on nav/labels). The serif/sans contrast _is_ the brand voice — there is almost no other styling.
- **Imagery:** Two registers — (1) **full-bleed cinematic editorial** for hero + collection bands (location photography, moody, wide crops, edge-to-edge); (2) **studio product** on seamless warm-grey grounds for the carousels/grid (garment-on-hanger or object, centered, generous margin). Aspect is tall/large; imagery is the entire design.
- **Shape & density:** **Near-zero radius** (square imagery, square outline buttons, square size pills). Effectively **no borders** except hairline footer dividers — separation is whitespace + ground shift. Product grids are a **tight 5-up** desktop row. Very generous vertical whitespace around section headers. No drop shadows.
- **Motion:** Auto-advancing **hero carousel** (dots + prev/next chevrons); horizontally-scrolling **product carousels** with side arrows; subtle hover image-swap / zoom on product cards; a lightweight newsletter-capture modal on PDP entry.

## 4. Layout anatomy (top to bottom)

- **Announcement / utility bar:** **None** — Kith goes straight to the hero (no offer strip). A restraint choice worth preserving.
- **Header / nav:** Ultra-minimal, reversed over the hero, three-zone. **Left:** `NEW · MENS · WOMENS · KIDS` (small caps, wide tracking; each opens a full-width category mega-panel). **Center:** small boxed `KITH` wordmark. **Right:** `HOSPITALITY` link + account, search, cart icons. Sticky, turns solid on scroll.
- **Hero:** **Full-bleed cinematic photograph carousel** (6 slides, auto-advancing). Overlay pinned bottom-left: **serif title** + one-paragraph description; bottom-right **two outline CTAs** (`SHOP NOW` / `LEARN MORE`); slide dots centered at the bottom.
- **Homepage section sequence:** a **repeating editorial→shoppable rhythm**, one cycle per collection:
  1. **Hero carousel** (Monday Program / Cinelli, Kith & '47 Yankees, Messi × adidas, Knicks Champions, Taxi Driver, Kith 101 Spring — each a full-bleed slide + serif title + CTA).
  2. **Featured product carousel** — the hero collection's products, 5-up, warm-grey tiles (name + price), side arrows, `SHOP ALL` link. Some cards carry a small `CLOSED` / status tag.
  3. **Editorial picture band** — a collection intro: full-bleed photograph + serif title + paragraph + `SHOP NOW` and an **`A CLOSER LOOK`** link.
  4. **Product carousel** for that collection.
  5. …bands 3–4 **repeat** per collection (Summer 2026, Kith Women Summer, Kith Kids Fall — each: editorial band + "A Closer Look" + carousel).
  6. **Shoppable social row** — a strip of Instagram-style tiles above the footer.
- **PDP anatomy:** Two-column, magazine-like. **Left:** a **vertical thumbnail rail** (far left) beside **huge stacked product images** that scroll (front, back, detail, on-model). **Right (sticky buy-box):** breadcrumb (`HOME › MENS › KITH MONDAY PROGRAM`), small collection label, **serif product title**, price, `COLOR: <name>`, `SIZE:` pills + `VIEW SIZE GUIDE`, full-width black **`SELECT A SIZE`** CTA, then a tab set — `DESCRIPTION / SIZE & FIT / SHIPPING & RETURNS` — rendering **two-column** spec/detail text (materials, features, style code, care). Sparse, lots of air.
- **Collection / PLP:** Same tight multi-up grid on white, product tiles on warm-grey grounds (name + price, minimal), category mega-panel from the nav drives navigation; filtering is minimal and unobtrusive.
- **Footer:** Light-grey ground, **five small-caps label columns** — `Join Our List` (email + `Submit`, consent line), `Learn`, `Kith`, `Policies`, `Follow Us` — over a bottom bar: `© 2026 KITH NYC`, **Select Site** + **Select Currency** selectors, accessibility + privacy-choices controls. Hairline dividers only.

## 5. Signature interaction patterns

1. **Serif-display / plain-sans contrast** as the entire brand voice — collection titles, hero overlays and PDP titles are serif; everything else is a quiet sans. Reproduce this and most of the "Kith feel" comes for free.
2. **Editorial→shoppable rhythm:** a full-bleed cinematic collection band immediately followed by a tight product carousel of that collection, repeated down the page — the homepage as a run of curated stories, not an offer funnel.
3. **Full-bleed cinematic hero carousel** with bottom-left serif overlay + outline CTAs, zero chrome competing with the photograph.
4. **Magazine PDP:** vertical thumbnail rail + big stacked scroll-gallery on the left, calm sticky buy-box on the right, spec text in tabbed two-column blocks.

## 6. The sparx translation

- **Theme:** **bespoke mono-serif — `atelier`** (closest shipped presets: `gallery` / `press` from studios). A **paper-ground mono** theme carrying a serif display.
  - **Grounds (4 surfaces):** `base-100` page = `#FFFFFF`; `base-200` tile/muted ground = `#EFEEEC` (warm light grey for product tiles + footer); `base-300` hairline = `#E6E4E0`; `base-content` ink = `#111111`.
  - **Primary strategy:** **mono** — the primary action is a pure-black `#000000` fill with white text (the PDP `SELECT A SIZE` / `ADD TO CART` button), inverting to white-on-image over photography. No colored primary — restraint is the point.
  - **Accent:** effectively **none** as chrome — color lives entirely in product/editorial imagery. (For the `theme` token bag we still need an accent role for AA; set it to a muted stone `#8A8578` used only for tiny meta/links, never as a fill.)
  - **Fonts:** display/heading = a **high-contrast serif** (a Canela/Times-refined feel — hero titles, section + product titles); body/labels/nav = a clean neutral sans, small-caps + wide tracking on nav & labels. The serif heading is the single most important token to get right.
- **Section mapping:**

  | Kith homepage band                                                             | sparx catalog key                                      |
  | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
  | Header / mega-nav + footer                                                     | `sparx_layout` (silica frame navbar/footer)            |
  | Full-bleed hero **carousel** (6 editorial slides + serif title + outline CTAs) | `offer_hero` _(multi-slide carousel variant — see §7)_ |
  | Featured collection product carousel                                           | `product_carousel`                                     |
  | Editorial collection intro band ("A Closer Look")                              | `picture_band`                                         |
  | Repeated collection carousels                                                  | `product_carousel`                                     |
  | Shoppable social row                                                           | `gallery_strip`                                        |
  | Footer: Join Our List + label columns                                          | `newsletter_signup` + `onward_links`                   |

  **PDP:** sticky buy-box → `buy_box`; vertical-rail scroll gallery → `products`/gallery _(vertical-thumbnail variant — §7)_; DESCRIPTION/SIZE & FIT/SHIPPING tabs → `spec_list` inside the buy-box.
  **PLP:** header → `collection_header`; grid → `products`.

- **Example business:** **Atelier Nord** — a design furniture & objects studio ("Objects made to keep"). Commerce catalog seeds ~12 SKUs — an oak lounge chair, a travertine side table, a linen-shade floor lamp, a ceramic carafe, a wool throw, a walnut stool, a paper-shade pendant, a stoneware vase set, a leather magazine sling, a cork tray, a mohair cushion, a brass candleholder — each shot on a seamless warm-grey ground, most in 2–3 material/colorways (so the swatch + size/variant UI renders). CMS `blog_post` records seed an **"Atelier Journal"** — maker stories, material notes, and room studies — to fill the editorial bands. Collections: New Arrivals, Seating, Lighting, Tabletop, Textiles.
- **Design freedom used (tenant-only affordances):** full-bleed **cinematic imagery** edge-to-edge; a **serif display face** loaded by the tenant theme; near-zero radius; **auto-advancing hero carousel** + horizontal product carousels; a **PDP entry modal** (newsletter). No shadows or gradients needed — separation is whitespace + ground shift, matching the reference exactly.
- **Deliberate departures:** vertical swapped streetwear → **design furniture & objects** (the editorial/gallery language ports perfectly to homeware); no Kith wordmark, photography, or collaboration naming; the offer-free, announcement-free chrome is preserved as a feature.

## 7. Build notes / catalog gaps

Catalog _variants/additions_ (propagate once, never per-bundle inlines):

- **`offer_hero` carousel variant** — a multi-slide full-bleed hero (N editorial slides, auto-advance, dots + chevrons, per-slide serif title + paragraph + dual outline CTA). If `offer_hero` is single-slide today, add a `slides[]` mode.
- **`buy_box` vertical-thumbnail gallery variant** — a left vertical thumbnail rail beside a stacked scroll-gallery, vs. the current arrangement — the magazine PDP layout.
- **Serif-display theme support** — confirm the theme token bag + `font-heading` cleanly carry a high-contrast serif and that the catalog-sweep AA check passes with black-on-white / serif headings (Kith's whole look leans on this).
- **`picture_band` "A Closer Look" secondary link** — a picture band with a primary CTA **and** a quieter secondary text link ("A Closer Look") — likely already expressible; confirm the secondary-link slot.
