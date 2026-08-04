# Gymshark — design study → `sparx-bold-athletic`

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-04
**Reference:** Gymshark — https://www.gymshark.com (captured 2026-08-04, default 1280px viewport, real Chrome)
**Archetype:** Bold athletic DTC — dark cinematic video heroes, high-energy lifestyle/editorial imagery, monochrome chrome, aggressive drop culture, dense 4-up product grids.
**sparx slug:** `bold-athletic` · **Example vertical:** endurance / road-cycling kit · **Theme:** bespoke dark — `velodrome` (see §6; closest preset `stage`/`signal`)

> Faithfulness bar: **closest clone allowed** — mimic structure AND aesthetic feel,
> sparx components + branding only, no trademarked assets. See [README](../README.md).

## 1. Why this reference

Gymshark is the defining bold-athletic DTC storefront: a fitness-apparel brand built on Instagram drop culture that turned its homepage into a hype engine. It earns its place in our set as the **dark-cinematic / drop-culture anchor** — full-bleed muted-autoplay video hero, a strictly monochrome black-and-white chrome that lets the _product photography_ carry all the color, and an aggressive uppercase condensed display face that reads like race branding. The homepage is a relentless funnel of drops → carousels → category tiles → editorial, each band engineered to move a visitor into a collection. It is the cleanest study of how a near-zero-radius, edge-to-edge, image-first layout feels athletic rather than austere.

## 2. Screenshots

Captured to `./images/`.

- `home-fold.png` — Hero fold: dark full-bleed autoplay video (athlete), reversed centered `GYMSHARK` wordmark, "DEVANT JUST DROPPED" overlay with dual CTAs, mute/pause controls.
- `home-full.png` — Full homepage scroll: hero → drop carousel → editorial picture band → second carousel → category tiles → editorial grid → guides grid → SEO prose → footer.
- `nav.png` — Header strip: light auto-rotating announcement bar over a dark navbar (Women/Men/Accessories left, centered wordmark, search/wishlist/account/cart right).
- `pdp.png` — Product detail fold: 2-up image gallery with vertical scrubber + "789 people viewed this today" urgency pill, sticky buy-box (title, fit, price, rating, 7 colorways, size grid).
- `pdp-full.png` — Full PDP: gallery + buy-box → Designed-For tabs → "Get the look" bundle → lifestyle band → "You might like too" grid → "We recommend" carousel → reviews with rating snapshot.
- `plp.png` — Collection listing: "MENS / ALL PRODUCTS / 718 Products", left Filter & Sort sidebar, "Top 10 in category" ranked carousel, 4-up product grid.
- `footer.png` — Footer: Help / My Account / Pages link columns + "More about Gymshark" promo cards, payment + social icons, legal bar, country/language selector.
- `home-category-tiles.png` — Signature: "FAVORITES" category tiles (Leggings / Sports Bras / Shorts / T-shirts & Tops) with a Women/Men segment toggle, over the "POPULAR RIGHT NOW" tabbed band.
- `home-editorial-band.png` — Signature: editorial image-card band ("Popular right now") — titled lifestyle cards linking into collections.

Mega-nav panel could not be triggered headlessly (it is a click-to-open tabbed flyout keyed to `panel-men`/`panel-women`; the desktop tab did not resolve to a hover target). Documented from the DOM below.

## 3. Design language

- **Palette:** Ruthlessly **monochrome chrome** — near-black `#0B0B0C` (hero, navbar, footer, CTA fills, "NEW" tags), pure white `#FFFFFF` content surfaces, a warm beige-grey product-tile ground `#EFEDE8`/`#EAE8E3`, hairline `#E4E3DF`, black ink `#111`. The announcement bar is a light warm grey (`~#F1F0ED`) with dark text. **There is essentially no brand accent color** — all chroma comes from the _product photography_ (the pink/orange "Lift Seamless" editorial band is the loudest color on the page). Mood: cinematic, high-contrast, athletic, expensive-minimal.
- **Typography:** Display is a **heavy uppercase condensed grotesque** (Gymshark's bespoke face), very tight tracking, all-caps for every hero and section header ("DEVANT JUST DROPPED", "ALL PRODUCTS", "FAVORITES"). Body/labels are a clean neutral sans, sentence case, regular weight, small. The caps-condensed-vs-clean-sans contrast _is_ the athletic voice. Prices and product meta are small, unemphatic.
- **Imagery:** Two registers — (1) **cinematic dark video** for the hero (muted autoplay, moody, body-focused); (2) **studio product + lifestyle** on seamless neutral grey/beige backdrops for tiles and cards, plus high-energy on-model editorial for the picture bands. Crops are full-bleed, edge-to-edge, tall portrait for tiles.
- **Shape & density:** **Near-zero radius** everywhere — product cards, images, and CTAs are square/rectangular; only the segment/tab pills and the urgency chip are fully rounded. Minimal borders (imagery does the separating), tight gutters, **dense 4-up product grids**. No drop shadows on the chrome; separation is by ground shifts and full-bleed edges. Generous vertical space around section headers.
- **Motion:** Autoplay muted hero video with pause + mute controls; auto-rotating (pausable) announcement bar; product + "Top 10" carousels with prev/next arrows; segment toggles (Women/Men) and tab filters (Guides/Trending/Training/Apps) that swap the band's bound content in place; live urgency pill ("789 people viewed this today"); hover image-swap on product cards.

## 4. Layout anatomy (top to bottom)

- **Announcement / utility bar:** Light warm-grey strip, centered dark text, **auto-rotating** through offers ("Free standard shipping on orders over $75" → "Get $10 off when you refer a friend" → "Students get an extra 20% off") with a pause control at the right edge.
- **Header / nav:** Dark, reversed over the hero, effectively three-zone. **Left:** primary nav — `Women` · `Men` · `Accessories` (each a click-to-open **tabbed mega-flyout**, `panel-men`/`panel-women`). **Center:** `GYMSHARK` wordmark. **Right:** search, wishlist (heart), account, cart (bag) icons. Sticky.
- **Hero:** **Full-bleed muted autoplay video**, dark cinematic. Overlay content pinned bottom-left: condensed uppercase headline ("DEVANT JUST DROPPED"), a two-line paragraph, and **two CTAs** — a solid white "Shop Devant" + an outline "Shop new in". Mute + pause controls bottom-right.
- **Homepage section sequence:**
  1. **Drop product carousel** — "DEVANT JUST DROPPED" header + "View All" link + prev/next arrows; 4 visible product cards (wishlist heart, "NEW" tag, name, fit, colorway, price, some ratings).
  2. **Editorial picture band** — "NEW IN: LIFT SEAMLESS 2.0"; full-width on-model lifestyle image, bottom-left overlay text + two CTAs ("Shop new in" / "Shop the collection").
  3. **Second product carousel** — "NEW IN: LIFT SEAMLESS 2.0"; 4 cards ("NEW & IMPROVED"/"NEW" tags, ratings, price).
  4. **Category tiles** — "FAVORITES" with a **Women/Men segment toggle**; 4 full-bleed model tiles (Leggings, Sports Bras, Shorts, T-shirts & Tops), label under each.
  5. **Editorial image grid** — "POPULAR RIGHT NOW" with Women/Men toggle; 4 titled lifestyle cards each with a heading + short description (Summer Bestsellers, For Every Run, Get 'Em In Pink, Everyday Seamless Restock) linking into collections.
  6. **Guides grid** — "WAIT THERE'S MORE…" with **tab filters** (Guides / Trending / Training / Apps); 4 editorial cards (Leggings Guide, Sports Bra Guide, Men's Shorts Guide, Running Hub), followed by **link columns** (Women's Leggings / Women's Gymwear / Men's Gymwear / Accessories).
  7. **SEO prose stack** — four heading+paragraph blocks ("WORKOUT CLOTHES & GYM CLOTHES", "GYM CLOTHES BUILT IN THE WEIGHT ROOM", "ACTIVEWEAR & ATHLEISURE", "MORE THAN YOUR BEST WORKOUT CLOTHING") with bold in-copy keyword links.
- **PDP anatomy:** Two-column. **Left:** image gallery — a 2-up grid of large images with a **vertical thumbnail scrubber** on the far left, prev/next chevrons, and a rounded **"789 people viewed this today"** urgency pill. **Right (sticky buy-box):** "NEW" tag, uppercase title, fit ("Oversized Fit"), price, rating stars + count + wishlist + share, short description + "Learn more", **7 color swatches** with selected name ("Heavy Blue"), "Select a size" + Size Guide link, XS–3XL size pills, full-width black **ADD TO BAG**, Klarna/Afterpay pay-in-4, benefits list (rewards, free delivery over $75, express delivery), a **"GET THE LOOK" 2-product bundle**, and a Delivery & Returns accordion. **Below the fold:** Designed-For / Description tabs with big copy + lifestyle image → "GET THE LOOK" → full-bleed collection band → **"YOU MIGHT LIKE TOO"** 4-up×2 grid → **"WE RECOMMEND"** carousel → **REVIEWS** (4.1★, 107 reviews, "83% would recommend", rating-snapshot bars, filter/search, per-review verified-buyer + fit stats, Load More).
- **Collection / PLP:** Left **Filter & Sort** sidebar (Clear All, Sort By accordion — Price low/high, high/low, Relevancy, Newest). Header: small category label ("MENS"), large uppercase title ("ALL PRODUCTS"), count ("718 Products"), one-line intro. A ranked **"TOP 10 IN CATEGORY"** carousel (numbered 1–5 badges) precedes the main **4-up product grid** (image, "NEW" tag, name, price, wishlist heart).
- **Footer:** Preceded by the SEO prose. Three link columns (HELP / MY ACCOUNT / PAGES) + a "MORE ABOUT GYMSHARK" trio of promo cards (Blog, Students 20% off, Email sign up). Then payment-method icons, a social-icon row, a legal bar (© / Terms / Privacy / Cookie / Modern Slavery), and a country + language selector.

## 5. Signature interaction patterns

1. **Full-bleed muted-autoplay video hero** with bottom-left overlay copy and dual CTA + user-facing pause/mute — the cinematic drop announcement.
2. **Drop merchandising rhythm:** an editorial picture band immediately followed by a shoppable product carousel of the same drop ("View All" + arrows) — repeated per collection.
3. **In-place bound toggles/tabs** that reslice a band without navigation: Women/Men segment toggles on category tiles + editorial grid; Guides/Trending/Training/Apps tabs on the guides band.
4. **Urgency + ranking devices:** live "N people viewed this today" pill on the PDP, and a numbered **"Top 10 in category"** ranked carousel on the PLP.

## 6. The sparx translation

- **Theme:** **bespoke dark — `velodrome`** (closest shipped presets: `stage`/`signal` from studios). It is a **dark-ground** theme in the Gymshark sense — dark _chrome_ (nav, hero, footer, CTA beats) alternating with white/beige _content_ bands, not an all-dark page.
  - **Grounds (4 surfaces):** `base-100` page = `#FFFFFF`; `base-200` muted = `#EFEDE8` (warm beige product/announcement ground); `base-300` line/inset = `#E4E3DF`; **`ink` chrome ground = `#0B0B0C`** (hero/nav/footer/CTA — carried as a `surface="dark"` island so ink + outline buttons resolve).
  - **Primary strategy:** **mono** — the primary action is a near-black `#0B0B0C` fill on light (white text) and inverts to a white fill on the dark island. This mirrors Gymshark's monochrome chrome exactly.
  - **Accent (single, disciplined):** a **hi-vis race accent** `#D8FF3E` (chartreuse) — authentic to endurance-cycling visibility culture and our one departure from Gymshark's pure mono. Used only as a _signal_: drop/"NEW" tag, live-urgency pill, sale price, active toggle. Text on it is black (AA-safe); on black it is used at ≥ large sizes only. All body copy stays black-on-white / white-on-near-black (AA clears comfortably).
  - **Fonts:** display = a heavy **uppercase condensed grotesque** (tight tracking, caps section headers); body = a clean neutral sans, sentence case. (Geist is the sparx-surface default; a tenant site may load a condensed display face — that is tenant freedom.)
- **Section mapping:**

  | Gymshark homepage band                        | sparx catalog key                                |
  | --------------------------------------------- | ------------------------------------------------ |
  | Auto-rotating announcement bar                | `notice_banner`                                  |
  | Header / mega-nav + footer                    | `sparx_layout` (silica frame navbar/footer)      |
  | Full-bleed video hero + dual CTA              | `offer_hero` _(video variant — see §7)_          |
  | "Just dropped" product carousel               | `product_carousel`                               |
  | "Lift Seamless" editorial picture band        | `picture_band`                                   |
  | Second product carousel                       | `product_carousel`                               |
  | "Favorites" category tiles + Women/Men toggle | `category_tiles` _(segment-toggle variant — §7)_ |
  | "Popular right now" titled editorial cards    | `gallery_grid`                                   |
  | "Wait there's more" guides grid + tabs        | `resource_grid` _(tab-filter variant — §7)_      |
  | Guides link columns                           | `onward_links`                                   |
  | SEO prose stack                               | `prose_section` ×4 (or `two_column_prose`)       |
  | Footer promo trio + email sign-up             | `newsletter_signup` + `onward_links`             |

  **PDP:** buy-box → `buy_box`; gallery → `products`/gallery; "Get the look" → `bundle_offer`; collection band → `picture_band`; "You might like"/"We recommend" → `product_carousel`; reviews → `review_summary`.
  **PLP:** header + count + intro → `collection_header`; ranked band → `product_carousel` _(ranked variant — §7)_; grid + filters → `products`.

- **Example business:** **Threshold** — an endurance & road-cycling kit label ("Kit built for the long road"). Commerce catalog seeds ~24 SKUs across bib shorts, thermal & summer jerseys, gilets/vests, base layers, rain shells, socks, and caps, in 5–7 colorways each (so the swatch row + size grid render) with fit tags ("Race Fit" / "Endurance Fit"). CMS `blog_post` records seed a "**Threshold Journal**" (the Gymshark-Central analog) — training, nutrition, and long-ride stories — to fill the guides/editorial bands. Collections: New In, Bib Shorts, Jerseys, Cold Weather, Accessories.
- **Design freedom used (tenant-only affordances):** full-bleed **muted autoplay video** hero; **alternating dark/light bands**; near-zero radius; **hover image-swap** on product cards; live **urgency pill**; **auto-rotating announcement**; edge-to-edge full-bleed imagery. All are permitted on a tenant site (they would be forbidden on a sparx-owned surface) — no shadows are needed; separation is by ground shifts + edges, matching the reference.
- **Deliberate departures:** vertical swapped gym-apparel → **endurance cycling**; no Gymshark wordmark, photography, or "Devant/Lift Seamless" naming; we add **one hi-vis accent** where Gymshark is pure mono (justified by cycling visibility culture) but hold it to signal-only; reviews/urgency copy is generic, not scraped.

## 7. Build notes / catalog gaps

These are catalog _variants/additions_ (propagate once, never per-bundle inlines):

- **`offer_hero` video variant** — a full-bleed muted-autoplay background video with bottom-anchored overlay copy + dual CTA and pause/mute controls. If `offer_hero` is image-only today, add a `media: image | video` slot.
- **`category_tiles` / `gallery_grid` segment-toggle** — a Women/Men-style bound toggle that swaps which collection each tile/card resolves to, in place.
- **`resource_grid` tab-filter** — Guides/Trending/Training/Apps-style tabs that reslice the card set, plus a trailing `onward_links` link-column block.
- **`product_carousel` ranked variant** — numbered 1–N rank badges for a "Top N in category" merchandising row.
- **Live social-proof / urgency micro-chip** on `buy_box` ("N viewed today" / low-stock) — a small bindable component, not a hardcoded string.
- **`bundle_offer` "get the look" on PDP** — a multi-product outfit bundle rendered inside/after the buy-box.
