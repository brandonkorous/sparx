# Harvard Gazette — design study → `sparx-institution-news`

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-06
**Reference:** Harvard Gazette — https://news.harvard.edu (structure captured 2026-08-06 via fetch; visual pass to `./images/`)
**Archetype:** University / institutional newsroom — an authoritative, curated front with a serif headline voice, a navy + crimson institutional palette, strong department structure (Research, Campus, Health, Arts), a research-feature emphasis, and an events/announcements rail. Dignified and calm — the anti-firehose of the news set.
**sparx slug:** `institution-news` · **Example vertical:** university / campus newsroom · **Theme:** bespoke — `quad` (see §6; closest presets `press` / `broadsheet`)

> Faithfulness bar: **closest clone allowed** — mimic structure AND aesthetic feel,
> sparx components + branding only, no trademarked assets. See [README](../README.md).

## 1. Why this reference

The Harvard Gazette is the defining **institutional newsroom**: the official news office
of a large, storied organisation, publishing research findings, campus news, health and
science, and arts & culture to a mixed audience of faculty, students, alumni, press and
the public. It anchors our content set as the **institution / authority** archetype — the
template every university, hospital system, museum, foundation, government agency, or large
nonprofit needs when it stands up a newsroom. Where TechCrunch optimises for scan-speed and
recency, the Gazette optimises for **trust, credibility, and institutional voice**: a
curated (not auto-recency) front, a serif headline that reads as authority, department
sections that mirror the institution's real structure, an events calendar because the
institution is a _place_ with a life, and research/feature stories treated as the marquee
content rather than breaking wire. It is the cleanest study of how **serif type, a deep
institutional primary + an academic accent, and a strong department grid** read as _the
official voice of a serious organisation_ — restrained and calm, but far more structured and
department-driven than a literary magazine's front. It sits deliberately between TechCrunch's
density and the New Yorker's reading-room minimalism: **structured authority.**

## 2. Screenshots

Captured to `./images/` (manual visual pass).

- `home-fold.png` — Top fold: serif wordmark masthead + horizontal department nav (Research/Findings, Campus & Community, Health, Science & Tech, Nation & World, Arts & Culture), a slim featured-series/topics band ("America at 250", "Harvard Reads"), then a **lead-story region** — one large feature (research finding) with a strong editorial image, serif headline, dek + byline, flanked by 2–3 secondary stories.
- `home-full.png` — Full scroll: lead region → **department blocks** repeated per section (Campus & Community, Health, Science & Tech, Nation & World, Arts & Culture, Work & Economy), each a titled section with 3 recent stories (image + serif headline) and a "More in <section>" link → an **Events** calendar band (date + time + location rows) → a **Multimedia / Data Visualization** gallery band → newsletter/subscribe band → footer.
- `nav.png` — Header + menu: serif wordmark, horizontal department nav, search, and a hamburger that opens the full section list + featured topics/series + Events. Sticky, solid navy chrome.
- `article.png` — Single research/news feature: department **rubric** (small-caps) above a large serif headline, serif dek, **byline row** (author link + date + read-time), a lead editorial image + caption, a **single serif column at a comfortable measure** with inline images, blockquotes and a pull-quote, a "Related" rail, and a persistent **events / newsletter** aside on wider viewports.
- `department.png` — A department/archive front (e.g. Health): section masthead (name + short description) over a calm curated card grid + load-more, calmer density than a feed.
- `author.png` — Author/contributor page: portrait + name + role/affiliation + bio, then their stories as a card grid.
- `events.png` — Events index: a chronological list of upcoming campus events, each with date/time/location and a detail link — the institution-as-place module.
- `footer.png` — Footer: multi-column link map (Explore the Gazette · Featured Series · Sections · About/Media Relations · Follow), newsletter capture, social row (Instagram/LinkedIn/YouTube/…), legal/utility bar (Accessibility, Privacy, Trademark).

## 3. Design language

- **Palette:** **Deep institutional navy + an academic crimson accent, on paper-white.** Page ground a clean warm white `#FCFBF9`; ink a near-black `#141518`; the **primary is a deep institutional navy** `~#132A4E` carrying the chrome (masthead, department rules, footer) and section furniture; the **accent is an academic crimson** `~#9E1B32` used sparingly on rubrics, links, the active nav marker, and the primary CTA. This is the signature **navy-primary + crimson-accent** institutional pairing — _two_ brand colours (unlike the single-accent feed/literary themes), because the authority read comes from the deep navy chassis and the crimson is the sparing highlight on top of it. Mood: authoritative, trustworthy, established, calm. Color otherwise comes from **editorial photography** (scholar portraits, campus scenes), not chrome.
- **Typography:** **Serif headlines, sans body — the classic institutional pairing.** A high-contrast **display serif** for headlines, rubrics and department titles (the authority voice); a clean, highly-legible **sans** for body, bylines, meta and UI (the readability workhorse). This serif-head/sans-body split is the defining institutional-news signature — distinct from the New Yorker's serif-across reading room. Rubrics/labels are small-caps + tracked; headlines are 2–3 lines, generous but not literary-huge; body is set at a comfortable reading size (≥16px floor, lean 17–18px for feature bodies).
- **Imagery:** **Editorial photography-first.** Portraits of researchers/scholars, campus scenes, and thematic photo-illustration — high quality, art-directed, one strong image per story, always with a caption/credit. A dedicated multimedia/data-visualization strand (charts, explainers) is part of the identity. Not stocky; not illustration-led like the New Yorker.
- **Shape & density:** **Small radius**, **hairline rules** and **base-tone shifts** as the primary dividers (a printerly, institutional device), **medium density** — more structured and packed than a literary front, calmer than a feed. A strong **department grid** (3-up cards per section) is the backbone. Navy section rules and small-caps department titles carry the structure. Shadows are minimal; separation is rules + ground shifts + the navy chassis.
- **Motion:** **Restrained** — sticky header, a subtle sticky aside (events/newsletter) on the article, load-more on archives, an events calendar that filters by upcoming. No hero carousels or auto-play; the authority read forbids anything flashy. Institutional calm is the point.

## 4. Layout anatomy (top to bottom)

- **Announcement / utility bar:** Usually a slim **featured-series / topics strip** ("America at 250", "Harvard Reads", "Experience") rather than a promo — a curated set of standing initiatives, not a sale. Institutional, not commercial.
- **Header / nav:** Serif **wordmark masthead** left; a **horizontal department nav** (Research/Findings · Campus & Community · Health · Science & Tech · Nation & World · Arts & Culture · Work & Economy) as primary wayfinding; search + a hamburger that opens the full sections + featured series + Events. Sticky, solid **navy** chrome — the deep primary IS the header.
- **Hero:** A **curated lead region**, not recency-driven: one large ranked **feature** (typically a research finding) — strong image + department rubric + large serif headline + dek + byline — with 2–3 secondary stories beside/below it. The front is an _editor's selection_, signalling institutional priorities, not "newest first."
- **Homepage section sequence** (this IS the blueprint's home composition):
  1. **Featured series / topics strip** — a slim curated band of standing initiatives (bound to a "featured/series" taxonomy or pinned posts).
  2. **Lead region** — one ranked feature (research finding) + 2–3 secondary stories. The marquee.
  3. **Research spotlight** — a dedicated **research-feature block**: the institution's flagship content type surfaced on its own (finding + researcher + school/department tag), because research _is_ the newsroom's headline product. (This is the institution-specific add — see §7.)
  4. **Department blocks** — repeated per section (Campus & Community, Health, Science & Tech, Nation & World, Arts & Culture, Work & Economy): a **navy small-caps section title + rule + 3 recent cards** + a "More in <section>" link. The structured backbone.
  5. **Events band** — an **upcoming-events list** (date + time + location + link): the institution-as-place module, a defining difference from a pure feed.
  6. **Multimedia / Data-Visualization gallery** — a band of visual/interactive stories (photo essays, charts, explainers).
  7. **Newsletter / subscribe band** — the conversion (subscribe to the Gazette), in institutional voice.
  8. **Footer.**
- **Article anatomy** (the "PDP" of this publisher): department **rubric** (small-caps) → **large serif headline** → **serif dek** → **byline row** (author link + affiliation + date + read-time) → **lead image + caption/credit** → **single serif-headed, sans-body column** at a comfortable measure with inline images, blockquotes, a **pull-quote**, and (for research) a "the study / the finding" call-out → **tag / school chips** → **Related reading** rail → a persistent **events + newsletter aside** on wider viewports. Conversion is subscribe, not purchase. Research features may carry a **source/citation footer** (journal, DOI-style reference) as an institutional trust signal.
- **Archive / department:** a **section masthead** (department name + short description) over a calm curated card grid, **load-more / pagination**. Author pages = a **contributor header** (portrait + name + role/affiliation + bio) over that author's stories. A **topics/schools directory** page maps the taxonomy (schools, topics, series) as a browsable index — the institutional site-map affordance.
- **Footer:** **multi-column link map** (Explore the Gazette · Featured Series · Sections · About / Media Relations · Follow), newsletter capture, social row, legal/utility bar (Accessibility · Privacy · Trademark) — institutions carry more legal/utility links than a magazine.

## 5. Signature interaction patterns

1. **Serif-head / sans-body + navy chassis:** the institutional authority read comes from the serif headline voice sitting on a deep-navy chrome with a sparing crimson highlight. Reproduce the type split + the two-colour chassis and the "official newsroom" feel comes for free — it is _not_ a single-accent theme.
2. **Department grid as the backbone:** the front is a set of **titled department blocks** (navy small-caps title + rule + 3 cards + "More in X"), each mirroring a real part of the institution. The site reads as a directory of the organisation's areas, not one funnel.
3. **Research as the marquee content type:** a dedicated **research-spotlight** treatment (finding + researcher + school) elevates the institution's flagship output above ordinary news — the thing a university newsroom has that a general feed doesn't.
4. **The institution is a place — Events:** an **upcoming-events calendar band** on the home page and an events index, because an institutional newsroom covers a physical, living campus. This module is a defining difference from every other content template in the set.
5. **Curated, calm front:** a clearly-ranked lead + department blocks at medium density — an editor's selection signalling institutional priorities, never an auto-recency river. Trust over velocity.

## 6. The sparx translation

- **Theme:** **bespoke — `quad`** (closest shipped: `press` / `broadsheet`). A **paper-ground, navy-primary + crimson-accent, serif-head / sans-body** institutional theme.
  - **Grounds (4 surfaces):** `base-100` page = `#FCFBF9` (warm paper white); `base-200` muted card/section ground = `#F1EFEA`; `base-300` hairline rules / borders = `#E0DDD5`; `base-content` ink = `#141518`. (The deep navy is the _primary_, not a ground — the chassis/chrome paint navy via `--color-primary`, the page stays paper.)
  - **Primary / accent strategy:** **two brand colours — a deep institutional navy primary + an academic crimson accent** (the distinguishing move vs. the single-accent feed/literary themes). Primary navy `oklch(~30% 0.07 255)` (≈ `#132A4E`) carries the masthead, footer, department rules, section titles, and default buttons — AA-clean as a chrome fill with white ink and as heading ink on paper. Accent crimson `oklch(~45% 0.16 20)` (≈ `#9E1B32`) is used **sparingly** on rubrics, links, the active department marker, the "More in X" links, and the primary subscribe CTA — AA-clean as small-caps text on paper and as a button fill with white ink. Registered as `--color-primary` (navy) + `--color-accent` (crimson); confirm both clear the catalog-sweep AA at rubric/link/button sizes. No third brand hue — photography carries any further colour; status uses the semantic axis (`statusTone`).
  - **Fonts:** **display serif** (high-contrast, a Canela/Freight/Tiempos feel) for headlines, deks, rubrics and department titles — the authority voice; **clean sans** (a Söhne/Inter/Public-Sans feel) for body, bylines, meta, events and UI — the readability workhorse. Body at a comfortable reading size (≥16px floor; lean 17–18px on feature bodies). Rubrics/labels small-caps + tracked, in crimson. This **serif-head / sans-body** pairing is the single most important token set and the defining difference from the New Yorker's serif-across theme.
- **Section mapping:**

  | Harvard Gazette homepage band                         | sparx catalog key                                             |
  | ----------------------------------------------------- | ------------------------------------------------------------- |
  | Header masthead + footer (navy, serif wordmark)       | `sparx_layout` (silica frame navbar/footer, serif + navy)     |
  | Featured-series / topics strip                        | `section_rail` _(pinned/featured-taxonomy variant)_           |
  | Lead region (ranked feature + secondaries)            | `lead_story` _(shared add)_ + `blog_post_grid` (secondaries)  |
  | Research spotlight (finding + researcher + school)    | **NEW: `research_feature`** (institution-specific — see §7)   |
  | Department block (navy title + rule + 3 cards + More) | `department_block` _(shared add; navy/institutional variant)_ |
  | Events band (date + time + location)                  | `event_list` _(shared add — Events module)_                   |
  | Multimedia / Data-Visualization gallery               | `blog_post_grid` _(media-tagged / gallery variant)_           |
  | Newsletter / subscribe band                           | `newsletter_signup` _(subscribe-CTA variant)_                 |
  | Topics / schools directory (archive index)            | **NEW: `taxonomy_directory`** (schools/topics index — §7)     |

  **Article:** department rubric + serif headline + dek + byline → `article_header` (serif/institutional variant of the shared add); measured body → `article_body` (comfortable, not narrow-literary, measure); pull-quote → `pull_quote` _(shared add)_; research citation footer → **NEW: `source_citation`** (optional, research variant — §7); related → `blog_post_grid`; sticky aside → `event_list` + `newsletter_signup` in the `content_with_sidebar` shell. **Department front:** `collection_header` (content variant) + `blog_post_grid` at calm density + load-more. **Author:** `author_header` (portrait + role/affiliation + bio) + `blog_post_grid`. **Events index:** `event_list` (full-page, chronological).

- **Example business:** **Northgate University** — a mid-size public research university's official **campus newsroom** ("News, research, and life at Northgate"). Seeds **~18 `cms.blog_post` records** across departments — **Research/Findings, Campus & Community, Health, Science & Tech, Nation & World, Arts & Culture** (≈3 per department) — a realistic mix of a marquee **research finding** (with a researcher, a school/department tag, and a source-citation footer), a campus-life story, a health study, a science explainer with a data-viz tag, an arts feature, and a policy/community piece. Each carries a department rubric, author, date, read-time, lead photo + caption, a 6–12 paragraph body with a pull-quote and an inline image, so the lead region, research spotlight, department blocks, multimedia gallery, article reading page, archives and author pages all render real. **~6 author records** — a science writer, a health editor, a campus-life reporter, a communications staffer, plus 1–2 **faculty contributors** with role/affiliation + portrait + bio (so bylines and author pages resolve with institutional credibility). **~8 `event` records** (a public lecture, a symposium, a concert, a career fair, an exhibition opening, a commencement-week item, an alumni webinar, a research-showcase) with date/time/location, populating the home Events band and the Events index — this template is the set's exerciser of the **Events module**. **Taxonomy** = the six departments + a **schools** facet (Arts & Sciences, Medicine, Engineering, Business, Public Health) + a handful of **series/topics** tags (the "featured series" strip) — feeding the department blocks and the topics/schools directory. **Optional light commerce slice:** a small **giving / alumni store** (a "Support Northgate" giving CTA + a few branded-merch SKUs) to demo content **and** commerce on one institutional site — content is unambiguously the spine.
- **Design freedom used (tenant-only affordances):** a **serif-head / sans-body pairing** and a **two-colour navy-primary + crimson-accent** chassis loaded by the tenant theme; **editorial photography-first** imagery; a **navy solid-fill masthead/footer** (a deep coloured chrome the sparx app surfaces would keep neutral, but a tenant site is free to). No shadow/glass/gradient is required — the look is paper + navy chassis + serif + rules, all of which sparx tenant surfaces already permit. The tenant-only pieces are purely the serif-head/sans-body pairing, the two-brand-colour chassis, and the coloured chrome.
- **Deliberate departures:** vertical stays a **generic mid-size university** (Northgate) — never Harvard, never the auto/diesel or any single running-example industry; no Harvard wordmark, shield, "Veritas"/motto marks, exact trademarked crimson, or Harvard typefaces — **navy + crimson is used as a _generic academic direction_, not Harvard's specific brand.** Department names are common-noun institutional sections, not Harvard's exact nav labels. The events calendar is a general campus-events module (no Harvard event branding). The paywall/membership is generalised to a subscribe + optional giving CTA (institutions rarely hard-paywall; the conversion is subscribe + support).

## 7. Build notes / catalog gaps

Catalog additions (propagate once, never per-bundle inlines). Most of what this template
needs is **shared with the TechCrunch and New Yorker teardowns** and lands once in
[CATALOG-ADDITIONS](../CATALOG-ADDITIONS.md); this doc contributes the **institution-specific**
additions on top.

**Reused from the shared content adds (no new work beyond a variant):**

- **`lead_story`** (shared) — the ranked feature region; reused for the home lead. Institutional variant just carries the serif/navy furniture.
- **`department_block`** (shared) — the titled taxonomy section (title + rule + curated cards + "More in X"). This template is a heavy user; confirm a **navy small-caps title + crimson "More" link** variant and that the same section serves a 3-up card density.
- **`article_header`** (shared) — rubric + headline + dek + byline row; reuse the **serif/longform variant** from the New Yorker add (the institutional look is serif-head/sans-body, so headline serif + byline sans — confirm the variant lets byline/meta render in the body sans while the headline/rubric stay serif).
- **`article_body`** (shared) — reuse at a **comfortable** measure (wider than the New Yorker's narrow literary measure, narrower than the feed's full width) — an institutional feature reads long but not literary-narrow.
- **`pull_quote`** (shared) — reused as-is.
- **`newsletter_signup` subscribe-CTA variant** (shared) — reused for the Gazette-style subscribe band.
- **`section_rail`** (shared) — reused for the slim **featured-series / topics strip** (a pinned/featured-taxonomy variant — confirm it can bind to a "featured/series" taxonomy or a pinned-post set, not only a category's recency).
- **`event_list`** (shared) — the Events module band + full-page index (date + time + location + link, bound to an `event` source, upcoming-filtered). This template is the set's primary **Events** exerciser; confirm the source + an upcoming filter + a full-page chronological variant exist.
- **`content_with_sidebar` layout** (shared) — the article's persistent events + newsletter aside reuses the same wide-content + narrow-sticky-sidebar shell TechCrunch introduced.
- **`author_header`** (shared, if not already added) — portrait + name + role/affiliation + bio over an author's post grid; the institutional variant surfaces **affiliation/role** (faculty vs staff) prominently.

**New, institution-specific (this doc introduces them):**

- **`research_feature`** — a research-spotlight block: a bound `blog_post` (or a `finding`-tagged post) rendered as **finding headline + researcher(s) + school/department tag + a short "what they found" dek**, distinct from a plain feature card. The marquee content type a university/hospital/lab newsroom has that a general feed doesn't. Binds `title`, `author` (researcher), a `school`/`department` taxonomy value, and dek. Reusable by any research-driven institution.
- **`taxonomy_directory`** — a browsable index of a taxonomy dimension (schools, topics, or series) rendered as a grid/list of linked facet tiles with counts — the institutional site-map affordance (a "browse by school / by topic" page). Generic over any taxonomy, so it also serves government/museum/foundation sites.
- **`source_citation`** — an optional article-footer block for a research feature: a structured **journal / publication / reference** citation (title, venue, date, link) rendered as an institutional trust signal at the foot of a study write-up. Bound or authored; degrades to nothing when a post has no citation.

**Theme / token work:**

- **Two-brand-colour theme support** — confirm the theme token bag cleanly carries **both** `--color-primary` (navy chassis) **and** `--color-accent` (crimson highlight) as first-class brand colours, and that catalog sections reference the right one (chrome/rules = primary, rubrics/links/active-marker/CTA = accent). The single-accent feed/literary themes only exercised one; this is the first content theme to lean on a **navy-primary + crimson-accent pairing**, so verify the section furniture picks up primary-vs-accent correctly and both clear the catalog-sweep AA (navy fill + white ink; crimson small-caps on paper; crimson button fill + white ink).
- **Serif-head / sans-body pairing** — confirm `font-heading` (serif) and `font-body` (sans) resolve independently in the theme and that headlines render serif while body/byline/meta render sans (the New Yorker add proved serif-across; this proves the _split_). Reuse the serif-loading + AA finding from the New Yorker teardown.
