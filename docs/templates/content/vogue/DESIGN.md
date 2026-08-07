# Vogue — design study → `sparx-glossy-fashion`

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-06
**Reference:** Vogue — https://www.vogue.com (Condé Nast hard-blocks automated capture — 403, same as The New Yorker in this set and Sephora in the commerce set; studied from the live archetype + knowledge; visual pass to `./images/`)
**Archetype:** High-fashion glossy magazine — full-bleed fashion photography, thin high-contrast serif display, image-first story grids, luxurious whitespace, minimal chrome, a runway/lookbook rhythm.
**sparx slug:** `glossy-fashion` · **Example vertical:** style & design magazine · **Theme:** bespoke — `runway` (see §6; closest presets `atelier` / `press`)

> Faithfulness bar: **closest clone allowed** — mimic structure AND aesthetic feel,
> sparx components + branding only, no trademarked assets. See [README](../README.md).

## 1. Why this reference

Vogue is the defining **high-fashion glossy**: a magazine where the **photograph is the
story** and the type gets out of its way. It anchors our content set as the **image-first /
editorial-luxury** archetype — the photographic and tonal opposite of both TechCrunch's
imageless density and The New Yorker's illustration-and-serif restraint. Where the feed
optimises for scan-speed and the literary front optimises for reading measure, Vogue
optimises for **desire and taste**: full-bleed art-directed imagery, a thin high-contrast
serif display used sparingly and large, and acres of whitespace that read as
confidence. It is the cleanest study of how **big photography, a disciplined serif, and
generous air** carry a homepage where a firehose of headlines would only cheapen it — the
template every fashion, design, interiors, culture-of-taste, lookbook, or portfolio
publisher needs. It is also the set's clearest **content-and-commerce** candidate: a glossy
naturally runs a "shop the look" slice, so it demos the CMS spine with a light commerce
grafted on — without ever becoming a store.

## 2. Screenshots

Captured to `./images/` (manual pass — automated capture is 403-blocked, identical to the
New Yorker teardown; a signed-in reviewer captures the frames on a manual sweep).

- `home-fold.png` — Top fold: a slim serif wordmark centered over a thin horizontal
  department nav (Fashion, Beauty, Runway, Culture), a hairline utility row (search /
  subscribe), then a **single full-bleed cover story** — one commanding art-directed image
  with an overlaid thin-serif headline + rubric + byline. No grid competes with it above
  the fold.
- `home-full.png` — Full scroll: cover story → a **two/three-up editorial story grid**
  (large image cards, rubric + serif headline + byline, lavish gutters) → a **Runway /
  lookbook gallery band** (a horizontally-paced strip of looks) → a **department block**
  per section (Fashion, Beauty, Culture) at calm, curated density → a **"Shop the Edit"**
  commerce strip (product cards tied to a story) → a subscribe/newsletter band. No infinite
  feed; the page reads as a curated issue.
- `nav.png` — Header: centered serif **wordmark masthead** over a thin department nav;
  search + a prominent **Subscribe**; on scroll the masthead condenses to a slim sticky bar.
  Mobile → hamburger to a full-height serif department menu.
- `article.png` — **The photo-story reading page:** a **full-bleed image hero** with the
  headline + rubric overlaid (or immediately beneath), byline + date, then a
  **generous-measure serif body interleaved with large full-width and inset images**, an
  occasional **pull-quote** set large, and a **shop-the-look / credits** rail. Imagery is
  the connective tissue, not an accompaniment.
- `runway.png` — **The lookbook/gallery page:** a titled collection (e.g. "Resort 2027")
  rendered as a **dense uniform grid of look thumbnails** that open to a full-screen viewer
  — the signature fashion surface with no editorial-feed equivalent.
- `department.png` — A department/archive front: section title over an image-led curated
  card grid at magazine (not feed) density.
- `footer.png` — Footer: quiet serif link columns (Sections · Fashion Shows · More ·
  Follow · About/Legal), newsletter capture, copyright — restrained, lots of air.

## 3. Design language

- **Palette:** **Pure black, pure white, and the photograph.** Ground is true white
  `#FFFFFF`; ink true near-black `#0A0A0A`; the design ships **no chrome accent at all** —
  color comes entirely from the **full-bleed imagery**, which is where a fashion book wants
  every eye. A single restrained accent exists only for the functional minimum (the
  Subscribe control, a link hover) and is a near-black or a whisper-warm grey, never a
  brand hue competing with the art. Mood: austere, confident, expensive, timeless.
- **Typography:** **Thin high-contrast serif display, the whole identity.** A tall,
  high-contrast display serif (Vogue's Didone lineage — hairline thins, dramatic
  thick/thin modulation) used **large and sparse** for headlines and the wordmark; a quiet
  readable text serif or a clean grotesque for body and captions; rubrics/labels in
  **small-caps, wide-tracked, all-caps** micro-type. Hierarchy is **scale + air**, not
  weight — headlines are big and light, not bold. The high-contrast serif IS the glamour.
- **Imagery:** **Full-bleed, art-directed fashion photography — the spine of the design.**
  Portrait and landscape crops that run edge-to-edge, single commanding images over grids
  of thumbnails; imagery is the statement, type the caption. This is the exact inverse of
  the New Yorker's illustration restraint and TechCrunch's utilitarian locator thumbnails —
  here the photo is the point and everything else is furniture around it.
- **Shape & density:** **Zero/near-zero radius**, **no borders or cards-with-elevation** —
  separation is **whitespace and the image edge**. **Low density, lavish gutters**, wide
  section padding; the grid breathes. The article measure is generous (imagery does the
  pacing, not a pinned narrow column). No shadows — the full-bleed image against white is
  the entire visual device.
- **Motion:** **Restrained but cinematic** — slow crossfades between cover images, a subtle
  parallax or scale-in on full-bleed heroes, a horizontally-paced lookbook strip, a
  full-screen gallery viewer with keyboard/swipe paging. Nothing bouncy; the motion reads
  as editorial, not app-y.

## 4. Layout anatomy (top to bottom)

- **Announcement / utility bar:** Usually none, or a whisper-thin subscribe/issue line —
  maximum restraint, so nothing crowds the cover.
- **Header / nav:** A centered serif **wordmark masthead** over a **thin horizontal
  department nav** (Fashion, Beauty, Runway, Culture, plus Shows/Video); search and a
  prominent **Subscribe** at the right — subscription is the visible conversion. On scroll
  the masthead condenses into a slim sticky bar. Solid white, hairline-separated,
  printerly-luxe.
- **Hero:** A **single full-bleed cover story** — one art-directed image running edge to
  edge with an overlaid (or tightly-set-beneath) thin-serif headline + small-caps rubric +
  byline. Not recency-driven and never a grid: the front page opens on **one commanding
  image**, the way an issue opens on a cover.
- **Homepage section sequence** (this IS the blueprint's home composition):
  1. **Cover story** — full-bleed image + overlaid rubric/serif headline/byline (the ranked
     feature, styled as a magazine cover).
  2. **Editorial story grid** — 2–3-up large image cards (rubric + serif headline + byline),
     lavish gutters, curated not exhaustive.
  3. **Runway / lookbook band** — a horizontally-paced strip of looks or a titled gallery
     teaser linking to the full lookbook page — the signature fashion module.
  4. **Department blocks** — per section (Fashion, Beauty, Culture): a small-caps section
     title + an image-led curated card set at calm density.
  5. **"Shop the Edit" strip** — a light commerce band of product cards tied to a story
     (shop-the-look), demoing content **and** commerce on one page.
  6. **Subscribe / newsletter band** — the conversion, set in-voice.
  7. **Footer.**
- **Article anatomy** (the heart of this template — the "PDP" of a glossy): **full-bleed
  image hero** with rubric (small-caps) + large thin-serif headline overlaid or beneath →
  **byline + date + read-time** → a **generous-measure serif body interleaved with
  full-width and inset editorial images** (the imagery paces the read) → an occasional
  **large pull-quote** → a **shop-the-look / credits** rail (products + photo credits) → a
  **subscribe** band → **related reading** (more stories) at the foot. The reading
  experience is **image-led**, not measure-pinned — the opposite pole from the New Yorker's
  narrow column.
- **Runway / lookbook page** (the signature surface): a titled collection front → a **dense
  uniform grid of look thumbnails** → a **full-screen gallery viewer** with paging. No
  editorial-feed archive covers this; it is the fashion-specific page in the set.
- **Archive / department:** an **image-led department front** — small-caps section title +
  a curated image card grid at magazine density (not a load-more firehose). Author pages =
  an author bio header + their pieces in the same image grid.
- **Footer:** quiet serif **link columns** (Sections · Fashion Shows · More · Follow ·
  About/Legal), newsletter capture, copyright — restrained, air-heavy.

## 5. Signature interaction patterns

1. **Full-bleed cover open:** the homepage and every article open on **one commanding
   edge-to-edge image** with thin-serif type set over or beneath it — reproduce the
   full-bleed cover treatment and the "glossy" feeling arrives before a word is read.
2. **Image as the connective tissue of the read:** the article body is **paced by
   full-width and inset editorial images**, not broken by them — the photography carries the
   rhythm a narrow measure carries in a longform reader.
3. **The lookbook grid → full-screen viewer:** a dense uniform grid of looks that opens to a
   swipeable/keyboard-paged full-screen gallery — the one fashion-native surface with no
   equivalent elsewhere in the set.
4. **Shop-the-look as content, not store:** product cards tied to a story (in-body credits
   rail + a homepage "Shop the Edit" strip) — commerce surfaced as editorial, the cleanest
   demo of content-and-commerce on a single content spine.

## 6. The sparx translation

- **Theme:** **bespoke — `runway`** (closest shipped: `atelier` / `press`). A **pure
  black-and-white, image-first, thin-serif** editorial-luxury theme where the imagery
  supplies all the color.
  - **Grounds (4 surfaces):** `base-100` page = `#FFFFFF` (true white); `base-200` muted
    ground (department bands, credits rail) = `#F5F5F5`; `base-300` hairline rules =
    `#E6E6E6`; `base-content` ink = `#0A0A0A` (true near-black).
  - **Primary / accent strategy:** **no brand hue — the photograph is the color.** The
    functional primary (Subscribe control, link hover, form focus) resolves to
    **near-black** `oklch(~18% 0 0)` on white — AA-clean as a solid fill with white ink and
    as text on white by construction (max contrast). This is the deliberate inversion of
    TechCrunch's "one saturated accent": here **restraint of chrome is the identity**, and
    all chroma is delegated to full-bleed imagery. (Confirm the near-black primary + white
    ink clears the catalog-sweep, which it will trivially — it is the highest-contrast pair
    available.)
  - **Fonts:** **thin high-contrast display serif** (a Didone/Canela feel — hairline thins,
    dramatic modulation) for headlines, the wordmark, and rubrics, set **large and light**;
    **quiet text serif or clean grotesque** for body at a comfortable size above the 16px
    floor (imagery paces the read, so body sits at ~17–18px, not the New Yorker's raised
    reading measure); rubrics/labels in **small-caps, wide-tracked all-caps** micro-type
    kept legible (RULE #3 — small but a real ink token, never faded). The high-contrast
    display serif is the single most important token set.
- **Section mapping:**

  | Vogue homepage band                      | sparx catalog key                                            |
  | ---------------------------------------- | ------------------------------------------------------------ |
  | Header masthead + footer                 | `sparx_layout` (silica frame navbar/footer, serif, centered) |
  | Full-bleed cover story                   | **NEW: `cover_story`** (full-bleed image + overlaid title)   |
  | Editorial story grid (large image cards) | `blog_post_grid` _(editorial-card variant, serif — shared)_  |
  | Runway / lookbook band                   | **NEW: `lookbook_gallery`** (uniform look grid + viewer)     |
  | Department block (title + curated cards) | `department_block` _(image-led density — shared)_            |
  | "Shop the Edit" commerce strip           | `product_grid` _(shop-the-look variant, story-tied — §7)_    |
  | Subscribe / newsletter band              | `newsletter_signup` _(subscribe-CTA variant — shared)_       |

  **Article:** full-bleed hero + rubric + serif headline overlaid → **NEW: `article_hero`
  (image-led/full-bleed variant of `article_header`)**; image-interleaved body →
  `article_body` (its default comfortable measure, with full-width/inset image nodes) —
  **not** the New Yorker's `measure:'narrow'` option; large quotation → `pull_quote`
  (shared); shop-the-look/credits → `product_grid` (compact, story-tied); related →
  `blog_post_grid`. **Lookbook page:** `collection_header` (content variant) +
  `lookbook_gallery` at full density. **Department front:** `collection_header` +
  `blog_post_grid` at image-led magazine density.

- **Example business:** **Mode & Object** — a **style & design magazine** ("Where fashion
  meets the made world"), spanning fashion, beauty, runway, and design culture without being
  tied to any single label or industry. Seeds **~18 `cms.blog_post` records** across
  departments — **Fashion, Beauty, Runway, Culture** — each a genuine image-led editorial
  piece (small-caps rubric, author, date, a full-bleed lead image + 3–5 interleaved
  editorial images, a 6–12 paragraph serif body, a pull-quote), so the cover story, story
  grid, department blocks, lookbook, article photo-story page, pull-quotes, and archives all
  render real. **~6 author records** with bios + portraits (fashion editor, beauty director,
  runway critic, culture writer, contributing photographers) so author pages + bylines
  resolve. **Taxonomy** = the four departments + a handful of series/season tags
  ("Resort 2027", "The Beauty Edit", "Studio Visit", "Front Row"). A **light commerce
  slice** seeds it as a real content-and-commerce demo: **~10–12 `commerce.product`
  records** (an accessories / object edit — a scarf, a tote, a ceramic, a fragrance,
  eyewear) tied to stories via the "Shop the Edit" strip and in-body credits rail — content
  is unmistakably the spine, commerce the graft.

  _(Concrete seed spine — 18 posts, so every bound surface renders with real editorial:)_

  | #   | Department | Working headline (rubric)                                       | Author (role)                |
  | --- | ---------- | --------------------------------------------------------------- | ---------------------------- |
  | 1   | Fashion    | _The Return of the Considered Wardrobe_ (The Edit)              | Elena Prévost (Fashion Dir.) |
  | 2   | Fashion    | _Tailoring, Undone_ (Front Row)                                 | Elena Prévost                |
  | 3   | Fashion    | _A Case for the One Good Coat_ (The Edit)                       | Marisol Vega (Fashion Ed.)   |
  | 4   | Fashion    | _Studio Visit: The Quiet Atelier_ (Studio Visit)                | Marisol Vega                 |
  | 5   | Beauty     | _The Beauty Edit: Skin as the Only Statement_ (The Beauty Edit) | Nadia Okonkwo (Beauty Dir.)  |
  | 6   | Beauty     | _Fragrance, and the Memory of a Room_ (The Beauty Edit)         | Nadia Okonkwo                |
  | 7   | Beauty     | _The New Minimal Face_ (The Beauty Edit)                        | Nadia Okonkwo                |
  | 8   | Runway     | _Resort 2027: The Collections That Mattered_ (Resort 2027)      | Julian Hart (Runway Critic)  |
  | 9   | Runway     | _Front Row Notebook: Three Debuts_ (Front Row)                  | Julian Hart                  |
  | 10  | Runway     | _The Lookbook: A Season in Forty Looks_ (Resort 2027)           | Julian Hart                  |
  | 11  | Runway     | _What the Runway Said About the Year Ahead_ (Front Row)         | Julian Hart                  |
  | 12  | Culture    | _The Design of Desire_ (Studio Visit)                           | Theo Marchetti (Culture)     |
  | 13  | Culture    | _An Interior for Slow Mornings_ (Studio Visit)                  | Theo Marchetti               |
  | 14  | Culture    | _The Object That Outlives the Trend_ (The Edit)                 | Theo Marchetti               |
  | 15  | Culture    | _Photographers We're Watching_ (Portfolio)                      | From the Editors             |
  | 16  | Fashion    | _Accessories, and the Art of the Edit_ (The Edit)               | Marisol Vega                 |
  | 17  | Beauty     | _Hair, Sculpted_ (The Beauty Edit)                              | Nadia Okonkwo                |
  | 18  | Culture    | _The Made World: A Design Portfolio_ (Portfolio)                | Theo Marchetti               |

  Authors: **Elena Prévost** (Fashion Director), **Marisol Vega** (Fashion Editor), **Nadia
  Okonkwo** (Beauty Director), **Julian Hart** (Runway Critic), **Theo Marchetti** (Culture
  Writer), **Iris Blum** (Contributing Photographer, credited on imagery). Optional
  subscribe/"become a member" offer as the conversion; content stays the spine.

- **Design freedom used (tenant-only affordances):** the marquee affordances a glossy needs
  that sparx's own surfaces forbid — **full-bleed edge-to-edge imagery** with **type
  overlaid on photography**, a **thin high-contrast display serif** loaded by the tenant
  theme, **cinematic image motion** (slow crossfade / subtle scale-in on the cover, a
  full-screen gallery viewer). Per [[feedback_design_restraints_are_sparx_only]] these are
  tenant-blueprint choices, not sparx-surface violations; no gradient/glass is used
  (restraint carries the luxury), and the only "shadow" is the intrinsic image edge. The
  central tenant-only piece is **image-over-everything composition** plus the **serif
  display**.
- **Deliberate departures:** the vertical broadens from pure high-fashion to a **style &
  design** magazine (so it reads industry-adjacent, not fashion-locked, per the
  industry-agnostic rule); **no Vogue wordmark, no Didot/"Vogue" typeface, no real
  photography, no literal palette, no department naming** ("Runway" as a generic fashion
  department is descriptive, not a trademark); imagery is **royalty-free / original**; the
  paywall is generalised to a subscribe band (no hard paywall ships in the template); and the
  commerce slice stays a **light shop-the-look demo**, never a full storefront.

## 7. Build notes / catalog gaps

Catalog additions (propagate once, never per-bundle inlines) — several are **shared with the
TechCrunch and New Yorker teardowns** (they land once in
[CATALOG-ADDITIONS](../CATALOG-ADDITIONS.md) and all three templates reuse them); the
genuinely **new** ones are the fashion-native image surfaces:

- **`cover_story`** _(NEW — Vogue-specific)_ — a **full-bleed cover feature**: a bound
  `blog_post` rendered as one edge-to-edge image with an **overlaid** small-caps rubric +
  large thin-serif headline + byline, and a legible-scrim/text-placement option so type
  stays readable over any photo. Distinct from `lead_story` (which is illustration-beside-
  text at grid scale) — this is the magazine-cover treatment, image-first and full-bleed.
- **`lookbook_gallery`** _(NEW — Vogue-specific)_ — a **uniform look/thumbnail grid** bound
  to a gallery/collection source that opens to a **full-screen paged viewer** (keyboard +
  swipe). The signature fashion surface; needs a lightbox/gallery behavior (static
  grid-only fallback if the behaviors runtime isn't present, matching the dismissible-promo
  and countdown precedents). Reusable by any portfolio/lookbook/photo-essay tenant.
- **`article_hero` (image-led variant of `article_header`)** _(NEW variant of a shared add)_
  — a **full-bleed image hero** with overlaid/beneath rubric + large serif headline +
  byline, as the article-page counterpart to `cover_story`. Sits alongside the TechCrunch
  news `article_header` and the New Yorker serif/longform variant as a third `article_header`
  treatment — same bindings (`title`, `category`, `author`, `publishedAt`), different image
  weight.
- **`article_body` full-width/inset image nodes** — confirm the rich-text render can
  interleave **full-width and inset editorial images** (with captions/credits) that **pace**
  the read, at its **default comfortable measure** — this is the image-led counterpart to
  the New Yorker's `measure:'narrow'` option (same section, opposite setting). The single
  most important reading-page add for a glossy.
- **`product_grid` shop-the-look / story-tied variant** — the existing commerce grid must
  render a **compact, editorial "Shop the Edit" strip** and an **in-body credits rail** that
  ties `commerce.product` records to a `blog_post` (a `relatedStory` / `credits` binding),
  so content-and-commerce renders on one content page without becoming a PLP. Confirm the
  grid accepts a story-scoped product source.
- **`blog_post_grid` editorial-card variant** _(shared)_ — reuse the New Yorker serif
  editorial card at a **larger image weight / lavish-gutter** density for the glossy story
  grid; confirm the same section covers both with an `imageWeight`/`density` prop rather than
  a new type.
- **`department_block`** _(shared)_ — reuse the titled taxonomy section at **image-led**
  density (confirm the shared `density` prop from the New Yorker/TechCrunch reconciliation
  reaches an image-forward setting).
- **`pull_quote`** _(shared)_ — reuse the New Yorker's large inline quotation; no fashion-
  specific change needed.
- **`newsletter_signup` subscribe-CTA variant** _(shared)_ — reuse the subscribe framing for
  the glossy's subscription conversion.
- **Full-bleed / type-over-image theme support** — confirm the theme token bag + section
  layout can express **edge-to-edge (breakout) full-bleed images** and **text overlaid on
  photography** with a legibility scrim, and that `font-heading` cleanly carries a **thin
  high-contrast display serif** at large sizes (the whole look leans on this — reuse the
  serif-theme finding from the New Yorker teardown, extended to a Didone-weight display).
