# Bokksu — design study → `sparx-warm-subscription`

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-04
**Reference:** Bokksu — https://www.bokksu.com (+ https://www.bokksumarket.com for catalog/PLP; captured 2026-08-04, default 1280px viewport, real Chromium)
**Archetype:** Warm subscription / food editorial — cream-and-terracotta palette, high-contrast editorial serif, cultural-storytelling narrative, and a subscription **plan-selector** (cadence tiers) as the primary conversion device.
**sparx slug:** `warm-subscription` · **Example vertical:** specialty single-origin coffee subscription · **Theme:** bespoke mid-warm — `roastery` (see §6; closest presets `hearth`/`kitchen`)

> Faithfulness bar: **closest clone allowed** — mimic structure AND aesthetic feel,
> sparx components + branding only, no trademarked assets. See [README](../README.md).

## 1. Why this reference

Bokksu is the defining **warm-subscription / food-editorial** storefront: a Japanese-snack subscription box that turned a recurring-commerce checkout into a cultural-storytelling experience. It earns its place in our set as the **warm-editorial anchor** — a cream-and-terracotta palette that feels like a hand-bound cookbook, a high-contrast editorial serif (Orpheus Pro) carrying every headline, and full-bleed lifestyle/maker photography that sells provenance and craft rather than product specs. Its most instructive move is commercial, not decorative: the **subscription plan-selector** (12/6/3/1-month cadence cards with per-month pricing, save badges, a POPULAR/BEST-VALUE ribbon, and an expandable gift-with-purchase) is embedded on the homepage AND is the PDP buy-box — the single clearest study of how to merchandise a _recurring_ purchase. It is the counterweight to the dark, drop-driven Gymshark study: slow, warm, narrative, gift-minded.

## 2. Screenshots

Captured to `./images/`.

- `home-fold.png` — Hero fold: full-bleed warm-terracotta product photo (snack box, tea, matcha whisk), reversed Orpheus serif headline "Discover Japan Through Snacks", one-line subhead, single outline "SUBSCRIBE NOW" CTA; transparent header over the image.
- `home-full.png` — Full homepage scroll: hero → "Our Commitment to Craft & Culture" editorial split → "Featured by" logo wall (dark brick band) → "How it works" 3-step → "22 snacks" inclusion-checklist band → testimonial quote + UGC photo strip → "Choose your plan" subscription selector → newsletter band (espresso) → footer.
- `nav.png` — Header strip: rust announcement bar over a cream/transparent navbar (stacked BOKKSU / SNACK BOX logo left, SHOP▾ ABOUT▾ BRANDS▾ mega-dropdowns, "SUBSCRIBE NOW" pill + account + cart right).
- `home-how-it-works.png` — Signature: "How it works" 3-step (Subscribe / Receive / Experience) — three full-bleed lifestyle photos over serif labels + sentence-case captions on a cream band.
- `home-subscription.png` — Signature: the subscription band as embedded on the homepage — plan cards (3-Month / 1-Month tail), TOTAL row with struck-through compare price + "SAVE $36", terracotta "SELECT THIS PLAN", and the 6-row icon inclusion list ("20+ Japan-exclusive snacks", "20–24-page Culture Guide", …) + "Experience Japan From Home" prose.
- `pdp.png` — PDP fold / the subscription plan-selector: left gallery (large image + vertical thumbnail scrubber, down-chevron), right buy-box — eyebrow "CHOOSE YOUR PLAN", serif "Snack Box Subscription", rust promo banner "Free gifts with 3, 6, and 12-month plans", four cadence radio-cards (12mo BEST VALUE · SAVE $84 · $32.99/mo; **6mo POPULAR selected+expanded** showing a GIFTS WITH PURCHASE thumbnail + copy; 3mo SAVE $12; 1mo), TOTAL with strikethrough, "SELECT THIS PLAN".
- `pdp-full.png` — Full PDP: gallery + cadence buy-box → inclusion list → "Experience Japan From Home" prose bullets → "22 snacks" band → "Discover Monthly Themes" named-edition carousel (Velvet Neon Nights, Hatsuyume Dreams, …) → "Customer Reviews" (4.8★, rating-snapshot bars, topic filter chips, verified-buyer reviews **with photos + brand replies**, pagination) → newsletter → footer.
- `plp.png` — Catalog listing (Bokksu **Market**, the a-la-carte grocery subdomain — see note): left category sidebar + Price/Flavor filters, breadcrumb, "160 products", sort dropdown + grid-density toggle, 4-up cards (discount/"BEST SELLER"/"BACK IN STOCK" badge, wishlist heart, green ADD TO CART, title, struck compare price + price, star rating + review count).
- `plp-full.png` — Full catalog scroll of the same.
- `footer.png` — Footer: espresso-brown band — newsletter strip ("Sign up & get $5 off…" + SUBMIT) atop BRANDS / INFORMATION / SUPPORT link columns, seal logo + socials, "We accept" payment icons, legal bar.

Note: the PLP is served from a **separate brand/subdomain** (`bokksumarket.com`) with its own **olive-green** chrome — the a-la-carte grocery store — so it does not carry the cream/terracotta editorial system of `bokksu.com`. We document its _structure_ (filters + 4-up card anatomy) but deliberately re-skin the sparx PLP into the warm brand (see §6 departures). The SHOP mega-nav is a click/hover flyout that did not resolve headlessly; documented from the DOM in §4.

## 3. Design language

- **Palette:** **Warm cream + terracotta + espresso**, with a forest-green ink accent. Grounds are a warm cream `~#F2E8D7` (body) shifting to a deeper oat `~#EDE2CF` for alternating bands; the **hero and lifestyle photography are terracotta-dominant** (`~#A5432A` studio backdrops), so the _imagery_ carries the loudest color. Chrome beats are **espresso brown `~#3A1E12`** (footer, newsletter, dark bands) and a **brick red `~#8E3A22`** (announcement bar, "Featured by" band). The single interactive accent is a **terracotta `~#B14A22`** (CTA fills, price, SAVE badges, selected plan ribbon). Section headings render in a muted **forest green `~#3B4A3B`** on cream; body ink is a warm near-black `~#241A12`. Mood: heritage, hand-crafted, editorial, gift-worthy, appetite-warm. (Hexes are observed/eyeballed from the captures; finalise against the sampled tokens in §6.)
- **Typography:** Two-register editorial pairing. **Display = a high-contrast transitional serif** (Bokksu ships _Orpheus Pro_ / _OrpheusW05_) — large, elegant, sentence-case, driving every hero and section header ("Discover Japan Through Snacks", "Our Commitment to Craft & Culture!", "How it works"). **Body = a humanist sans** (_Lato_), regular weight, sentence case, comfortable measure. **Labels/buttons/eyebrows = a letter-spaced uppercase sans** (_Montserrat_) — wide tracking, small ("SUBSCRIBE NOW", "CHOOSE YOUR PLAN", "BEST VALUE"). The serif-headline-vs-tracked-uppercase-label contrast _is_ the warm-editorial voice.
- **Imagery:** One dominant register — **warm styled lifestyle + maker photography** on terracotta/earthen backdrops: the box surrounded by tea, matcha whisk, and snacks; multi-generational family makers; a kimono-clad model presenting the box across the "How it works" triptych; flat-lay top-downs. Crops are full-bleed and generous; people and provenance are always present (this is the anti-stock-photo — it sells the _makers_). UGC customer photos appear as a testimonial strip.
- **Shape & density:** **Soft, rounded, roomy.** Buttons are **full-pill** or generously rounded rectangles; plan/product cards use ~8–12px radius with **soft shadows** and hairline `~#E0D3BB` borders. Generous vertical rhythm, wide gutters, mostly **single-column editorial or 3-up** compositions (not dense grids) — except the Market PLP which is a denser 4-up. Separation is by **ground shifts** (cream ↔ oat ↔ brick ↔ espresso) far more than by lines.
- **Motion:** Restrained. Klaviyo entry pop-up ("Get $5 off your first box"); auto-advancing testimonial + UGC carousels with prev/next arrows; thumbnail-scrubber gallery on the PDP; the plan-selector **expands the selected cadence** in place to reveal its gift-with-purchase; sticky header that solidifies from transparent-over-hero to cream on scroll; cart drawer that slides in with upsell rows + a free-gift progress threshold. No video hero, no parallax spectacle.

## 4. Layout anatomy (top to bottom)

- **Announcement / utility bar:** Thin **brick-red** strip, centered small serif/sans text, single message + underlined link ("Rare extras when you subscribe for 3, 6, or 12 months! **Find Out More**"). Single message (not a rotator).
- **Header / nav:** Transparent over the hero, solidifying to cream on scroll. **Left:** stacked seal-icon + `BOKKSU / SNACK BOX` wordmark. **Left-center:** `SHOP ▾` · `ABOUT ▾` · `BRANDS ▾` mega-dropdowns. **Right:** a bordered pill **`SUBSCRIBE NOW`** primary, an account glyph, a cart glyph. Sticky.
  - **SHOP mega:** columns — _Bokksu Snack Box_ (Subscribe, Gift, Past Themes) · _Bokksu Boutique_ (Shop Boutique) · _Gifts_ (Gift Cards, Corporate Gifts).
  - **ABOUT mega:** _Our Story, Our Makers, Maker's Documentary_ · _Support:_ FAQ, Contact Us · _Information:_ Blog, Today's Offers, Community, Careers, Rewards, Refer a Friend.
  - **BRANDS mega:** three brand cards with one-line descriptions + `SHOP NOW` (Snack Box subscription / Boutique gifts / Market grocery).
  - **Cart drawer:** upsell rows ("+ Add Gift Wrapping $15.00", "+ Upgrade to Washi Box $20.00") and a **free-gift progress threshold** ("ADD $27.00 TO CHECKOUT").
- **Hero:** **Full-bleed terracotta lifestyle photo** (product hero-still), content pinned left: reversed Orpheus serif two-line headline ("Discover Japan Through Snacks"), a one-line sans subhead ("Authentic Japanese snacks delivered to you monthly from Japan."), and **a single** outline/light `SUBSCRIBE NOW` CTA. No dual-CTA, no video.
- **Homepage section sequence:**
  1. **Editorial split — "Our Commitment to Craft & Culture!"** — eyebrow "WHAT MAKES US DIFFERENT", image left (family makers), serif heading + prose + `SUBSCRIBE NOW` right. Brand-story beat.
  2. **"Featured by" logo wall** — dark brick band, centered "FEATURED BY" + four press wordmarks (editorial/press logos).
  3. **"How it works" 3-step** — cream band; three full-bleed lifestyle photos over serif labels (SUBSCRIBE / RECEIVE / EXPERIENCE) with sentence-case captions.
  4. **"Your first Bokksu includes: 22 snacks, candies & tea!"** — image carousel left (dots), serif heading + a **6-item icon inclusion list** in two columns (Gift-with-purchase, Tea pairing, 22–24-page guide, Authentic treats, Sweet & savory, Bokksu exclusives) + `SUBSCRIBE NOW`.
  5. **Testimonial quote band** — large serif pull-quote, 5 stars, "— name", above a **UGC customer-photo carousel strip** with arrows.
  6. **Subscription plan-selector — "Choose your plan / Snack Box Subscription"** — product gallery (thumbnail scrubber) left; the cadence buy-box right (see PDP anatomy) — the homepage embeds the classic subscription buy-box directly, with the inclusion list + "Experience Japan From Home" prose beneath.
  7. **Newsletter band** — espresso strip, "Sign up & get $5 off your first order + exclusive deals!" + email + `SUBMIT`.
- **PDP anatomy (the subscription plan-selector):** Two-column.
  - **Left gallery:** large primary image + a **vertical thumbnail scrubber** (5–6 thumbs, down-chevron to page).
  - **Right buy-box (the star):** eyebrow "CHOOSE YOUR PLAN" → serif title "Snack Box Subscription" → a full-width **terracotta promo banner** ("Free gifts with 3, 6, and 12-month plans.") → **four cadence radio-cards**, each showing _term_ + a **badge** (12 Months · `BEST VALUE`; 6 Months · `POPULAR`; 3 Months; 1 Month), a **SAVE $N** figure, and a **per-month price** ($32.99 → $39.99/mo). The **selected card expands** to reveal a `GIFTS WITH PURCHASE` row (thumbnail + itemised copy). → a **TOTAL row** with `SAVE $N`, a **struck-through compare total** ($203.94 ~~$239.94~~), and "Billed every N months, cancel anytime." → a filled terracotta **`SELECT THIS PLAN`** → fine print ("Total plus shipping… All prices in USD"). Below: a **6-row icon inclusion list**, then a **"Experience Japan From Home"** prose block with detail bullets.
  - **Below the fold:** "22 snacks" band → **"Discover Monthly Themes"** named-edition carousel (each month a titled themed curation) → **"Customer Reviews"** (4.8★ over 1,000s, rating-snapshot bars, topic filter chips, per-review verified-buyer + **review photos** + **brand replies**, pagination) → newsletter → footer.
- **Collection / PLP (Bokksu Market subdomain):** Left **category sidebar** (New Arrivals, Best Sellers, Originals, Sweets, Snacks, Drinks, Pantry, Value Packs, See All) + **Filters** (Price slider, Flavor checkboxes). Header: breadcrumb (Home / Collections / All Products), **"160 products"**, a Sort dropdown ("Best selling") + **grid-density toggle**. **4-up product grid** — card = corner badge (`56% OFF` / `BEST SELLER` / `BACK IN STOCK`), wishlist heart, image, an in-card **`ADD TO CART`**, title, **struck compare price + price**, star rating + review count.
- **Footer:** Espresso-brown. A newsletter strip ("Sign up & get $5 off…" + `SUBMIT`) sits atop three link columns (**BRANDS** / **INFORMATION** / **SUPPORT**), a seal logo + social row (IG / FB / YouTube / TikTok), a **"We accept"** payment-icon grid, and a legal bar (© 2026 · Bokksu Boutique · Bokksu Market).

## 5. Signature interaction patterns

1. **The subscription plan-selector (cadence buy-box).** Radio-cards per term (12/6/3/1-month) each carrying a per-**month** price, a **SAVE $N**, a **POPULAR / BEST-VALUE** ribbon; the selected card **expands in place** to show its gift-with-purchase; a **TOTAL row** with struck-through compare price + "billed every N, cancel anytime". It is the homepage conversion device _and_ the PDP buy-box — the whole site funnels to it.
2. **Warm editorial provenance storytelling.** "Discover [place] Through [product]" hero framing, a "commitment to craft & culture" maker split, and full-bleed family-maker photography — the site sells _who makes it and why_, in an editorial serif, not spec sheets.
3. **Monthly-theme merchandising.** A "Discover Monthly Themes" carousel of **named seasonal editions** (each month a titled, story-backed curation) — the recurring-commerce analog of a "drop", and the reason to stay subscribed.
4. **Gift & cadence framing everywhere.** A Gift path in the plan-selector, "Gift Cards" + "Corporate Gifts" in nav, cart-drawer **gift-wrapping / premium-box upsells**, and a **free-gift progress threshold** in the cart.
5. **Trust-dense PDP reviews.** A 4.8★ rating-snapshot with distribution bars, topic **filter chips**, and per-review **verified-buyer badges, customer photos, and brand replies** — social proof engineered for a considered recurring purchase.

## 6. The sparx translation

- **Theme:** **bespoke mid-warm — `roastery`** (closest shipped presets: `hearth` / `kitchen` from the trades group; grounds = mid/paper, primary = deep). It is a **warm-cream page** with an **espresso dark-chrome island** for the footer/newsletter/"featured-by" beats — not an all-dark or all-tinted page.
  - **Grounds (4 surfaces):** `base-100` page = warm cream `#F4EBDB`; `base-200` muted/alt band = deeper oat `#EDE2CF`; `base-300` line/inset = `#E0D3BB`; **`ink` chrome ground = espresso `#3A1E12`** (footer, newsletter, "featured by", any dark beat — carried as a `surface="dark"` island so ink surfaces + outline buttons resolve).
  - **Primary strategy:** **deep** — the primary action is a **terracotta `#B14A22`** fill with white text on cream (AA-safe), inverting to a cream/white fill on the espresso island. Terracotta also carries the price, the `SAVE $N` figures, and the selected-plan ribbon. (Matches Bokksu's single warm accent exactly.)
  - **Secondary / heading ink:** a muted **forest green `#3B4A3B`** for section headings on cream (Bokksu renders its "Craft & Culture" headline in this green) — a disciplined second hue, headings-only, well clear of AA on cream.
  - **Photography carries the terracotta** (hero + lifestyle backdrops at `~#A5432A`) so chroma comes from imagery, not flood-fill; the announcement/"featured-by" bands use brick `#8E3A22`.
  - **Fonts:** display = a **high-contrast editorial serif** (Orpheus/Canela register — a tenant site may load a serif display face; that is tenant freedom); body = a **humanist sans** (Geist is the sparx-surface default; the tenant may load a Lato-class sans); labels/buttons = a **letter-spaced uppercase sans**. All body copy stays warm-near-black-on-cream / cream-on-espresso (AA clears comfortably).
- **Section mapping:**

  | Bokksu homepage / PDP band                            | sparx catalog key                                                        |
  | ----------------------------------------------------- | ------------------------------------------------------------------------ |
  | Brick announcement bar (single message + link)        | `notice_banner`                                                          |
  | Header / mega-nav + footer                            | `sparx_layout` (silica frame navbar/footer)                              |
  | Full-bleed terracotta photo hero + single CTA         | `offer_hero` _(full-bleed image variant)_                                |
  | "Our Commitment to Craft & Culture" maker split       | `picture_split`                                                          |
  | "Featured by" press logo wall (dark band)             | `logo_wall`                                                              |
  | "How it works" 3-step lifestyle triptych              | `how_it_works` _(full-bleed-photo variant — §7)_                         |
  | "Your first box includes" image + icon inclusion list | `checklist_split`                                                        |
  | Testimonial pull-quote + stars                        | `quote_band`                                                             |
  | UGC customer-photo carousel strip                     | `gallery_strip`                                                          |
  | **Subscription plan-selector (cadence buy-box)**      | `buy_box` _(subscription/cadence variant — §7)_                          |
  | Product gallery w/ thumbnail scrubber                 | `products` / gallery                                                     |
  | "Discover Monthly Themes" named-edition carousel      | `gallery_strip` _(editorial-edition variant — §7)_ or `product_carousel` |
  | "Experience Japan From Home" prose + bullets          | `prose_section`                                                          |
  | 6-row icon inclusion list                             | `inclusion_list`                                                         |
  | Customer Reviews (snapshot + filtered list)           | `review_summary` _(photos + replies — §7)_                               |
  | Newsletter band (espresso)                            | `newsletter_signup`                                                      |

  **PLP:** breadcrumb + count + sort + density → `collection_header`; category sidebar + Price/Flavor filters + 4-up grid → `products`.
  **Journal (CMS):** post = `article_header` + `prose_section` + gallery; index = `resource_grid` (or `update_list`).

- **Example business:** **Latitude Coffee Club** — a curated single-origin coffee subscription + shop ("A new coffee-growing origin at your door each month."). It maps Bokksu's model 1:1 onto coffee: each month is a **named origin edition** with a farmer/harvest story, replacing "regional Japanese snacks" with "single-origin harvests along the bean belt."
  - **Commerce — subscription (the plan-selector):** **The Origin Club** — cadence plans **12 / 6 / 3 / 1-month**, per-month pricing ($15.99 → $21.99/mo range), `BEST VALUE` (12mo) + `POPULAR` (6mo) ribbons, **gift-with-purchase** on 3/6/12-month plans (a Latitude enamel mug + brew-guide zine), a **grind selector** (Whole bean / Filter / Espresso / Aeropress) as the plan's variant axis, and a **Gift this** toggle. "Billed every N months, cancel anytime."
  - **Commerce — a-la-carte shop (PLP):** ~24 SKUs across **single-origin bags** (Ethiopia Guji, Colombia Huila, Guatemala Antigua, Kenya Nyeri, Sumatra Lintong, Brazil Cerrado), **roast tiers** (light / medium / dark) + decaf, **sampler flights**, and **brew gear** (pour-over dripper, gooseneck kettle, hand grinder, filters, enamel mug, tote) — enough colorways/roasts/sizes that the swatch + variant rows render. Collections: New Arrivals, Single Origins, Espresso, Decaf, Gear, Gifts.
  - **CMS `blog_post` — "The Latitude Journal":** origin stories, farmer/co-op profiles, harvest notes, and brew guides — the "Our Makers / Monthly Themes / Blog" analog that fills the editorial + monthly-edition bands.
- **Design freedom used (tenant-only affordances):** full-bleed **photographic hero**; a **warm multi-ground palette** (cream ↔ oat ↔ brick ↔ espresso band alternation); **soft shadows** on plan/product cards; **full-pill** buttons and rounded cards; **cart-drawer upsells + free-gift threshold**; entry newsletter pop-up; auto-advancing testimonial/UGC carousels. All permitted on a tenant site (forbidden on a sparx-owned surface) — separation still leans on ground shifts, matching the reference.
- **Deliberate departures:** vertical swapped Japanese snacks → **specialty coffee**; no Bokksu wordmark, seal, photography, or edition names; **the PLP is unified into the warm cream/terracotta brand** (Bokksu splits its catalog onto an olive-green "Market" subdomain — we keep one coherent design system); provenance/review copy is generic, not scraped; the announcement bar is a single message (we do not add a rotator).

## 7. Build notes / catalog gaps

These are catalog _variants/additions_ (propagate once, never per-bundle inlines):

- **`buy_box` subscription / cadence variant (the headline gap).** A plan-selector of **radio-cards per term** (N-month), each with a **per-period price**, a **SAVE $N** figure, an optional **ribbon** (`POPULAR` / `BEST VALUE`), and an **expandable body** that reveals a gift-with-purchase (thumbnail + copy). Plus a **term-TOTAL row** (struck-through compare total + SAVE) and a "billed every N, cancel anytime" line, and a secondary **variant axis** (grind / size) that applies across plans. This is the single most important addition and must be a bindable commerce component, not a hardcoded block.
- **`gallery_strip` editorial-edition variant** — named, story-backed **"monthly edition"** cards (title + subtitle overlay) each linking to a themed collection — the recurring-commerce "drop" row.
- **`how_it_works` full-bleed-photo variant** — a 3-step where each step is a **full-bleed lifestyle photo** over a serif label + caption (photo slot per step), not an icon-in-a-circle.
- **`review_summary` with photos + brand replies** — ensure the component supports a rating-snapshot with distribution bars, **topic filter chips**, per-review **customer photos**, **verified-buyer** badges, and **merchant replies** threaded under a review.
- **Cart-drawer upsell + free-gift threshold** — bindable "add gift wrapping / upgrade box" upsell rows and a **progress-to-free-gift** meter in the cart drawer (a commerce feature to confirm exists).
- **`offer_hero` full-bleed image variant** — a photographic full-bleed hero with left-anchored serif headline + single CTA and a transparent→solid sticky header, if `offer_hero` is not already image-capable.
