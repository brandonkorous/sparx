# National Geographic — design study → `sparx-immersive-photo`

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-06
**Reference:** National Geographic — https://www.nationalgeographic.com (structure captured 2026-08-06 via fetch; visual pass to `./images/`)
**Archetype:** Immersive photo-led storytelling — enormous full-bleed photography, scroll-driven photo essays with chaptered captions over images, a dark cinematic ground that makes the image pop, one bright frame accent, restrained type that yields to the picture.
**sparx slug:** `immersive-photo` · **Example vertical:** travel & photography journal · **Theme:** bespoke — `expanse` (see §6; closest presets `gallery` / `noir`)

> Faithfulness bar: **closest clone allowed** — mimic structure AND aesthetic feel,
> sparx components + branding only, no trademarked assets. See [README](../README.md).

## 1. Why this reference

National Geographic is the defining **immersive photojournalism** publisher: the image
is the story and the layout exists to get out of its way. Where TechCrunch optimises for
scan-speed and the New Yorker for the reading measure, Nat Geo optimises for **awe** — a
single frame at full-bleed, a dark cinematic ground that makes color and contrast leap,
and a signature reading experience (the **photo story**) that is a long scroll of
full-width image "chapters," each with a short caption block, the text always subordinate
to the picture. It anchors our content set as the **immersive / photo-led** archetype —
the exact discipline every travel publisher, science magazine, conservation nonprofit,
gallery, documentary studio, or photographer's journal needs, and the one none of the
other nine templates teach: **type that yields to the image**, not the other way around.

## 2. Screenshots

Captured to `./images/` (visual pass).

- `home-fold.png` — Top fold: logo-left masthead + horizontal category nav (Travel, Nature, Science, Photography, Animals, History), a **full-bleed photo-cover hero** — one enormous image with a category rubric + serif-lean headline + short dek + byline set over a bottom scrim, a small "Photo Story" badge.
- `home-full.png` — Full scroll: cover hero → "Latest Stories" curated card grid → a **featured photo-story rail** (wide image cards, read-time + photographer credit) → per-section blocks (Travel, Nature, Science, Photography) each 3–4 cards + a "See all" link → a **gallery strip** (Photo of the Day / Photo Ark-style grid) → magazine-issue promo → mission/impact band → newsletter.
- `nav.png` — Header + menu: horizontal section nav, search, subscribe; a dark translucent bar that goes solid on scroll; mobile hamburger → full section list.
- `photo-story.png` — **The signature reading page:** a full-bleed cover, then a sequence of **chapters** — each a full-width image (or image pair) with a short caption/paragraph block over a dark ground, scroll-revealed, the body text narrow and centered between the pictures. Photographer + writer credited at top; a related-stories rail at the foot.
- `article.png` — Standard feature: a **large image-led article hero** (big lead photo + rubric + headline + byline over/under it) then a single-column body with inline full-width images + captions, pull-quote, tags, related rail.
- `archive.png` — Category/archive: section masthead over a **photo-forward card grid** (image-dominant cards, minimal chrome), load-more.
- `author.png` — Photographer/writer page: portrait + bio + specialty, then their stories as a photo grid.
- `footer.png` — Footer on near-black: multi-column link map (Explore · The Magazine · Our Mission · Legal · Follow), newsletter capture, social row, copyright.

## 3. Design language

- **Palette:** **Dark cinematic ground, one bright frame accent.** The ground is a
  near-black photographic charcoal (`~#0B0D0F`) so photography carries all the color;
  ink is near-white; a **single bright accent** — a luminous solar amber/gold used as a
  **thin frame rule, active nav underline, category tag, and primary CTA**, never as a
  large filled panel. Color otherwise comes **entirely from the photographs**. Mood:
  expansive, expedition-grade, reverent, cinematic. (The accent is OUR hue direction — a
  thin luminous rule — explicitly **not** a recreation of any publisher's rectangular
  border mark; see §6 / §7.)
- **Typography:** **Restrained, image-subordinate.** A confident display face for
  headlines (a condensed high-impact sans or a lean display serif) + a clean readable
  sans for body and captions. Type is deliberately quiet next to the picture: headlines
  are large but few, captions are small and set on scrim, rubrics are small-caps + tracked.
  Hierarchy is scale + the image, not weight-density. The type never competes with the frame.
- **Imagery:** **The entire identity.** Full-bleed, art-directed, high-dynamic-range
  photography — landscape, wildlife, portrait, aerial. Crops are generous and cinematic
  (16:9, 2:1, full-viewport). Images bleed edge-to-edge; captions ride a bottom scrim or
  sit in a caption block between chapters. No stocky thumbnails — every image is a statement.
- **Shape & density:** **Zero/near-zero radius on full-bleed media**, small radius on
  chrome; **generous vertical rhythm** (each photo-story chapter is its own viewport
  moment); the accent frame is a **hairline** device (thin rule, thin frame around a
  featured image), never a heavy border. Separation is the image edge + ground shift, not
  cards-with-elevation — though tenant freedom permits a soft scrim/gradient over imagery
  for caption legibility (see §6).
- **Motion:** **Scroll-driven and signature.** The photo story is the motion: chapters
  fade/parallax in as they enter the viewport, captions reveal over images, the cover may
  hold a subtle Ken-Burns/parallax. Sticky-then-solid header. A lightbox on gallery grids.
  Restrained elsewhere — the scroll through the images is the experience.

## 4. Layout anatomy (top to bottom)

- **Announcement / utility bar:** Usually none, or a slim subscribe/expedition offer —
  restrained so it doesn't intrude on the cover image.
- **Header / nav:** Logo left; **horizontal section nav** (Travel, Nature, Science,
  Photography, Animals, History) as primary wayfinding; search + **Subscribe**; the bar is
  **dark translucent over the cover hero, solid on scroll**. Mobile hamburger → full list.
- **Hero:** A **full-bleed photo-cover** — one enormous image filling the fold, with a
  rubric + headline + short dek + byline set over a bottom scrim, and a "Photo Story" /
  read-time badge. One curated image, not a recency feed — the cover is an _invitation into
  a story_, chosen for its photograph.
- **Homepage section sequence** (this IS the blueprint's home composition):
  1. **Photo-cover hero** — full-bleed lead image + rubric + headline + dek + byline over scrim.
  2. **Latest Stories** — a curated **photo-forward card grid** (image-dominant cards, category tag, read-time, photographer credit).
  3. **Featured photo-story rail** — 2–3 wide image cards spotlighting long-scroll photo essays ("See the full story").
  4. **Section blocks** — repeated per section (Travel, Nature, Science, Photography): section title + 3–4 photo cards + a "See all" link to the archive.
  5. **Gallery strip** — a "Photo of the Day" / best-images grid opening a **lightbox** (pure image browsing, no headlines).
  6. **Magazine / issue promo** — current issue cover + a subscribe framing (light commerce hook).
  7. **Mission / impact band** — the nonprofit/expedition angle (explorers, conservation) — a full-bleed image + a short statement + CTA.
  8. **Newsletter** — capture band, styled in-voice on the dark ground.
  9. **Footer.**
- **Article anatomy** — TWO reading modes, both first-class:
  - **Photo story (signature):** full-bleed **cover** → a sequence of **chapters**, each a
    full-width image (or image pair) + a short caption/paragraph block on the dark ground,
    scroll-revealed; body text stays narrow and centered _between_ the pictures; photographer
    **and** writer credited at top; a **related photo-stories** rail at the foot. The image is
    always the chapter; the text annotates it.
  - **Standard feature:** a **large image-led article hero** (big lead photo + rubric +
    headline + byline) → single-column body at a comfortable measure with **inline full-width
    images + captions**, a **pull-quote**, tag chips, related rail. The conversion is
    subscribe, not a buy-box.
- **Archive / category:** a **section masthead** (section name + a short line + often a
  hero image) over a **photo-forward card grid** filtered to that taxonomy, load-more.
  Author (photographer/writer) pages = a **portrait + bio + specialty** header over their
  stories as a photo grid.
- **Footer:** **multi-column link map** on near-black (Explore · The Magazine · Our Mission
  · Legal · Follow), newsletter capture, social row, copyright.

## 5. Signature interaction patterns

1. **Full-bleed photo cover:** one enormous edge-to-edge image with type set over a bottom
   scrim — reproduce the cover + scrim + restrained headline and the "immersive" feel arrives
   before a word is read. This is the archetype's front door.
2. **The chaptered photo story:** a long scroll of full-width image "chapters," each with a
   short caption block, text always subordinate to the picture, revealed on scroll. This is
   THE reading experience of the template — the counterpart to the New Yorker's measured
   reading column, inverted so the image leads.
3. **Type yields to the image:** captions on scrim, small-caps rubrics, few large headlines —
   the layout's whole job is to frame photography, not decorate it. Restraint IS the design.
4. **The bright frame accent:** a single luminous hairline — active nav underline, category
   tag, the thin frame on a featured image, the primary CTA — the one non-photographic color
   on an otherwise dark+photo screen, so it reads as _the_ interactive signal.
5. **Gallery lightbox:** a pure-image grid that opens full-screen browsing (Photo-of-the-Day /
   Ark-style), letting photography stand entirely on its own with zero editorial chrome.

## 6. The sparx translation

- **Theme:** **bespoke — `expanse`** (closest shipped: `gallery` / `noir`). A **dark
  photographic, one-bright-frame** cinematic theme — the platform's only dark content ground.
  - **Grounds (4 surfaces):** `base-100` page = `#0B0D0F` (near-black photographic charcoal);
    `base-200` lifted card/section ground = `#14181C`; `base-300` hairline borders/dividers =
    `#262C32`; `base-content` ink = `#F4F5F6` (near-white). A warm-neutral `neutral` for
    quiet secondary chrome (`~#8A9198`). All four AA-clean: near-white ink on `#0B0D0F` clears
    comfortably; confirm the muted `neutral` caption tone stays **above** the readable floor
    on the dark ground (RULE #3 — captions are meta but must be read).
  - **Primary / accent strategy:** **one bright frame accent** — a luminous **solar amber**
    `oklch(~84% 0.15 88)` used ONLY as the thin frame rule, the active nav underline, category
    tags, and the primary CTA. It is a **hairline/frame** device on a dark ground, **never** a
    large filled rectangular border (that would ape a trademarked mark — see §7). AA: amber ink
    on near-black clears easily; for a filled-amber CTA use **dark ink** on the amber (the amber
    is a light tone, so its content token is `base-100`, not white). No second brand hue — the
    photographs carry every other color.
  - **Fonts:** **display** = a confident high-impact face (condensed display sans or a lean
    display serif) for the few large headlines + covers; **body/caption** = a clean readable
    sans (Inter/Source-Sans feel) for body, captions, bylines; rubrics small-caps + tracked.
    Body stays at/above the 16px floor; captions ≥14px and never faded below the ink floor. The
    type is deliberately quiet — the theme's job is to frame the image, so the pairing leans
    restrained, not expressive.
- **Section mapping:**

  | Nat Geo homepage / reading band                  | sparx catalog key                                        |
  | ------------------------------------------------ | -------------------------------------------------------- |
  | Header nav + footer (dark, translucent-on-cover) | `sparx_layout` (silica frame navbar/footer, dark)        |
  | Full-bleed photo-cover hero                      | **NEW: `photo_cover_hero`** (full-bleed image + scrim)   |
  | Latest Stories (photo-forward cards)             | `blog_post_grid` _(photo-card variant — image-dominant)_ |
  | Featured photo-story rail                        | `section_rail` _(photo-story variant, wide image cards)_ |
  | Section blocks (Travel/Nature/… + "See all")     | `department_block` _(shared add; photo density)_         |
  | Gallery strip → lightbox                         | **NEW: `gallery_lightbox`** (image grid + lightbox)      |
  | Magazine / issue promo                           | `newsletter_signup` _(subscribe variant)_ + `media_band` |
  | Mission / impact band                            | **NEW: `immersive_statement`** (full-bleed image + copy) |
  | Newsletter                                       | `newsletter_signup`                                      |

  **Photo story (signature reading page):** cover → **NEW: `photo_cover_hero`**; each chapter
  → **NEW: `photo_story_chapter`** (full-bleed image / image-pair + caption block, scroll-reveal);
  credits → `article_header` _(photo-story variant: photographer **and** writer)_; related →
  `blog_post_grid`. **Standard feature:** hero → **NEW: `image_led_article_hero`**; body →
  `article_body` (rich-text with inline full-width images + captions); quote → `pull_quote`
  (shared add); related → `blog_post_grid`. **Archive:** `collection_header` (content variant,
  with hero image) + `blog_post_grid` (photo-card) + load-more. **Author:** photographer/writer
  bio header (shared `article_header` author variant) + `blog_post_grid`.

- **Example business:** **Wayfarer** — a **travel & photography journal** ("Places, seen
  properly"). Seeds **~18** `cms.blog_post` records across four sections — **Travel, Nature,
  Science, Photography** — a deliberate mix of **photo stories** (long-scroll, 5–8 chapters
  each = full-bleed image + caption) and **standard features** (image-led hero + body +
  pull-quote), each with a category, byline, date, read-time, lead image, dek, and inline
  imagery, so the cover hero, latest grid, photo-story rail, section blocks, gallery lightbox,
  both reading modes, archives and author pages all render real. Indicative slate:
  - _Travel_ — "Twelve Hours in the Atacama"; "The Slow Road Through Kyushu"; "A Winter in
    Svalbard"; "Where the Danube Ends."
  - _Nature_ — "The Last Glaciers of the Rockies"; "Night of the Fireflies" (photo story);
    "Return of the Iberian Lynx"; "Tidepools at First Light."
  - _Science_ — "Mapping the Deep Reefs"; "What the Ice Cores Remember"; "Chasing the Aurora";
    "The Seed Vault at the Top of the World."
  - _Photography_ — "Photo of the Day" gallery set; "Portraits of the High Passes" (photo
    story); "Shooting the Milky Way, Frame by Frame"; "A Year in One Valley" (photo story);
    "The Craft: Long Exposure at Dusk."
  - **Authors:** ~6 photographer/writer records with **portrait, bio, and specialty**
    (wildlife, landscape, documentary, science) so bylines, dual photo-story credits, and
    author pages resolve.
  - **Taxonomy:** the four sections + a handful of tags (expedition, conservation,
    night-sky, portrait, aerial).
  - **Light commerce slice (content + commerce demo):** a small **prints shop** (a few
    fine-art print SKUs bound to the strongest photographs) **and** a **membership /
    subscription** offer — demoing commerce riding on a content spine. Content is the spine;
    the shop is a proof, not the point.
- **Design freedom used (tenant-only affordances):** this template leans hardest on
  [[feedback_design_restraints_are_sparx_only]] of any in the set — a **dark full-bleed
  photographic ground**, **edge-to-edge imagery**, **scrim/gradient overlays** on images for
  caption legibility, and **scroll-driven reveal/parallax** on the photo story are all
  tenant-blueprint affordances that sparx's own product surfaces (no-shadow / no-gradient /
  RULE #3) would forbid. Here they are the point: the gradient scrim under a cover caption and
  the parallax between chapters are core to the archetype, and the vocabulary-check does not
  flag them for tenant blueprints.
- **Deliberate departures:** vertical stays a general **travel & photography** journal (avoids
  any one industry, never diesel/auto); **no** National Geographic name, logo, typefaces,
  photography, or the trademarked **yellow rectangular border** — our accent is a **thin
  luminous solar-amber frame/rule**, a distinct hue direction used as a hairline, never a
  filled border rectangle used as a mark. The Disney+/TV-carousel and cruise-expedition
  commerce of the reference generalise to a single restrained **magazine/subscribe** promo +
  the optional prints slice; the mission band stays but is generic conservation/expedition copy.

## 7. Build notes / catalog gaps

Catalog additions (propagate once, never per-bundle inlines) — these are the **immersive /
photo-led** additions this template contributes to the
[CATALOG-ADDITIONS](../CATALOG-ADDITIONS.md) pass; several **reuse** shared adds from the
TechCrunch and New Yorker teardowns.

- **`photo_cover_hero`** (NEW) — a **full-bleed image cover**: bound `blog_post` → background
  image at full-viewport (or tall band) with a **bottom scrim** for legibility, over which sit
  a small-caps rubric + headline + short dek + byline + a "Photo Story" / read-time badge. The
  scrim is a tenant-only gradient overlay (allowed here). Serves both the homepage lead and the
  photo-story page's opening. This is the archetype's signature and the one the catalog most
  lacks — the commerce set's heroes were split/product, never full-bleed-image-with-scrim.
- **`photo_story_chapter`** (NEW) — the **chaptered photo-essay unit**: a full-width image (or
  an image-pair) + a short caption/paragraph block on the dark ground, **scroll-revealed**
  (fade/parallax via the behaviors runtime; static fallback when absent, matching the
  countdown/dismiss precedent). Repeatable N times down a photo-story page. Text is subordinate
  and narrow; the image is the chapter. No commerce equivalent exists — this is the core content add.
- **`gallery_lightbox`** (NEW) — an **image-grid → full-screen lightbox**: a masonry/uniform
  grid of images (bound to a photo/gallery source) that opens a full-screen browsing overlay
  with prev/next. Needs a lightbox behavior; static grid fallback (links to full images) when
  the behaviors runtime isn't present.
- **`image_led_article_hero`** (NEW) — a **large image-led feature hero** distinct from the
  full-bleed cover: a big lead photo with the rubric + headline + byline set **beside/under** it
  (not fully over it), for standard features that aren't full photo stories. A middle weight
  between `photo_cover_hero` and a grid card.
- **`immersive_statement`** (NEW) — a **full-bleed image + short statement + CTA** band for the
  mission/impact section (and reusable for any "big-image manifesto" moment). Tenant-only
  full-bleed + scrim; the conservation/expedition counterpart to a commerce "brand story" band.
- **`article_header` photo-story variant** (shared) — the shared `article_header` (from the
  TechCrunch/New Yorker adds) needs a **photo-story variant** that credits **both a photographer
  and a writer** (dual byline) plus a "Photo Story" rubric, alongside the news + longform variants.
- **`blog_post_grid` photo-card variant** (shared) — confirm the grid can render an
  **image-dominant** card (image fills the card, minimal chrome: category tag + read-time +
  photographer credit) as well as the feed and editorial variants — the same grid, a
  photo-forward density.
- **`section_rail` photo-story variant** (shared) — the TechCrunch `section_rail` needs a
  **wide-image-card** treatment for the "featured photo stories" rail (2–3 large image cards +
  "See the full story"), distinct from the text-dense news rail.
- **`article_body` inline full-width media** (shared) — confirm the rich-text render supports
  **inline full-width images + captions** breaking the reading column (the feature-page need),
  reusing the New Yorker `measure` work but allowing the image to break out to full-bleed.
- **Dark theme carriage** — confirm the theme token bag + navbar/footer cleanly carry a **dark
  base ground** with a **translucent-over-hero → solid-on-scroll** header, and that the
  catalog-sweep AA passes for near-white ink, muted captions, and the amber accent on
  `#0B0D0F`. `expanse` is the set's first dark content theme — the dark-ground plumbing it
  proves out is reused by the `console` (PlayStation.Blog) and `amp` (artist) teardowns.
- **Scrim/overlay affordance** — a sanctioned **gradient scrim over imagery** for caption
  legibility on `photo_cover_hero` / `photo_story_chapter` / `immersive_statement`. This is a
  tenant-blueprint-only affordance (sparx surfaces forbid gradients); document it as
  photo-caption legibility, not decoration, so it isn't mistaken for a sparx-surface violation.
