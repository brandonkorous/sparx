# The New Yorker — design study → `sparx-longform-literary`

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-06
**Reference:** The New Yorker — https://www.newyorker.com (Condé Nast hard-blocks automated capture — 403, same as Sephora in the commerce set; studied from the live archetype + knowledge; visual pass to `./images/`)
**Archetype:** Literary longform magazine — serif-driven editorial restraint, a curated front page of stories (not a firehose), a reading page tuned for essays.
**sparx slug:** `longform-literary` · **Example vertical:** essays & ideas magazine · **Theme:** bespoke — `broadsheet` (see §6; closest presets `press` / `atelier`)

> Faithfulness bar: **closest clone allowed** — mimic structure AND aesthetic feel,
> sparx components + branding only, no trademarked assets. See [README](../README.md).

## 1. Why this reference

The New Yorker is the defining **literary longform** publisher: a front page that reads
as a _curated table of contents_ rather than a live wire, and an **article page tuned
for reading an essay end to end** — controlled measure, generous whitespace, elegant
serif, illustration over photography. It anchors our content set as the **longform /
reading** archetype — the exact opposite discipline to TechCrunch's dense feed. Where
the feed optimises for scan-speed and recency, the New Yorker optimises for **voice,
authority, and time-on-page**: a single column at a comfortable measure, a rubric that
categorises the piece, a byline that matters, drop-in pull-quotes, and section fronts
(News, Culture, Fiction, Humor) that feel like magazine departments. It is the cleanest
study of how **serif type, restraint, and a controlled reading column** read as
quality — the template every magazine, essay site, think-tank, or literary journal
needs.

## 2. Screenshots

Captured to `./images/` (manual pass — automated capture is 403-blocked).

- `home-fold.png` — Front page top: slim serif wordmark masthead + horizontal department nav (News, Culture, Fiction, Humor, Puzzles), a **lead story** with illustration + rubric + serif headline + dek + byline, flanked/followed by a curated grid of secondary stories.
- `home-full.png` — Full front page: department blocks down the page (each a titled section — "The Talk of the Town", "Culture Desk", "Fiction") with 3–5 curated cards; hairline rules between departments; a newsletter/subscribe band; no infinite feed.
- `nav.png` — Header: centered/left serif wordmark, department nav, search + subscribe button (subscription is the visible conversion), mobile menu.
- `article.png` — **The reading page:** rubric (small caps), large serif headline, serif dek, byline + date + read-time, a lead illustration/photo with caption, then a **single centered column at ~40em measure** of serif body with drop caps or section breaks, **pull-quotes** set large in the margin/inline, generous line-height, a subscribe/paywall gate lower down.
- `department.png` — A department/archive front: section title + curated card list at a calmer density than a feed.
- `footer.png` — Footer: link columns (Sections, More, Newsletters, Follow, About/Legal), newsletter capture, copyright.

## 3. Design language

- **Palette:** **Paper, ink, and one editorial red.** Ground is a warm near-white / paper `#FBFAF7`; ink a true near-black `#0A0A0A`; a single **editorial red** `~#E60000` used sparingly on rubrics, the subscribe CTA, and hairline accents. Restrained, printerly, timeless. Color otherwise comes from **illustration** (the New Yorker's signature) rather than chrome.
- **Typography:** **Serif-led, the whole identity.** A high-contrast display serif for headlines + a readable text serif for body (the brand's Adobe Caslon / Irvin lineage). Rubrics and labels in small-caps with tracking; bylines in a quiet sans or small serif. Body is set at a **generous size and line-height** for sustained reading (this is a reading site, not a scanning site). The serif IS the voice.
- **Imagery:** **Illustration-first.** Editorial illustration and portraiture, not stocky product/news photography; art is often a single strong image per story with a caption. Restrained, tasteful crops; lots of surrounding air.
- **Shape & density:** **Zero/near-zero radius**, **hairline rules** as the primary divider (a printerly device), **low density** — few, curated stories with wide margins. The article column is **narrow and centered** (~38–42em) for measure control. No shadows, no cards-with-elevation — separation is rules + whitespace.
- **Motion:** **Almost none** — this is a reading experience. Maybe a subtle sticky subscribe bar and progressive paywall reveal. Restraint is the point.

## 4. Layout anatomy (top to bottom)

- **Announcement / utility bar:** Usually none, or a slim subscribe offer — restrained.
- **Header / nav:** Serif **wordmark masthead** (centered or left), a **horizontal department nav** (News, Culture, Fiction, Humor, Puzzles, Podcasts), search, and a prominent **Subscribe** button — subscription is the visible conversion. Sticky, solid, printerly.
- **Hero:** A **curated lead story**, not recency-driven: rubric + large serif headline + dek + byline + a strong illustration. One clearly-ranked story, then a curated secondary grid — the front page is an _editor's table of contents_.
- **Homepage section sequence** (this IS the blueprint's home composition):
  1. **Lead story** — illustration + rubric + serif headline + dek + byline (the ranked feature).
  2. **Secondary grid** — 3–6 curated stories (smaller, same anatomy) beneath/beside the lead.
  3. **Department blocks** — repeated per department (Talk of the Town, Culture Desk, Fiction, Humor): a section title + a hairline rule + 3–5 curated cards. Calm density.
  4. **Newsletter / subscribe band** — the conversion, styled in-voice.
  5. **Footer.**
- **Article anatomy** (the heart of this template): **rubric** (small caps) → **large serif headline** → **serif dek** → **byline + date + read-time** → **lead illustration + caption** → **single centered serif column at controlled measure** with drop cap / section breaks / inline images → **pull-quotes** set large → a **subscribe/paywall** gate → **related reading** at the foot. The reading column never widens to full-bleed — measure control is the whole point.
- **Archive / department:** a **department front** — section title + curated card list at reading-calm density (not a load-more firehose). Author pages = author bio header + their pieces.
- **Footer:** printerly **link columns** (Sections · More · Newsletters · Follow · About/Legal), newsletter capture, copyright.

## 5. Signature interaction patterns

1. **Serif-everything + controlled measure:** headlines and body both serif, the reading column pinned narrow and centered. Reproduce the serif pairing + measure and most of the "quality longform" feel comes free.
2. **Curated front, not a feed:** a clearly ranked lead + department blocks, low density, hairline rules — the front page reads as an editor's selection, the anti-TechCrunch.
3. **Rubric + pull-quote as editorial furniture:** the small-caps rubric that types each piece, and large inline pull-quotes that break the reading column — the two devices that make a page feel like a magazine.
4. **Subscribe as the primary conversion:** a visible subscribe button in chrome and an in-body gate — the content-business model surfaced as design.

## 6. The sparx translation

- **Theme:** **bespoke — `broadsheet`** (closest shipped: `press` / `atelier`). A **paper-ground, serif-across, one-red** editorial theme.
  - **Grounds (4 surfaces):** `base-100` page = `#FBFAF7` (warm paper); `base-200` muted ground = `#F1EFE9`; `base-300` hairline rules = `#E2DFD7`; `base-content` ink = `#0A0A0A`.
  - **Primary / accent strategy:** **one editorial red** `oklch(~55% 0.20 27)` used ONLY on rubrics, the Subscribe CTA, and hairline accents (AA-clean as small-caps text on paper and as a button fill with white ink — confirm via catalog-sweep). No second brand hue; illustration carries any other color.
  - **Fonts:** **display serif** (high-contrast, a Canela/Caslon feel) for headlines + rubrics; **text serif** (readable, Georgia/Source-Serif feel) for body at a generous size + line-height (comfortably above the 16px body floor — this is a reading site, lean to 18–19px). Bylines/labels in a quiet sans or small serif, small-caps + tracked. The serif pairing is the single most important token set.
- **Section mapping:**

  | New Yorker front-page band                 | sparx catalog key                                     |
  | ------------------------------------------ | ----------------------------------------------------- |
  | Header masthead + footer                   | `sparx_layout` (silica frame navbar/footer, serif)    |
  | Lead story (rubric + serif headline + dek) | **NEW: `lead_story`** (ranked feature, bound post)    |
  | Secondary curated grid                     | `blog_post_grid` _(editorial-card variant, serif)_    |
  | Department block (title + rule + cards)    | **NEW: `department_block`** (titled taxonomy section) |
  | Subscribe / newsletter band                | `newsletter_signup` _(subscribe-CTA variant)_         |

  **Article:** rubric + serif headline + dek + byline → `article_header` (serif/longform variant of the TechCrunch one — shared catalog add); centered measured body → **NEW: `article_body` with a `measure` (narrow) option**; **NEW: `pull_quote`** section; related → `blog_post_grid`. **Department front:** `collection_header` (content variant) + `blog_post_grid` at calm density.

- **Example business:** **The Meridian** — an **essays & ideas magazine** ("Writing worth your evening"). Seeds ~18 `cms.blog_post` records across departments — **Essays, Reporting, Fiction, Criticism, Notebook** — each a genuine longform piece (rubric, author, date, lead illustration, 8–14 paragraph body with a pull-quote and a section break), so the lead story, department blocks, article reading page, pull-quotes, and archives all render real. ~6 author records with bios + portraits. Taxonomy = the five departments + a few series tags. Optional light commerce: a **subscription / "become a member"** offer (demoing the subscribe conversion as real commerce), content still the spine.
- **Design freedom used (tenant-only affordances):** a **serif display + text-serif pairing** loaded by the tenant theme; a **narrow controlled reading measure** (not sparx's app-surface full width); illustration-first imagery. No shadow/glass/gradient needed — the look is paper + rules + serif, which sparx surfaces already permit; the tenant-only piece is purely the serif-across + measure.
- **Deliberate departures:** vertical stays a general ideas/essays magazine (avoids any one industry); no New Yorker wordmark, Irvin type, red, or "Talk of the Town" naming; the paywall gate is generalised to a subscribe band (we don't ship a hard paywall in the template).

## 7. Build notes / catalog gaps

Catalog additions (propagate once, never per-bundle inlines) — several of these are
**shared with the TechCrunch teardown**, so they land once in
[CATALOG-ADDITIONS](../CATALOG-ADDITIONS.md) and both templates use them:

- **`lead_story`** — a single ranked feature: bound `blog_post` → rubric + large headline + dek + byline + lead image, with a `size:'feature'` treatment distinct from a grid card.
- **`department_block`** — a titled, taxonomy-scoped section: department name + hairline rule + a small curated card list from that category. The magazine-department counterpart to TechCrunch's `section_rail` (confirm one section can serve both with a `density` prop).
- **`article_header`** (shared) — rubric + headline + dek + byline row; needs a **serif/longform variant** (larger serif headline, dek line) alongside the TechCrunch news variant.
- **`article_body` with `measure`** — the rich-text post render must support a **narrow centered measure** option (~40em) for longform, vs the feed article's comfortable-but-wider column. This is the single most important content-reading add.
- **`pull_quote`** — a large inline quotation that breaks the reading column (bound or authored). Pure editorial furniture; the commerce set never needed it.
- **Serif-everything theme support** — confirm the theme token bag + `font-heading` **and** `font-body` cleanly carry serifs and that the catalog-sweep AA passes for serif body at the raised reading size (the whole look leans on this, like Kith's serif display did — reuse that finding).
- **Subscribe-CTA `newsletter_signup` variant** — a "become a member / subscribe" framing of the existing capture band (copy + a stronger primary), for content businesses whose conversion is subscription not purchase.
