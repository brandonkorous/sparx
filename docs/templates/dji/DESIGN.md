# DJI — design study → `sparx-tech-cinematic`

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-04
**Reference:** DJI — https://www.dji.com (captured 2026-08-04, default 1280px viewport, headless Chromium, US store)
**Archetype:** Tech / cinematic product — dark spec-forward layout, huge full-bleed product renders, capability-storytelling feature-scroll, icon-annotated spec/compare tables, a sticky per-product sub-nav, electric-blue tech accent.
**sparx slug:** `tech-cinematic` · **Example vertical:** premium audio hardware · **Theme:** bespoke dark — `flux` (see §6; closest presets `gallery`/`signal`)

> Faithfulness bar: **closest clone allowed** — mimic structure AND aesthetic feel,
> sparx components + branding only, no trademarked assets. See [README](../README.md).

## 1. Why this reference

DJI is the defining **tech / cinematic product** storefront: a precision-hardware brand that treats every product page like a film. It earns its place in our set as the **dark spec-forward anchor** — the one design language built to sell an _engineered object_ on capability, not lifestyle. Its signatures are unmistakable: a **near-black cinematic hero** where a single hero render floats over a graded environment, a **per-product sticky sub-nav** (Accessories · Compare · Specs · Video · Downloads · FAQ · Buy Now) that turns a PDP into a mini-site, and a **very long feature-scroll** (the DJI Mic 3 page runs ~31,600px) that alternates full-bleed cinematic capability bands with icon-annotated **spec-comparison tables**. Where Gymshark sells a _feeling_ with muted-video hype, DJI sells _numbers_ with cinematic restraint — big renders, tight technical type, one electric-blue accent, and a spec table that closes the deal. It is the cleanest study of how to make a spec sheet feel premium.

## 2. Screenshots

Captured to `./images/`.

- `home-fold.png` — Hero fold: dark full-bleed cinematic product render (flagship drone at golden hour), centered "product-category → NAME → tagline" stack, two pill CTAs ("Learn More" / "Buy Now"), and a **vertical product switcher** bottom-left (FlyCart 100 / Mavic 3 Pro / Air 3S) that swaps the hero.
- `home-full.png` — Full homepage scroll: cinematic hero → 2×2 product-spotlight tile grid (light) → full-bleed "Shot on…" editorial carousel → "Standing at the Forefront of Innovation" + 2-up report cards → "Explore … in Different Fields" 3-up category tiles → 3 utility icon-links → dark app-CTA band → dark mega-footer.
- `nav.png` — Header over the hero: three-zone dark bar — DJI logo (left), primary categories `Camera Drones · Handheld · Power · Specialized · Explore · Support · Where to Buy` (center-left), and search / account / region selector / blue **Store** pill (right); a light auto-utility bar sits above it.
- `plp.png` — Category listing (`/camera-drones`): the **mega-nav expanded** as a light icon-thumbnail strip (DJI Mavic · Air · Mini · Flip · Avata · Inspire · RC · Take a quiz · **Consumer Drones Comparison** · Accessories · Shop Now), then a centered category title + subhead, then full-bleed **cinematic product spotlight cards** (one product per band, name + tagline + Buy Now/Learn More).
- `plp-full.png` — Full category page: stacked cinematic per-product spotlight bands.
- `pdp.png` — Product detail fold: cinematic full-bleed hero (product worn/used in scene), centered "descriptor → NAME → tagline" + dual pill CTA, and the **sticky product sub-nav** (Accessories · Compare · Explore by Scenarios · Specs · Video · Downloads · FAQ · blue **Buy Now**).
- `pdp-full.png` — Full PDP (~31.6k px): the capability feature-scroll — alternating dark cinematic bands and light spec-highlight bands, ending in a **spec-comparison table**, a premium-accessory grid, and the full spec list.
- `feature-scroll.png` — Signature: a full-bleed cinematic **capability band** — a lifestyle scene with the product in-frame and a large centered white overlay headline ("Small, Lightweight, Versatile"), sticky sub-nav pinned above.
- `compare.png` — Signature: the **spec-comparison table** ("DJI Mic Series Comparison") — 3 product columns (render, name, "Learn More"), then **icon-per-row spec comparisons** (Transmitter Weight, Noise Cancelling, Voice Tone Presets…) with values and an em-dash / "N/A" where a model lacks the feature.
- `footer.png` — Dark mega-footer: 5–6 link columns (Product Categories / Where to Buy / Fly Safe / Support / Explore / Community) + a Subscribe email input, over a sub-footer utility row + social icons + legal bar.

The primary-nav hover **mega-panel** could not be triggered headlessly (it is a JS hover/click flyout keyed off the top categories). Its content is nonetheless fully captured as the persistent product-family **icon strip** at the top of `plp.png`, and documented from the DOM below.

## 3. Design language

- **Palette:** **Cinematic near-black chrome with one electric-blue signal.** The chrome (nav, footer, app-CTA band, PDP sub-nav) is near-black `#161618`/`#1A1A1A`; the hero and PDP feature bands are **full-bleed cinematic photography** graded dark (product renders float over dusk skies, matte-black studio grounds, dim interiors). DJI's marketing home breaks to **light product tiles** (`#F4F5F7`/`#EDEFF2` grounds, black ink) between the dark beats. The single brand accent is **DJI electric blue `~#1683E0`** — the Store pill, the sub-nav "Buy Now", and every "Learn More ›" link; nothing else is chromatic. Ink is near-black `#0A0A0A` on light, near-white `#F5F6F8` on dark, with a cool grey `#8A8D93` for meta/labels. Mood: precise, expensive, engineered, showroom-lit.
- **Typography:** A clean **technical sans**, near-uppercase for product names ("DJI **MAVIC 3** PRO", "DJI **MIC 3**") set very large with tight tracking and a lighter weight suffix (`PRO` in thin), a **medium-weight sentence-case tagline** beneath ("Inspiration in Focus", "Performance That Speaks"), and small regular-weight body/spec labels. Spec values are set larger than their labels (value on top, grey descriptor under). The size jump between the giant product name and the small descriptor above it _is_ the hierarchy — no eyebrow rule, just scale.
- **Imagery:** One dominant register — **cinematic hardware photography**: single hero render, dramatic key-light, shallow-DOF environment, full-bleed edge-to-edge. Product-in-use lifestyle shots for the capability bands (product visible in scene). Studio-isolated renders on the spec-comparison table and accessory grid. Everything is 16:9-ish full-bleed or centered-render; nothing is a flat product thumbnail.
- **Shape & density:** **Low radius, hairline structure, flat.** Pill CTAs on heroes (fully rounded outline buttons) are the one round moment; cards, tiles, tables and the sub-nav are near-square with hairline dividers. No drop shadows on chrome — separation is by full-bleed edges and dark/light ground shifts. Generous vertical rhythm around each cinematic band; the spec table is airy (icon + value + label, lots of whitespace between rows).
- **Motion:** Scroll-reveal on every feature band (fade/rise as the render enters); the **hero product switcher** swaps render + copy in place; full-bleed editorial **carousels** with prev/next arrows; the **sticky sub-nav** pins on scroll and its section links scrollspy; parallax-ish settling on the big renders; a persistent floating "back-to-top" + support widget. All restrained — no autoplay spectacle, the imagery carries it.

## 4. Layout anatomy (top to bottom)

- **Announcement / utility bar:** A light strip above the dark nav — a single promo line + inline link ("Download the DJI Store app … › Download the App") with a dismiss ×.
- **Header / nav:** Dark, reversed over the hero, **three-zone**. **Left:** DJI logo. **Center-left:** primary categories — `Camera Drones · Handheld · Power · Specialized · Explore · Support · Where to Buy`, each opening a **hover mega-panel** (product-family icon grid — see `plp.png`). **Right:** search, account, a **region selector** ("United States"), and a solid electric-blue **Store** pill. Sticky.
- **Hero:** **Full-bleed cinematic product render**, dark-graded. Centered content stack: small category descriptor → **giant product name** → medium tagline → **two pill CTAs** (outline "Learn More" + outline "Buy Now"). A **vertical product switcher** (list of 3 product names, current one bold with a left tick) sits bottom-left and reslices the hero in place.
- **Homepage section sequence:**
  1. **Product-spotlight tile grid** — a **2×2** of large cinematic tiles on light grounds; each is a product render with an overlay descriptor + name (OSMO 360 / DJI FLIP / OSMO MOBILE 8) and "Learn More"/"Buy Now" links. The 4th tile is a **"Compare Camera Drones"** entry ("See product overviews and comparisons here" + "Help Me Choose").
  2. **Full-bleed editorial carousel** — a "Shot on DJI RS 5" cinematic lifestyle band with prev/next arrows and a "Learn More" overlay CTA.
  3. **Innovation editorial row** — centered "Standing at the Forefront of Innovation" heading + subhead, then a **2-up** of report/award cards (Agriculture Annual Report / Ronin 2 award) each with a descriptor label + "Learn More".
  4. **Fields grid** — "Explore DJI Products in Different Fields": a **3-up** of cinematic category tiles (Video Production / Enterprise / Agriculture), each with a title, one-line descriptor, "Learn More".
  5. **Utility icon-links** — a **3-up** of icon + label + "Learn More" on light (Where to buy / Support / Fly Safe).
  6. **App-CTA band** — dark: "Only in the DJI Store App" + subline + a **Download App** pill.
- **PDP anatomy:** A **sticky product sub-nav** (product name left; `Accessories · Compare · Explore by Scenarios · Specs · Video · Downloads · FAQ` + solid-blue **Buy Now** right) pins under the global header and scrollspies the page. Below it: the **cinematic hero** (descriptor → name → tagline → dual pill CTA over a full-bleed render). Then the **feature-scroll**: an alternating stack of (a) **full-bleed dark cinematic capability bands** with a large centered white overlay headline + short capability line, (b) light **feature-highlight bands** (render + heading + paragraph, sometimes a small inline spec/graph), and (c) **icon-annotated spec highlights** (icon + big value + grey label). It closes with a **spec-comparison table** (3 product columns; render + name + "Learn More"; then per-row: icon + value + grey descriptor, em-dash/"N/A" for absent features), a **premium-accessory grid**, the full **spec list**, and support/FAQ. "Buy Now" jumps to the store.
- **Collection / PLP (category):** The **mega-nav** persists as a light **icon-thumbnail strip** of the product family (per-model icons + "Comparison"/"Accessories"/"Shop Now"). A centered **category title + subhead** ("Camera Drones" / "Capture your moments from above…"). Then **stacked cinematic product-spotlight bands** — one product per full-bleed band (descriptor → name → tagline → Buy Now/Learn More), not a dense grid. A **"Consumer Drones Comparison"** entry lives in the strip.
- **Footer:** Dark mega-footer. **5–6 link columns** (Product Categories / Where to Buy / Fly Safe / Support / Explore / Community) + a **Subscribe** email input ("Get the latest news"). Below: a sub-footer utility row (Who We Are / Contact Us / Careers / Dealer Portal / RoboMaster), **social icons**, and a legal bar (Privacy / Terms / Cookies / Accessibility / © + region).

## 5. Signature interaction patterns

1. **Cinematic hero with an in-place product switcher** — a full-bleed dark render, centered "descriptor → giant name → tagline → dual pill CTA", and a vertical list that swaps the entire hero (render + copy) without navigating. The homepage merchandises its flagships this way.
2. **The per-product sticky sub-nav** — a PDP is a mini-site: its own pinned nav (Accessories · Compare · Specs · Video · Downloads · FAQ · Buy Now) that scrollspies the long feature-scroll. This is the single most DJI-defining device.
3. **Capability feature-scroll** — long-form storytelling that alternates full-bleed cinematic bands (big overlay headline, product in scene) with light feature-highlight + icon-spec bands, each scroll-revealed. It sells the object by walking its capabilities.
4. **Icon-annotated spec-comparison table** — the close: N product columns, each render + name + "Learn More", then per-row an **icon + value + grey descriptor**, with an em-dash / "N/A" where a model lacks the feature. A spec sheet made premium.

## 6. The sparx translation

- **Theme:** **bespoke dark — `flux`** (closest shipped presets: `gallery` — true-dark, zero-radius, showroom; and `signal` — graphite tech grotesk + electric indigo). Unlike Gymshark's `velodrome` (dark _chrome_ over light content), `flux` commits to a **genuinely dark PAGE** in both modes — a cinematic showroom where product renders pop against near-black, and "dark mode" simply goes fully black. This is the deliberate differentiation and the tech-cinematic anchor's whole point.
  - **Grounds (4 surfaces, light mode = a dark page):** `base-100` page `oklch(13% 0.012 260)` (cool near-black); `base-200` lifted band `oklch(16% 0.012 260)`; `base-300` line/inset `oklch(21% 0.012 260)`; `base-content` ink `oklch(96% 0.006 260)` (near-white). **Dark mode** drops further: `base-100 oklch(9% 0.01 260)`, `base-200 oklch(6% 0.01 260)`, `base-300 oklch(4% 0.01 260)`, ink `oklch(97% 0.005 260)`. Full-bleed cinematic imagery supplies the "pure black" moments over `base-100`.
  - **Primary strategy:** **deep→bright electric blue** — `primary oklch(62% 0.19 250)` (light mode) / `oklch(66% 0.18 250)` (dark), DJI-blue, carrying white ink (AA-safe on the dark ground and as a fill). This is the _only_ chromatic element — the Store/Buy pill, the active sub-nav item, active switcher tick, and every inline "Learn more ›" link.
  - **Secondary / accent (disciplined, signal-only):** `secondary` cool cyan `oklch(74% 0.13 210)` for spec-highlight icons / hover; `accent` bright signal-blue `oklch(80% 0.14 220)` for a "New" tag or a live-stock chip. Everything else is achromatic near-white on near-black — body and spec text clear AA comfortably.
  - **Shape:** low radius, hairline structure, flat — `--radius-selector 0.5rem`, `--radius-field 0.25rem`, `--radius-box 0.375rem`, `--border 1px`, `--depth 0`. Hero/PDP CTAs render as **outline pills** (a component choice over a soft/outline `Button`, `shape="pill"`), matching DJI's rounded outline hero buttons against otherwise-square chrome.
  - **Fonts:** head = **Space Grotesk** (technical grotesk — the near-uppercase giant product names + tight tracking); body = **Inter** (spec labels, paragraphs, meta). Both are already in the theme font set (`signal` pairing), so no new webfont.
  - **Statuses:** the **bright** set in both modes (dark grounds throughout), so info/success/warning/error stay legible over near-black.
- **Section mapping:**

  | DJI band                                                 | sparx catalog key                                           |
  | -------------------------------------------------------- | ----------------------------------------------------------- |
  | Utility promo bar ("Download the app ›")                 | `notice_banner`                                             |
  | Header / mega-nav + dark mega-footer                     | `sparx_layout` (silica frame navbar/footer)                 |
  | Cinematic hero + product switcher + dual pill CTA        | `offer_hero` _(cinematic-dark + switcher variant — see §7)_ |
  | 2×2 product-spotlight tile grid                          | `gallery_showcase`                                          |
  | "Compare Camera Drones" entry tile                       | `sparx_compare` _(entry-card)_                              |
  | "Shot on…" full-bleed editorial carousel                 | `picture_band` _(carousel variant — §7)_                    |
  | "Standing at the Forefront…" heading + 2-up report cards | `page_header` + `case_studies`                              |
  | "Explore … in Different Fields" 3-up tiles               | `category_tiles`                                            |
  | Utility 3-up icon links (Where to buy / Support / …)     | `reassurance_row`                                           |
  | Dark app / final CTA band                                | `closing_cta`                                               |
  | Footer subscribe input                                   | `newsletter_signup`                                         |

  **PDP:** sticky product sub-nav → **NEW: `product_subnav`** _(scrollspy anchor bar — §7)_; cinematic hero → `offer_hero` (cinematic variant); capability feature-scroll → `alternating_rows` + full-bleed `picture_band` + `feature_list_sparx`; icon-spec highlights → `numbers_band`; spec-comparison table → `comparison_table` _(icon-per-row variant — §7)_; premium-accessory grid → `product_carousel`; full spec list → `spec_list`; buy → `buy_box`; FAQ → `faq_single_open`.
  **PLP (category):** product-family icon strip → part of `sparx_layout` mega-nav + `category_tiles`; title + subhead → `collection_header`; stacked cinematic product bands → `alternating_rows` _(cinematic full-bleed product-spotlight variant — §7)_ (not a dense `products` grid); comparison entry → `two_up_compare` / `comparison_table`.

- **Example business:** **Aphelion** — a premium audio-hardware brand ("**Sound, engineered.**"). It sells reference headphones, earbuds and speakers the way DJI sells drones: cinematic renders, capability scroll, spec-compare tables. **Commerce catalog (~8 SKUs + accessories):**
  1. **Aphelion One** — flagship planar-magnetic open-back over-ear headphones — $699
  2. **Aphelion One Wireless** — adaptive-ANC wireless over-ear — $449
  3. **Aphelion Buds Pro** — ANC true-wireless earbuds (LDAC) — $279
  4. **Aphelion Buds Air** — true-wireless earbuds — $149
  5. **Aphelion Monolith** — reference active bookshelf speaker (pair) — $1,299
  6. **Aphelion Field** — portable Bluetooth speaker (IP67) — $199
  7. **Aphelion Pulse** — portable USB-C DAC / headphone amp — $229
  8. **Aphelion Case** _(accessory)_ — hard travel case — $69 · plus ** Aphelion earpads** ($39) & **braided cable** ($49) as accessory SKUs.

  Colorways per SKU (Onyx / Graphite / Titanium) so swatches render; each carries a **spec block** (driver, frequency response, impedance, ANC depth, battery, weight, codecs) to feed the `spec_list` + `comparison_table`. Collections: **All Audio · Headphones · Earbuds · Speakers · Accessories**, plus a **"Compare headphones"** entry.
  **CMS journal — "The Signal Path"** (the DJI-editorial analog): `blog_post` records seeding engineering-led tech stories — _Inside the One's planar driver_, _How we measure ANC (and why the number lies)_, _Reference vs. fun: tuning the Monolith_, _A studio session with [artist]_, _Choosing your first pair_ — to fill the innovation/editorial bands and the "Explore by Scenario" PDP tabs (Studio / Commute / Desktop / Travel).

- **Design freedom used (tenant-only affordances):** full-bleed **cinematic imagery** graded to black; a **genuinely dark page** (base-100 near-black, not just dark chrome); the **hero product switcher**; the **sticky scrollspy sub-nav**; full-bleed **editorial carousels**; scroll-reveal on every band; a floating support widget. All permitted on a tenant site (forbidden on sparx-owned surfaces). No shadows are needed — separation is full-bleed edges + dark/lifted ground shifts + hairlines, exactly as the reference does it.
- **Deliberate departures:** vertical swapped drones/cameras → **premium audio hardware**; no DJI logo, product photography, wordmark, or model names ("Mavic"/"Osmo"/"Mic"); DJI's marketing **home mixes light product tiles** — we commit fully to the dark cinematic PDP aesthetic **across the whole page** for one coherent showroom (the differentiation from `velodrome`); the electric-blue accent is DJI-adjacent but held to signal-only; all spec numbers are Aphelion's own, invented coherently, not scraped.

## 7. Build notes / catalog gaps

These are catalog _variants/additions_ (propagate once, never per-bundle inlines):

- **`offer_hero` cinematic-dark + product-switcher variant** — a full-bleed dark render with a centered "descriptor → giant name → tagline → dual pill CTA" stack and an optional **vertical product switcher** that reslices the hero's render + copy in place (bound to a small product set). If `offer_hero` is single-slide today, add a `slides[]` + `switcher: on|off` slot.
- **NEW: `product_subnav`** — a **sticky, scrollspy anchor bar** scoped to a product page (product name + section anchors + a solid primary "Buy" action), pinning under the global header. This is the defining DJI PDP device and the catalog has no per-page sub-nav today. Add to the `layout` group with a `sections[]` (anchor + label) + `cta` slot.
- **`comparison_table` icon-per-row variant** — a product-column comparison where each spec row is **icon + value + grey descriptor**, with an em-dash / "N/A" affordance for a feature a column lacks (bound from each product's spec block, not hand-typed). If `comparison_table` is text-cells today, add a `rowStyle: table | icon-spec` slot.
- **`alternating_rows` cinematic full-bleed variant** — a capability band that goes edge-to-edge with a **large centered overlay headline** over a photo (product-in-scene), alternating with light feature-highlight rows. Needs a `media: contained | full-bleed` + overlay-headline slot so the feature-scroll reads cinematic, not carded.
- **`picture_band` carousel variant** — a full-bleed editorial band with prev/next arrows cycling multiple cinematic scenes (the "Shot on…" moment).
- **`numbers_band` icon-spec variant** — icon + big value + grey label stat rows, sourced from a product's spec block, for the PDP capability highlights.
- **Hero/PDP CTAs as outline pills** — confirm `Button variant="outline" shape="pill"` reads correctly on the dark ground within a `surface="dark"` island (it should, via the theme's `-content` tokens); no re-skin.
