# Bombas — design study → `sparx-playful-mission`

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-04
**Reference:** Bombas — https://bombas.com (captured 2026-08-04, default 1280px viewport, real Chrome)
**Archetype:** Playful, colorful, mission-driven DTC — warm-cream page broken up by saturated joyful color bands (navy, marigold, sage, terracotta), a heavy chunky display face, hand-drawn squiggle + scalloped-cloud flourishes, and a "one purchased = one donated" giveback woven through every band down to the buy-box.
**sparx slug:** `playful-mission` · **Example vertical:** pet supplies with a shelter giveback · **Theme:** bespoke bright-primary — `romp` (see §6; closest presets `petal` / `signal`)

> Faithfulness bar: **closest clone allowed** — mimic structure AND aesthetic feel,
> sparx components + branding only, no trademarked assets. See [README](../README.md).

## 1. Why this reference

Bombas is the defining **playful mission-driven DTC** storefront: a comfort-basics brand whose entire identity is a "buy one, give one" pledge, rendered as a joyful, warm, unmistakably-friendly site. It earns its slot in our set as the **color-band / giveback anchor** — where Gymshark is monochrome and lets product photography carry all chroma, Bombas does the opposite: a calm warm-cream page is deliberately interrupted by **fully saturated color bands** (deep navy chrome, a marigold donation band, a sage "comfort" band, terracotta category tiles), each a different mood, so scrolling feels like turning pages in a picture book. A **heavy chunky display face**, hand-drawn accents (a squiggle underline, a scalloped-cloud band edge), and a giveback line repeated from the homepage headline all the way down to the buy-box ("4 Purchased = 4 Donated") make it the cleanest study of how to build a storefront that reads as _warm, generous, and human_ rather than transactional.

## 2. Screenshots

Captured to `./images/`.

- `home-fold.png` — Hero fold: navy announcement bar → cream header (BOMBAS wordmark left, centered nav, right utilities) → a 4-up color-block category tile strip → full-bleed lifestyle hero ("COMPRESSION MADE FOR EVERY MOMENT" over a warm-tan group shot) with dual "Shop Women / Shop Men" black-pill CTAs.
- `home-full.png` — Full homepage scroll: category tiles → hero → 4-up use-case tiles (Casual/Compression/Sport/Dress) → mission headline band → featured-collection card + carousel → Women's & Men's New Arrivals carousels → sock-height guide strip → marigold "200 MILLION+ DONATIONS" impact band → sage "Comfort Beyond Socks" 3-up → navy newsletter band → footer.
- `nav.png` — Header strip: navy utility bar ("20% Off First Order… / Free Standard Shipping on $75+", country selector right) over a cream navbar — wordmark left, centered primary nav (Women/Men/Kids/Sport/Thank You/Help), Log In + search + bag right.
- `pdp.png` — Product detail fold: left buy-box (breadcrumb, title, price + strike + "10% Pack Savings", **pack-size segmented control** Single/4/8/12, **named swatch groups** "Limited" + "Core", cross-design links, S/M/L size pills + Size Guide, navy **Add to Bag**, **"4 Purchased = 4 Donated"** microline, shipping + reviews accordions) beside a large image gallery with a "1 / 6" pager.
- `pdp-full.png` — Full PDP: buy-box + gallery → "BLISTERS BE GONE" feature band → "ONE PURCHASED = ONE DONATED" giveback band → recommendations → reviews (4.8, 67,665 reviews).
- `plp.png` — Collection listing: a top **sock-height education strip** (Ankle/Half Calf/Quarter/Calf/Knee High/No Show, each with a one-line description + carousel arrow) → left facet sidebar (Category / Collection / Size checkboxes) + "410 Items" count + "Sort: Featured" → 3-up product grid (swatch dots +N, name, price + strike + pack-savings, "Women · Midweight" meta).
- `footer.png` — Footer: "100% HAPPINESS GUARANTEED" reassurance block + Get Help, "More Info" + "Shopping" link columns, a **Certified B Corporation** badge, then a legal bar.
- `mission-band.png` — Signature: the full-width **"ONE PURCHASED = ONE DONATED"** mission headline in huge heavy black display over cream ("We donate on your behalf in all 50 states."), leading a featured-collection card (NEW badge + "Shop The Collection") + product carousel.
- `impact-band.png` — Signature: the **marigold impact band** — "200 MILLION+ DONATIONS / You Did Good… Real Good" set inside a **cream scalloped-cloud shape**, with a give-back seal + "See Your Impact" CTA.
- `category-tiles.png` — Signature: the sage "Comfort Beyond Socks" band — heading with a **hand-drawn coral squiggle underline** over a 3-up of terracotta-ground category tiles (Slippers & Shoes / Underwear / Tees).

## 3. Design language

- **Palette:** A warm **cream paper** page (`#FDFCF6`) with light-grey product tiles (`#F1F1EE` / `#F3F3F2`) and near-black ink (`#1D1D1D`), deliberately interrupted by **four saturated brand bands**: **deep navy** `#223859` (announcement bar, newsletter band, footer accents, the **Add to Bag** CTA), **marigold gold** `#E8BA4C` (the donation/impact band) with a **cream scallop** `#EAEADF` cloud inside it, **sage green** `#B2C691` (the "Comfort Beyond Socks" band), and **terracotta/rust** category-tile grounds (`~#B95E39`). Black pill CTAs (`#1D1D1D`) sit on the light bands; navy CTAs sit on light and white on dark. Mood: warm, generous, joyful, unmistakably human — color used as _pacing_, not decoration.
- **Typography:** Display is a **heavy chunky rounded grotesque** (a bespoke `bombasFont`) — very bold, slightly condensed, all-caps for hero + mission + impact headers ("COMPRESSION MADE FOR EVERY MOMENT", "ONE PURCHASED = ONE DONATED", "200 MILLION+ DONATIONS"). Softer mixed-case display appears for editorial headers ("Comfort Beyond Socks", "New Arrivals"). Body/labels are a clean warm sans, sentence case, regular weight. The heavy-caps-vs-warm-sans contrast _is_ the friendly voice — big and bold but never aggressive.
- **Imagery:** Bright, warm-lit **lifestyle + studio** photography on saturated seamless backdrops (tan, terracotta, sage), edge-to-edge on tiles and hero. Products shot flat on light-grey tiles for the grids. **Illustration/craft flourishes** carry the playfulness: a hand-drawn coral squiggle underline, a scalloped-cloud band edge, a "one purchased = one donated" seal.
- **Shape & density:** **Generously rounded** — soft-radius image tiles and cards (~12–16px), fully-rounded pill CTAs and swatch dots. Comfortable gutters, roomy 3-/4-up grids, big vertical breathing room around the mission and impact bands. Separation is by **ground-color shift** (cream → navy → gold → sage) far more than by borders or shadow.
- **Motion:** Restrained and friendly — product + guide-strip carousels with prev/next arrows and a "1 / 6" pager, hover lifts on tiles, a promo pill and email capture. No autoplay video spectacle; the energy comes from color and type, not motion.

## 4. Layout anatomy (top to bottom)

- **Announcement / utility bar:** Deep-navy strip, centered white text — two stacked offers ("20% Off First Order with Code COMFORT20" / "Free Standard Shipping on Orders $75+") with a country selector at the right.
- **Header / nav:** Cream, three-zone. **Left:** `BOMBAS` heavy wordmark. **Center:** primary nav — `Women` · `Men` · `Kids` · `Sport` · `Thank You` · `Help`. **Right:** `Log In`, search, bag. Sticky.
- **Hero:** A **4-up color-block category tile strip** sits _above_ the hero (Bralettes & Underwear / Socks / Slippers & Shoes / T-Shirts — each a full-bleed product photo on a saturated ground with a white label). Then the **full-bleed lifestyle hero**: a warm-tan group shot, a heavy all-caps overlay headline ("COMPRESSION MADE FOR EVERY MOMENT"), and **two black-pill CTAs** ("Shop Women" / "Shop Men").
- **Homepage section sequence:**
  1. **Category tile strip** — 4 color-block photo tiles (Underwear / Socks / Slippers & Shoes / T-Shirts), white label centered on each.
  2. **Lifestyle hero** — full-bleed photo + heavy caps headline + dual CTA.
  3. **Use-case tiles** — 4 color-block tiles (Casual / Compression / Sport / Dress) routing into filtered collections.
  4. **Mission headline band** — huge heavy black "ONE PURCHASED = ONE DONATED" on cream + "We donate on your behalf in all 50 states." (no button; the brand's thesis, stated once, big).
  5. **Featured collection card + carousel** — a lead promo card (NEW badge, collab lockup, "Shop The Collection") followed by 4 product cards.
  6. **Women's New Arrivals** — heading + "Shop All" / "Shop Best Sellers" pills + 4 product cards.
  7. **Men's New Arrivals** — same pattern.
  8. **Sock-height guide strip** — 6 labelled photo tiles (No Show / Ankle / Quarter / Half Calf / Calf / Knee High), an educational anatomy row.
  9. **Impact band** — marigold ground, "200 MILLION+ DONATIONS / You Did Good… Real Good" inside a **cream scalloped-cloud shape**, a give-back seal + supporting copy + "See Your Impact" CTA.
  10. **"Comfort Beyond Socks"** — sage ground, heading with a **hand-drawn coral squiggle underline**, a 3-up of terracotta-ground category tiles (Slippers & Shoes / Underwear / Tees).
  11. **Newsletter band** — navy ground, "Enter your email for 20% off your first order…", email input + "Sign Up" + social icons.
- **PDP anatomy:** Two-column. **Left buy-box:** breadcrumb ("Women's / Socks / Ankle"), heavy title, price + strikethrough + "10% Pack Savings", a **pack-size segmented control** (Single / 4-Pack / 8-Pack / 12-Pack), **named swatch groups** ("Limited: Forest Mauve Mix" + "Core:") with round swatch chips, cross-design links ("Explore Other Designs: Heathered, Classic Patterns"), **Size** with S/M/L pills (US ranges) + Size Guide link, a full-width navy **Add to Bag**, a **"4 Purchased = 4 Donated"** giveback microline directly under it, then Free-Shipping and Reviews (4.8 ★, 67,665) accordions. **Right:** large image gallery with a "1 / 6" arrow pager. **Below fold:** a "BLISTERS BE GONE" benefit feature band → a "ONE PURCHASED = ONE DONATED" giveback band → recommendations → full reviews.
- **Collection / PLP:** A top **education strip** (sock-height types, each with a one-line description + carousel arrow) precedes the grid. Left **facet sidebar** — Category / Collection / Size checkbox groups. Header row: "410 Items" count + "Sort: Featured" dropdown. Main **3-up product grid** — light-grey tile, swatch dots + "+N", name, price + strike + pack-savings, "Women · Midweight" meta.
- **Footer:** Cream. A "100% HAPPINESS GUARANTEED" reassurance block ("…just a reason to smile. Reach out.") + Get Help pill, then "More Info" + "Shopping" link columns, a **Certified B Corporation** badge with "Learn More", and a legal / privacy bar.

## 5. Signature interaction patterns

1. **Saturated color bands as pacing** — a calm cream page deliberately broken by fully-colored bands (navy → marigold → sage → terracotta tiles), each a different mood, so the giveback story and the catalogue alternate like picture-book spreads. This is the core of the aesthetic and the thing to reproduce.
2. **The giveback thread, stated once big then everywhere small** — a full-width "ONE PURCHASED = ONE DONATED" headline, a marigold "200 MILLION+ DONATIONS" impact band with a scalloped-cloud shape + "See Your Impact", and the same pledge scaled down to a **per-order buy-box microline** ("4 Purchased = 4 Donated").
3. **Craft flourishes** — a hand-drawn coral **squiggle underline** under a section heading and a **scalloped-cloud** band edge: small illustrated moments that signal "made by humans, for good," not a generic SaaS grid.
4. **Merchandising-rich buy-box** — a **pack-size segmented control** (Single/4/8/12 with live "Pack Savings"), **named swatch groups** ("Limited" vs "Core") rather than one flat swatch row, and cross-design links — a buy-box that sells bundles and variety, not just one SKU.

## 6. The sparx translation

- **Theme:** **bespoke bright-primary — `romp`** (closest shipped presets: `petal` and `signal`). A **paper-ground** theme in the Bombas sense — a warm-cream page whose energy comes from _bands_, with a **bright marigold primary carrying dark ink** (like `petal`'s pale-rose primary and `workshop`'s hi-vis amber — the rare bright control this library reserves for one joyful theme).
  - **Grounds (4 surfaces, light):** `base-100` page = warm cream `oklch(97% 0.02 85)` (≈ `#FDFCF6`); `base-200` muted tile = `oklch(94% 0.02 85)` (≈ `#F1F1EE`); `base-300` line/inset = `oklch(88% 0.03 82)`; **`ink` inverse/chrome ground = deep navy `oklch(33% 0.06 258)`** (≈ `#223859` — carried as a `surface="dark"` island for the announcement bar, newsletter band, and footer so white ink + outline buttons resolve).
  - **Primary strategy: bright.** `primary` = **marigold gold** `oklch(80% 0.15 85)` (≈ `#E8BA4C`) with **dark ink content** `oklch(25% 0.02 85)`. This is the joyful giveback-energy action color; dark-on-gold clears AA comfortably for buttons and headings.
  - **Secondary = deep navy** `oklch(38% 0.06 258)` (≈ `#223859`) with white content — the chrome/footer/newsletter dark islands and any "serious" action (Add to Cart can ride secondary navy to mirror the reference, or primary marigold for maximum brightness — bundle sets Add-to-Cart to **secondary navy** to match Bombas exactly while the brand identity stays marigold).
  - **Accent = sage/leaf green** `oklch(80% 0.07 140)` (≈ `#B2C691`) with dark ink — the "comfort" band + fresh give-back signals.
  - **A fourth joyful band color — terracotta** `oklch(58% 0.12 40)` (≈ `#B95E39`) — appears as a **category-tile ground** (a decorative color-block, tenant freedom), not a token role.
  - **neutral** = warm charcoal `oklch(24% 0.02 85)` (chassis, ink, black-pill CTAs). Status roles use the library defaults.
  - **Shape:** generously round — `selector: 2rem`, `field: 0.75rem`, `box: 1rem`, `depth: 1` (soft lifts allowed on this tenant surface).
  - **Fonts:** `head` = **Syne** (a heavy, quirky, playful geometric display — the chunky-caps mission voice); `body` = **Nunito** (rounded, warm, friendly). Both are real `FACE` tokens; the pairing lands the bold-but-friendly feel without a bespoke font load.
  - **AA:** dark-ink-on-marigold, dark-ink-on-sage (headings/large), white-on-navy, and charcoal-on-cream body all clear WCAG AA; terracotta tiles carry white labels only at display size (as in the reference).
- **Section mapping:**

  | Bombas homepage band                            | sparx catalog key                                             |
  | ----------------------------------------------- | ------------------------------------------------------------- |
  | Navy announcement bar                           | `notice_banner`                                               |
  | Header nav + footer                             | `sparx_layout` (silica frame navbar/footer)                   |
  | 4-up color-block category tiles                 | `category_tiles` _(color-block variant — see §7)_             |
  | Full-bleed lifestyle hero + dual CTA            | `offer_hero`                                                  |
  | Use-case tiles (Casual/Compression/Sport/Dress) | `gallery_grid`                                                |
  | "ONE PURCHASED = ONE DONATED" mission headline  | `callout`                                                     |
  | Featured-collection card + product carousel     | `product_carousel` _(featured lead-card variant — §7)_        |
  | Women's New Arrivals carousel                   | `product_carousel`                                            |
  | Men's New Arrivals carousel                     | `product_carousel`                                            |
  | Sock-height guide strip                         | `gallery_strip`                                               |
  | "200 MILLION+ DONATIONS" impact band            | `numbers_band` _(scalloped-shape / tinted-band variant — §7)_ |
  | "Comfort Beyond Socks" 3-up                     | `category_tiles` _(3-up, sage-tinted band — §7)_              |
  | Newsletter (navy)                               | `newsletter_signup`                                           |
  | "100% Happiness Guaranteed" block               | `reassurance_row`                                             |
  | B-Corp badge + legal                            | `sparx_layout` footer + `trust_row`                           |

  **PDP:** buy-box → `buy_box` _(pack-size segmented + named-swatch-group + giveback-microline variant — §7)_; gallery → `products`; "Blisters be gone" benefit band → `feature_list_sparx`; giveback band → `callout`; recommendations → `product_carousel`; reviews → `review_summary`.
  **PLP:** education strip → `spec_list`; header + count + sort → `collection_header`; faceted grid → `products`.

- **Example business:** **Rally** — a playful pet-supplies brand ("Comfort worth wagging for") whose pledge is **"1 bought = 1 donated"**: every order funds a meal and a warm bed for a shelter animal, with a running "shelter donations" counter. Broad pet vertical (dogs + cats), not one niche.
  - **Commerce catalog (~12 SKUs)** so the bound grids + swatch groups + pack sizes render: (1) Orthopedic Bolster Dog Bed — 4 colors; (2) Calming Donut Cat Bed — 3 colors; (3) Everyday Webbing Collar 3-Pack; (4) No-Pull Adjustable Harness — 5 colors; (5) Stainless Slow-Feed Bowl; (6) Cozy Fleece Pet Blanket — 4 colors; (7) Rope Tug Toy 3-Pack; (8) Catnip Kicker Toy 2-Pack; (9) Grain-Free Training Treats; (10) Reflective Lead — 5 colors; (11) Travel Bottle + Fold Bowl; (12) Ceramic Bowl Set (2). Pack-size options (Single / 2-Pack / 3-Pack) + named swatch groups ("Seasonal" vs "Everyday") where relevant, so the buy-box variants have data. **Collections:** New Arrivals, Beds & Blankets, Collars & Leads, Bowls & Feeding, Toys, Treats, Best Sellers, Giveback.
  - **CMS journal — "Rally Journal"** (`cms.blog_post` records to fill the editorial/guide bands): "How your order feeds a shelter", "Choosing the right bed size for your dog", "5 enrichment toys for an anxious pet", "We hit 500,000 shelter donations", "Meet our shelter partners", "Adoption stories from the Rally pack".
- **Design freedom used (tenant-only affordances):** **fully-saturated color band grounds** (navy / marigold / sage / terracotta) alternating down the page; **soft shadows / lifts** on tiles and cards; **decorative illustration** — the hand-drawn squiggle underline and the **scalloped-cloud band edge**; full-bleed lifestyle imagery; heavy display type; generous rounding. All are permitted on a tenant site (forbidden on a sparx-owned surface).
- **Deliberate departures:** vertical swapped comfort-apparel → **pet supplies**; giveback swapped socks-to-people → **meal + bed to a shelter animal**; our own imagery and the `Rally` wordmark — no Bombas name, bee mark, `bombasFont`, "Bombas" copy, or B-Corp claim (the reassurance block stays a generic happiness-guarantee, not a certified-badge claim we can't make); "COMFORT20" and specific donation totals are replaced with the example business's own figures.

## 7. Build notes / catalog gaps

Catalog _variants/additions_ (propagate once, never per-bundle inlines):

- **Tinted band grounds** — a `band tone` affordance so a section can take a `primary` / `secondary` / `accent` **soft-fill background** (marigold / navy / sage) instead of only `base-*` / `dark`. This is the single most important addition — the whole aesthetic is colored bands.
- **`numbers_band` scalloped / decorative-shape variant** — an optional playful band edge (the cream scalloped-cloud) plus a give-back seal slot; a stat band that reads as celebratory, not corporate.
- **`category_tiles` color-block variant** — per-tile saturated background color (terracotta / teal / rust) behind a full-bleed product photo with a centered white label; supports 3-up and 4-up.
- **`buy_box` merchandising variant** — (a) a **pack-size segmented control** with live "Pack Savings", (b) **named swatch groups** ("Seasonal" / "Everyday") rather than one flat swatch row, and (c) a **giveback microline** bound under Add-to-Cart ("N bought = N donated") — a small bindable component, not a hardcoded string.
- **`product_carousel` featured lead-card variant** — a promotional collection card (badge + lockup + "Shop The Collection") sitting first in the carousel.
- **Hand-drawn header flourish** — an optional squiggle/underline decorative accent under a `SectionHeader`, as a theme-level ornament (illustration asset), so the playful voice is a toggle rather than a one-off image.
