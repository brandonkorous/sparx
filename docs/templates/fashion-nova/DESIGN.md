# Fashion Nova — design study → `sparx-catalog-dense`

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-04
**Reference:** Fashion Nova — https://www.fashionnova.com (captured 2026-08-04, default 1280px viewport, real Chromium)
**Archetype:** Dense fast-fashion catalog — black-and-white chrome, relentless red sale/urgency signalling, countdown promo bands, an enormous mega-nav taxonomy, and endless high-column product grids with sale badges, comp-value strikethroughs, ratings/low-stock flags and quick-add.
**sparx slug:** `catalog-dense` · **Example vertical:** broad everyday-apparel shop · **Theme:** bespoke bright — `voltage` (see §6; closest presets `petal`/`boutique`, both too soft)

> Faithfulness bar: **closest clone allowed** — mimic structure AND aesthetic feel,
> sparx components + branding only, no trademarked assets. See [README](../README.md).

## 1. Why this reference

Fashion Nova is the defining **dense fast-fashion catalog** — a high-volume everyday-fashion machine whose entire storefront is engineered around discount urgency and near-infinite product density. It anchors the **opposite pole** from the SKIMS/Kith minimalism in our set: where those pages breathe, this one is packed — a black announcement bar with a live countdown, candy-bright collection promo bands, a mega-nav that fans out to ~40 sub-categories per top level, and a homepage that dead-ends into a **4-to-5-up "shop the latest" grid** that never stops. Its chrome is ruthlessly black-and-white so the **red sale signal** ("30% OFF", crossed-out comp values, "going fast" flags) carries every merchandising decision. It is the cleanest study of how volume, discount pressure, and tap-density read as _energy_ rather than clutter — and of the exact commerce affordances (comp-value strikethrough, pay-in-4, per-size stock flags, delivery countdown, sticky add-to-bag) a real bargain catalog needs.

## 2. Screenshots

Captured to `./images/`.

- `home-fold.png` — Hero fold: black announcement bar with **live countdown** ("FREE 1-DAY SHIPPING… 06h:09m:30s · Shop Now"), black-on-white logo + huge top-nav (WOMEN / PLUS+CURVE / MEN / SPORT / KIDS) over a category sub-bar, a **black promo strip** ("TODAY ONLY! 50% OFF ALL SWIM · SHOP NOW"), and a full-bleed lifestyle hero ("MADE FOR THE HEAT · 30% | 40% | 50% OFF EVERYTHING").
- `home-full.png` — Full homepage scroll: announcement → promo strip → hero → thin red promo → "THE TREND REPORT" editorial cards → "50% OFF COLLECTION" picture band → "GOLDEN HOUR" picture band → "SHOP BY BRAND" tiles → "40% OFF COLLECTION" picture band → "SHOP BY CATEGORY" tiles → "60-80% OFF SALE" band → **"SHOP THE LATEST" dense tab-filtered product grid** → footer.
- `nav.png` — Mega-nav flyout for CLOTHING: four-column panel — **ALL CLOTHING** (Tops, Matching Sets, Dresses, Bottoms, Jeans, Jumpsuits, Rompers, Skirts, Graphics + Swimwear, Shorts, Loungewear, Matching Separates, Jackets, Sweaters, Scrubs, Gift Bags), **SHOP BY OCCASION** (Summer / Euro Summer / Vacation / Going Out / Office / Concert / Date Night / Everyday), **SHOP BY TREND** (Golden Hour Guest, Bonita, Premium Modal, The Night Out Edit, Leo Energy Only, Clean Girl Aesthetic, Summer Essentials, BodyCTRL, Y2K, NFL & NBA), plus a "Shop All Clothing" rail.
- `pdp.png` — Product detail fold: breadcrumb, left thumbnail column + large image with **red "30% OFF" badge**, right buy-box (title, **`$30.99` sale price + `$44.99` "Comp. Value" strikethrough**, **"or 4 payments of $7.75 with Zip/Afterpay/Klarna"**, red "30% Off Collection! Prices as Marked", Color: Black, size pills with **low-stock ⚡ and back-in-stock 🔔 flags**, black full-width "Add to Bag" + wishlist heart, delivery countdown "Get it by TOMORROW · Order within 6 hrs 7 mins", Product Details / Material accordions, sticky vertical "GET 30% OFF!" tab).
- `pdp-full.png` — Full PDP: gallery + buy-box → **"STYLE IT WITH"** single-suggestion bundle ("See 20+ Similar Styles · Shop Now") → **"YOU MIGHT ALSO LIKE"** endless 4-up recommendation grid (dozens of cards, each with red badge + sale price + swatches) → sticky bottom add-to-bag bar → footer.
- `plp.png` — Collection listing ("WOMEN'S DRESSES"): left **REFINE BY** rail (search-within, Size XXS–XL + VIEW MORE, **Colors swatch grid**), a **sub-category tile row** (Summer / Vacation / Going Out / Office / Cocktail / Formal / Luxe), breadcrumb + count **"7,613 products"**, **SORT BY FEATURED** dropdown, **SHOW 60 | 120**, a **3/4/5-up column-density toggle**, and the dense grid with **red "30% OFF"** badges.
- `plp-full.png` — Full collection scroll: the same rail against a long 4-up grid — every card carries a sale badge, sale price + "Comp. Value" strikethrough, "30% Off Collection! Prices as Marked", color-swatch dots and a wishlist heart.
- `footer.png` — Footer: "SHOP FASTER WITH THE APP" (App Store / Google Play), Help / Company / Quick Links columns, "SIGN UP FOR DISCOUNTS + UPDATES" phone-or-email capture with SMS consent copy, social row (Instagram/TikTok/YouTube/Snapchat/Facebook/Pinterest), sticky bottom add-to-bag.

The signature **promo/urgency band** (black strip + live countdown) is captured in `home-fold.png`/`home-full.png`; the **category-tile density** (both the homepage "SHOP BY CATEGORY" row and the PLP sub-category tiles) is captured in `home-full.png` and `plp.png`. A "Spin to Win / Match 3" discount pop-up (a gamified email/SMS gate) interrupts the first session — dismissed via "Decline Offer" for the clean captures.

## 3. Design language

- **Palette:** Ruthlessly **black-and-white chrome** carrying a **loud red sale signal**. Near-black `#0A0A0A` (announcement bar, promo strips, footer, "Add to Bag", buy-box CTA); pure white `#FFFFFF` content surface; a light warm-grey product ground `~#F5F5F5`; hairline `#E5E5E5`; black ink `#111`. The one working accent is a **hot sale red** — badge fills and urgency at `~#E4002B`, sale prices / "% off" / "Prices as Marked" text at a darker AA-safe `~#C8102E`. Beyond the chrome, the collection **promo bands are candy-bright** — turquoise, hot pink, terracotta full-bleed grounds pulled from each collection's hero art (loud, seasonal, editorial). Mood: high-energy, discount-forward, maximalist, "everything must go."
- **Typography:** A **heavy condensed/bold sans** for promo headlines and section headers, mostly **UPPERCASE** ("TODAY ONLY! 50% OFF ALL SWIM", "THE TREND REPORT", "SHOP BY CATEGORY", "WOMEN'S DRESSES") with tight tracking; a clean neutral sans, sentence case, small, for product names, prices, filters and body. The bold-caps-header / small-clean-meta contrast _is_ the catalog voice. Prices are prominent; comp values are struck-through and greyed; the red "% off" numerals shout.
- **Imagery:** On-model **studio + lifestyle** everywhere — full-bleed portrait crops for hero and promo bands, seamless light-grey studio shots for product cards (consistent white/grey backdrop so the grid reads as one dense sheet). No illustration; photography and the red badges do all the work. Cards use tall portrait aspect and **hover image-swap** (front/back on-model shots).
- **Shape & density:** **Low radius** — cards and images near-square, CTAs slightly rounded, badges/pills fully rounded, swatch dots circular. Minimal borders (the grid separates by gutters, not lines). **Very high density** — homepage ends in a 4-up grid, PLP offers **3/4/5-up** via a user column toggle, PDP recommendations run 4-up for dozens of rows. Tight gutters, generous only around section headers. No decorative shadows on chrome; sticky bars and the vertical "GET 30% OFF!" tab pin to the viewport.
- **Motion:** Live **countdown timers** (announcement + PDP "order within N"); auto-advancing announcement/promo carousel with prev/next chevrons; **hover image-swap** on cards; a persistent sticky add-to-bag bar that reveals on scroll; the vertical discount-tab that launches the "Spin to Win" gate; quick-add / wishlist micro-interactions on card hover.

## 4. Layout anatomy (top to bottom)

- **Announcement / utility bar:** Full-width **black** strip, centered white text, **auto-rotating** offers ("FREE 1-DAY SHIPPING! On Orders Over $100!" / "Spend $75 or more to unlock FREE SHIPPING!") with a **live countdown timer** and a "Shop Now" link; prev/next chevrons at the edges.
- **Header / nav:** White, sticky. **Left:** black-on-white `FASHIONNOVA` wordmark. **Center-left:** top-level tabs — `WOMEN` · `PLUS+CURVE` · `MEN` · `SPORT` (with a red "NEW" flag) · `KIDS`, each opening a **four-column mega-flyout**. **Center:** a wide search field ("Search within Women's Clothing") with a visual-search camera icon. **Right:** country selector (US), recently-viewed, account, wishlist (heart), cart (bag). **Below:** a horizontally-scrolling **category sub-bar** (New In · Clothing · Novadeals · Swimwear · Dresses · Matching Sets · Tops · Graphics · Jeans · Jumpsuits & Rompers · Shoes · Formal Shop · Bottoms · Accessories · Lingerie & Sleep · Jackets & Sweaters · Sale · Nova Luxe · Sport) with an overflow chevron.
- **Hero:** **Full-bleed lifestyle image**, on-model group shot, with a centered discount overlay ("MADE FOR THE HEAT · 30% | 40% | 50% OFF EVERYTHING · SHOP NOW"). Immediately preceded by a **black promo strip** ("TODAY ONLY! 50% OFF ALL SWIM · SHOP NOW ›") and followed by a **thin red promo strip** ("FREE 1-DAY SHIPPING ON ORDERS OVER $100").
- **Homepage section sequence:**
  1. **"THE TREND REPORT"** — 4 editorial lifestyle cards (Leo Energy Only, Premium Modal Collection, Clean Girl Aesthetic, The Night Out Edit) linking into trend collections.
  2. **"50% OFF COLLECTION"** — full-bleed **candy-turquoise** picture band with a centered collection CTA.
  3. **"GOLDEN HOUR"** — full-bleed editorial picture band (warm sunset lifestyle) + CTA.
  4. **"SHOP BY BRAND"** — a 4-tile brand row (Nova sub-brands — Swim, Men, Sculpt, Kids) each a labelled tile.
  5. **"40% OFF COLLECTION"** — full-bleed **hot-pink** picture band + CTA.
  6. **"SHOP BY CATEGORY"** — a category-tile row (on-model tiles with a category label under each).
  7. **"60-80% OFF SALE"** — full-bleed **terracotta** sale band + CTA.
  8. **"SHOP THE LATEST"** — the anchor: a **tab-filtered dense product grid** (tabs across the top slice the set), **4-up on desktop**, dozens of rows, each card carrying a red "% OFF" badge, sale price + comp-value strikethrough, "Prices as Marked", color swatches and a wishlist heart. This is where the homepage funnels — an endless shoppable sheet, not an editorial close.
- **PDP anatomy:** Two-column. **Left:** a vertical **thumbnail column** + one large image, a red **"30% OFF"** badge top-left. **Right (buy-box):** breadcrumb, title, **sale price + "Comp. Value" strikethrough**, **"or 4 payments of $X with Zip/Afterpay/Klarna"**, red "30% Off Collection! Prices as Marked", "No reviews yet"/rating + Share, `Color: Black` + swatch, `Size` row of pills (some flagged **⚡ low-stock** or **🔔 notify / back-in-stock**) + View Size Guide, "30-day Returns: Store Credit", full-width black **Add to Bag** + wishlist heart, a **delivery block** ("Get it by TOMORROW with 1-Day Shipping · Order within 6 hrs 7 mins" in green; "3-7 Business Days · Free shipping $75+"), and **Product Details / Material** accordions. A vertical **"GET 30% OFF!"** discount tab pins to the right edge. **Below the fold:** **"STYLE IT WITH"** (a single complete-the-look suggestion + "See 20+ Similar Styles") → **"YOU MIGHT ALSO LIKE"** endless 4-up recommendation grid → a **sticky bottom add-to-bag bar** (mini thumbnail, name, price, Add to Bag) that follows the scroll.
- **Collection / PLP:** Left **REFINE BY** rail — "search within", **Size** facet (XXS–XL + VIEW MORE), **Colors** facet as a **swatch grid** (Black/White/Brown/Yellow/Grey/Orange/Silver/Ivory/Blue/Pink/Red/Green/Purple/Gold/Nude). Header: uppercase title ("WOMEN'S DRESSES"), count ("7,613 products"). A **sub-category tile row** (Summer / Vacation / Going Out / Office / Cocktail / Formal / Luxe) sits above the grid. Controls: breadcrumb (Women › Clothing › Women's Dresses), **SORT BY FEATURED**, **SHOW 60 | 120**, and a **3/4/5-up column-density toggle**. The grid: cards with a red **"30% OFF"** pill top-left, image (hover-swap), wishlist heart top-right, name, **sale price + "Comp. Value" strikethrough**, red "30% Off Collection! Prices as Marked", and color-swatch dots.
- **Footer:** Black. "SHOP FASTER WITH THE APP" (App Store / Google Play badges), three link columns (**Help** — Help Center, Track Order, Shipping Info, Returns, Contact Us; **Company** — Careers, About, Stores, Want to Collab?; **Quick Links** — Size Guide, Sitemap, Gift Cards, Check Gift Card Balance), a **"SIGN UP FOR DISCOUNTS + UPDATES"** phone-or-email capture with SMS/marketing consent copy, a social-icon row, and a legal bar (Promo T&Cs / Privacy / Terms / CA Supply Chains Act).

## 5. Signature interaction patterns

1. **Countdown-urgency promo stack** — a black announcement bar with a live shipping/offer **countdown timer** over a black promo strip and a thin red strip, three discount messages before the hero even starts. Re-echoed on the PDP as a delivery countdown ("Order within 6 hrs 7 mins").
2. **Red sale grammar on every card** — a **red "% OFF" badge**, a **crossed-out "Comp. Value"**, a red "Prices as Marked" line and color-swatch dots, repeated across the homepage grid, PLP and PDP recommendations. The discount _is_ the merchandising.
3. **Density controls in the shopper's hands** — a **3/4/5-up column toggle** + "SHOW 60 | 120" on the PLP, a tab-filtered dense grid on the homepage, and endless 4-up recommendation grids on the PDP. The shopper dials the density up; the catalog never runs out.
4. **Commerce-heavy buy-box** — comp-value strikethrough, **pay-in-4 installments**, **per-size low-stock ⚡ / notify 🔔 flags**, a delivery-date countdown, and a **sticky mobile add-to-bag bar** — the full bargain-catalog conversion kit.
5. **Enormous mega-nav taxonomy** — each top level fans to a four-column flyout crossing category × occasion × trend (~40 links), the structural signature of a catalog this broad.

## 6. The sparx translation

- **Theme:** **bespoke bright — `voltage`** (closest shipped presets `petal`/`boutique`, both too soft/mono for this energy). A **light-ground, high-energy** theme: white/grey _content_ alternating with **near-black chrome** (announcement, promo strips, footer, CTAs, buy-box action) and **candy-bright collection bands**.
  - **Grounds (4 surfaces):** `base-100` page = `#FFFFFF`; `base-200` muted = `#F5F5F5` (light studio product ground); `base-300` line/inset = `#E5E5E5`; **`ink` chrome ground = `#0A0A0A`** (announcement / promo strips / footer / CTA — carried as a `surface="dark"` island so ink + outline controls resolve).
  - **Primary strategy:** **mono** — the primary action is a near-black `#0A0A0A` fill (white text) on light, inverting to white on the dark island. Mirrors Fashion Nova's black-and-white chrome exactly; the product photography and the red badges carry the color.
  - **Sale signal (the one loud accent):** a **hot sale red** — badge fills + urgency chips at `#E4002B` (white text, used at pill/large sizes → AA-safe); sale prices, "% off" and "prices as marked" text at a darker **`#C8102E`** (on white ≈ 5.3:1 → clears AA for small text). This is the single working accent, held to the discount/urgency job.
  - **Promo-band palette (decorative, tenant freedom):** bright full-bleed collection grounds — turquoise `#17B3A3`, hot pink `#FF2E88`, terracotta `#D2603A` — pulled from each collection's hero art. Text on them is white at display size (AA-safe at scale). These are _tenant-site_ decorative grounds (a sparx-owned surface would forbid them).
  - **Fonts:** display = a **heavy condensed/bold sans**, uppercase for promo + section headers (tight tracking); body = a clean neutral sans, sentence case, `≥16px`. (Geist is the sparx default; a tenant site may load a bold condensed display face — tenant freedom.)
- **Section mapping:**

  | Fashion Nova homepage band                                              | sparx catalog key                                |
  | ----------------------------------------------------------------------- | ------------------------------------------------ |
  | Black announcement bar + countdown                                      | `notice_banner` _(countdown variant — §7)_       |
  | Black / red promo strips                                                | `notice_banner` _(promo strip)_                  |
  | Header / mega-nav + footer                                              | `sparx_layout` (silica frame navbar/footer)      |
  | Full-bleed discount hero                                                | `offer_hero` _(image variant)_                   |
  | "The Trend Report" editorial cards                                      | `gallery_grid`                                   |
  | "50% Off" / "Golden Hour" / "40% Off" / "60-80% Off Sale" picture bands | `picture_band` ×4                                |
  | "Shop by Brand" tiles                                                   | `category_tiles` _(brand variant — §7)_          |
  | "Shop by Category" tiles                                                | `category_tiles`                                 |
  | "Shop the Latest" tab-filtered dense grid                               | `products` _(tab-filter + density variant — §7)_ |
  | Footer app + link columns + SMS/email capture                           | `onward_links` + `newsletter_signup`             |

  **PDP:** buy-box → `buy_box` _(comp-value + pay-in-4 + per-size stock flags + delivery countdown + sticky bar — §7)_; gallery → `products`/gallery; "Style it with" → `bundle_offer` _(single-suggestion variant)_; "You might also like" → `product_carousel`/`products`.
  **PLP:** header + count → `collection_header`; sub-category tiles → `category_tiles`; grid + filter rail + density toggle → `products` _(density + swatch-badge variant — §7)_.

- **Example business:** **Voltage** — a broad, everyday-fashion shop ("Trend-fast fashion, priced to move"). Deliberately category-broad (not one vertical) so the mega-nav + dense grid have real breadth. Commerce catalog seeds **~19 SKUs across 8 categories**, every one with a **comp value + sale price** so the badge/strikethrough UI renders:
  - **Dresses:** Halston Cutout Mini Dress `$30.99` (was `$44.99`); Coastline Satin Maxi `$38.99` (was `$59.99`); Bandage Bodycon Midi `$27.99` (was `$39.99`).
  - **Tops:** Rib-Knit Cami 3-Pack `$19.99` (was `$28.99`); Oversized Graphic Tee `$16.99` (was `$24.99`); Corset Bustier Top `$22.99` (was `$34.99`).
  - **Jeans & Bottoms:** High-Rise Wide-Leg Jean `$34.99` (was `$49.99`); Cargo Parachute Pant `$32.99` (was `$48.00`); Faux-Leather Mini Skirt `$21.99` (was `$32.99`).
  - **Matching Sets:** Ribbed Lounge Set `$29.99` (was `$44.99`); Blazer + Short Suit Set `$54.99` (was `$79.99`).
  - **Jumpsuits & Rompers:** Strapless Wide-Leg Jumpsuit `$39.99` (was `$58.00`); Utility Cargo Romper `$28.99` (was `$42.99`).
  - **Swimwear:** Ring-Detail String Bikini `$24.99` (was `$36.99`); One-Shoulder One-Piece `$27.99` (was `$39.99`).
  - **Shoes:** Strappy Stiletto Heel `$35.99` (was `$52.00`); Chunky Platform Sneaker `$42.99` (was `$64.99`).
  - **Accessories:** Oversized Shield Sunglasses `$12.99` (was `$19.99`); Quilted Shoulder Bag `$29.99` (was `$44.99`).

  Each SKU carries 3–6 colorways (so swatch dots render), XXS–XL sizing with a couple of **low-stock/notify flags**, and a `Comp. Value` alongside the marked price. Collections: **New In, Dresses, Tops, Jeans, Matching Sets, Swim, Sale (60-80% Off), Voltage Luxe**. CMS `blog_post` records seed a **"The Voltage Edit"** lookbook to fill the trend/editorial bands: "The Golden Hour Edit", "Vacation Mode: 12 Resort Looks", "Denim Reset — Styling Wide-Leg", "The Night-Out Edit", "Everyday Basics Under $25", "Clean-Girl Aesthetic Starter Kit".

- **Design freedom used (tenant-only affordances):** full-bleed candy-bright **promo bands**; **alternating dark chrome / white content**; low radius; **hover image-swap** on cards; **live countdown timers**; **auto-rotating** announcement/promo carousel; **sticky add-to-bag** bar; a discount **pop-up gate**; edge-to-edge imagery. All permitted on a tenant site (forbidden on a sparx-owned surface); separation is by ground shifts + gutters, no decorative shadows.
- **Deliberate departures:** vertical stays a **broad apparel shop** (Voltage, not Fashion Nova); no Fashion Nova wordmark, photography, sub-brand names, or "Nova/Novadeals" naming; we keep the **one red sale accent** disciplined to badge/price/urgency (never decoration); we do **not** ship the gamified "Spin to Win" gate by default (it degrades trust — a plain email/SMS capture stands in); review/urgency copy is generic, not scraped; the mega-nav taxonomy is our own (category × occasion × trend) rather than cloned link-for-link.

## 7. Build notes / catalog gaps

These are catalog _variants/additions_ (propagate once, never per-bundle inlines):

- **`notice_banner` countdown variant** — a strip with a **live countdown timer** + rotating offers + prev/next; the black/red promo-strip stack. If `notice_banner` is static today, add an optional `countdownTo` + `rotate` slot.
- **`offer_hero` promo variant** — a full-bleed image hero with a centered discount overlay + CTA (no video needed here); reuse across the candy `picture_band`s.
- **`products` dense-catalog variant** — the load-bearing add: (a) a **3/4/5-up column-density toggle** + "Show 60 | 120"; (b) a **product-card** with a **red "% OFF" sale badge**, **comp-value strikethrough** + "prices as marked" line, **color-swatch dots**, **wishlist heart** and **hover image-swap**; (c) a **filter rail** with a **color-swatch facet** + size facet; (d) an optional **tab-filter** header ("Shop the Latest" tabs) that reslices the bound set in place.
- **`category_tiles` brand variant** — a "Shop by Brand" tile row (labelled logo/lifestyle tiles) distinct from the category-tile row.
- **`buy_box` bargain-catalog kit** — **comp-value strikethrough**, a **pay-in-4 installments** row (Zip/Afterpay/Klarna-style, provider-agnostic), **per-size stock flags** (low-stock ⚡ / notify-me 🔔 / back-in-stock), a **delivery-date countdown** urgency line, and a **sticky mobile add-to-bag** bar. All bindable, none hardcoded.
- **`bundle_offer` "style it with" single-suggestion variant** — one complete-the-look product + a "See N similar styles" link, rendered after the buy-box.
- **`collection_header` count + sub-tile row** — title + live product count with an optional **sub-category tile row** (occasion/edit tiles) above the grid.
- **Discount email/SMS capture** — the footer + optional modal capture; ship the plain capture, **not** the gamified spin-to-win gate.
