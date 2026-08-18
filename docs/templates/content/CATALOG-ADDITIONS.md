# Content catalog additions — consolidated from all 10 WordPress design docs

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-06

The ten **content** studies (the WordPress set) independently converged on a set of
**reusable, content-side catalog additions** — the article/feed/archive/author patterns
the [commerce set](../CATALOG-ADDITIONS.md) never needed. Building these once (in
`@wizeworks/silica-catalog` sections + `SPARX_CATALOG`, and where interactive,
`@wizeworks/silicaui-behaviors`) unlocks all ten content templates AND serves real CMS
tenants — never inline an article header or a feed per bundle. This is the content-side
Phase-2a work the ten blueprints build on.

Legend — **[S]** static composition (ships today via silica classes) · **[B]** needs an
interactive behavior (silicaui-behaviors hydration) · **[T]** theme/token work · **[N]**
genuinely new section · **[P]** depends on a **platform** capability (schema field, render
allowlist) outside the catalog.

> **The de-dup principle.** Ten docs proposed ~45 section names; most collapse into a
> handful of **moded systems** (one hero with modes, one grid with variants, one
> structured-list with columns), exactly like the commerce set collapsed everything into
> `offer_hero` + `buy_box` + `products`. Build the systems, not the 45 names.

## A. Article identity — one `article_header` system [S]

The publisher counterpart to the commerce `buy_box` identity block. One section, moded:

- **rubric/category** + **headline** + optional **dek** + **byline row** (author link + avatar + relative date + read-time). Binds `title`, `category`, `author`, `publishedAt`.
- **variants:** `news` (compact, sans — TechCrunch) · `longform` (large serif headline + dek — New Yorker, Harvard) · `bold`/`full-bleed` (condensed headline over image — Rolling Stone, PlayStation, Sony) · `photo-led` (image-led hero variant — Vogue `article_hero`, Nat Geo `image_led_article_hero`). The `full-bleed`/`photo-led` variants **merge with the hero system (§C)** — an article header over a cover image IS a media hero.
- **extensions:** `role`-line + comment-count (PlayStation) · issuing-**department** in place of author (civic) · researcher + school (Harvard `research_feature` is `longform` + a credit line).
- **Author/speaker/department header** — the archive-of-one-author page top: bio + portrait + their posts. One section, `author` | `speaker` (TED `speaker_bio`) | `department` (civic) modes.
- **Needed by:** all 10.

## B. Feed & index — one `blog_post_grid` system + the sidebar modules [S]/[B]

The homepage/archive river. One grid, variants + a few sibling modules:

- **`blog_post_grid` variants:** `feed-card` (image + colored **tag** + byline + **relative timestamp** — TechCrunch) · `editorial-card` (serif, calm — New Yorker, Harvard) · `photo-card` (image-dominant — Vogue, Nat Geo) · `cover-card` (dark, big cover art — PlayStation, Sony). Add the tag + timestamp slots if the current grid lacks them.
- **`lead_story`** **[N]** — a single ranked feature (bound post, `size:'feature'`), distinct from a grid card — New Yorker, Harvard, PlayStation `cover_feature`.
- **`headline_list`** **[N]** — imageless post list (tag + headline + byline, hairline-divided) for fast scanning — TechCrunch "Top Headlines".
- **`section_rail` / `department_block`** **[N]** — one taxonomy-scoped section (category title + rule + a small card list + "See More"), unified by a **`density`** prop: `rail` (TechCrunch) vs `department` (New Yorker/Harvard). PlayStation `launch_feed` is this with a launch-cadence sort.
- **`most_popular`** **[N]** — ranked/numbered sidebar list (needs a `popular` post source; falls back to `recent`).
- **`category_chip_row`** **[N] [B]** — a horizontal taxonomy-filter chip row over a feed — PlayStation, Rolling Stone.
- **Needed by:** all 10 (each picks grid variant + which sidebar modules).

## C. Media hero — one `cover_hero` system with modes [S]/[B]

Seven proposed hero names (`cover_story`, `cover_feature`, `photo_cover_hero`,
`feature_band`, `media_hero`, `talk_hero`, `article_hero`) are **one moded system** — the
content counterpart to commerce `offer_hero`:

- **media:** `image` (full-bleed) · **`video`** (muted autoplay key-art — Sony, PlayStation, TED, Rolling Stone) **[B] [P]** · **key-art**.
- **overlay:** headline/rubric/byline set **over** the media with a **scrim** for legibility (a tenant-only affordance — the scrim gradient is sanctioned on tenant sites).
- **binds** a `blog_post` (or a talk/release record) so the hero features live content.
- **modes:** `cover` (magazine cover, type-over-image — Vogue) · `feature` (lead story overlaid — Rolling Stone, PlayStation) · `photo` (full-bleed photo essay open — Nat Geo `photo_cover_hero`) · `media` (video/key-art — Sony `media_hero`, TED `talk_hero`).
- **Needed by:** Vogue, Rolling Stone, Nat Geo, PlayStation, TED, Sony (and any photo-led article via §A).

## D. Longform & reading — `article_body` + editorial furniture [S]

- **`article_body`** (rich-text render of the post) with a **`measure`** option (narrow ~40em centered for longform — New Yorker; comfortable-wide for news) and an **image-interleave** mode (Vogue, Nat Geo). The single most important content-reading add. **[P]** rich-text render fidelity.
- **`pull_quote`** **[N]** — large inline quotation breaking the reading column — New Yorker, Rolling Stone, Harvard.
- **`source_citation`** **[N]** — a research/trust footer (sources, DOI, dept) — Harvard.
- **Structured body variants** (all **[N]**, same "labelled stacked blocks" idea): `transcript_block` (Details/Transcript/Notes tabs — TED) · `release_detail` (tracklist/credits — Sony) · `service_steps` ("how do I…" numbered steps — civic). Confirm one tabbed/stacked primitive serves all three.
- **`immersive_statement`** **[N]** — a full-bleed pull-statement between photo chapters — Nat Geo.
- **Needed by:** New Yorker (core), all article pages.

## E. Photo storytelling & galleries — one gallery/lightbox system [S]/[B]

- **`photo_story_chapter`** **[N]** — the chaptered scroll-reveal unit (full-bleed image + caption block), the Nat Geo photo-essay spine. **[B]** scroll-reveal (static = stacked full-bleed).
- **gallery/lightbox** — `lookbook_gallery` (Vogue), `gallery_lightbox` (Nat Geo), `media_gallery` (Sony) are **one** uniform image grid → full-screen viewer. **[B]** lightbox (the existing Lightbox island covers this).
- **Needed by:** Nat Geo (core), Vogue, Sony.

## F. Talks / media hub [S]/[B]/[P]

- **`talk_card_grid`** **[N]** — poster + play button + **duration** badge + speaker — TED.
- **`featured_talk`** **[N]** — spotlight a single talk (merges with §C media hero).
- **`media_embed`** — inline third-party player in article or hero — TED, Rolling Stone, PlayStation, Sony. **The `Embed` component already exists** in silicaui-html (category `media`) and frames YouTube / Vimeo / Google Maps; a _raw_ `<iframe>` still floors to `<div>`, so author via `Embed`, never a raw iframe. So this is **[S]** for video/maps — NOT a build-from-zero. Two caveats: (1) six framing-correctness bugs are already filed (Shorts / `/live/` / `/v/`, Vimeo channels-groups + unlisted hash, `?t=` + playlists, maps-passthrough, empty-url placeholder leaking to visitors); (2) **audio/music providers are the one real gap** — `Embed`'s provider list is video+maps only, so Spotify / SoundCloud / Apple Music+Podcasts / Bandcamp fall to plain links (the Shorts failure mode, one media family over). Needed by **Rolling Stone** + **Sony** (a track/album player is a music mag's & an artist's signature inline unit) → **[P]** add music-provider framing to `Embed` (see §K). Self-hosted `<video>`/`<audio>` need nothing — both are already in the `toHtml` allowlist with `autoplay/loop/muted/playsinline/poster`, so Sony's full-bleed background-video hero rides the commerce set's proven `videoBackdrop` pattern.
- **`topics_browse`** **[N]** — a topics/themes browse block — TED (overlaps Harvard `taxonomy_directory`).
- **Needed by:** TED (core), + `media_embed` by Rolling Stone/PlayStation/Sony.

## G. Structured record lists — one bindable `record_list` [S]

Several docs want a **list of structured, dated records** with columns + an action link —
one bindable primitive, not four:

- **`tour_dates`** (date · venue · Tickets — Sony) · **`event_list`** (date · title · RSVP — Harvard, TED, civic meetings) · **`notices_list`** (date · type-tag · title · PDF — civic public records) · **`discography_grid`** (Sony releases — a grid mode of the same).
- Binds a structured content type (event / tour-date / notice / release). **[P]** those content types (see §K).
- **Needed by:** Sony, Harvard, TED, civic.

## H. Civic / service surfaces [S]

The civic template is service-first, so it adds a cluster the others don't:

- **`alert_banner`** **[N]** — a state-aware emergency/notice strip (severity color) — civic.
- **`services_grid`** **[N]** — "how do I…" task cards — civic.
- **`directory_grid` / `taxonomy_directory`** **[N]** — departments (civic) / schools + topics (Harvard) browse — one directory primitive, two data sources.
- **`contact_block`** **[N]** — hours/phone/address/map — civic (reusable everywhere).
- **Accessibility is the archetype's headline:** skip-links, visible focus rings, AA/AAA contrast, plain language, RULE #3 readable ink — treat as a **[T]/[P]** gate on the whole civic template, not a section.
- **Needed by:** civic (core), Harvard (directory).

## I. Content → commerce bridges [S]

Where a publisher monetises, one section ties content to a light commerce slice — the
literal "content **and** commerce on one site" demo:

- **`streaming_links`** (buy-box-style row of outbound links — Sony) · **`product_crosslink_rail`** (posts → shop products — PlayStation) · **shop-the-look** `product_grid` variant (Vogue) · tickets strip (Rolling Stone/Sony).
- Reuses the commerce `products`/`product_card` catalog; the bridge is a content-page section that binds a commerce source.
- **Needed by:** Vogue, Rolling Stone, PlayStation, Sony (all seed a light commerce slice).

## J. Conversion & community bands [S]/[B]

- **`newsletter_signup` variants** — `subscribe`/membership (New Yorker, Vogue) · **`donate_band`** (nonprofit — TED) · fan signup (Sony). One capture band, moded copy + primary.
- **`social_band`** **[N]** — follow/social strip — PlayStation, Sony.
- **`comments_block`** **[N] [B] [P]** — community comments on a post — PlayStation (a real newsroom signal; likely v2 — needs a comments backend).
- **Needed by:** all (subscribe/donate); PlayStation/Sony (social/comments).

## K. Platform / data-model implications [P]

The content set stresses things beyond the catalog — flag these early:

- **`cms.blog_post` `format` discriminator** — one post model carries **talk** vs **prose** (TED) and **news** vs **feature**; add nullable `duration` / `speakerId` / `posterUrl` / `videoEmbedUrl` / `transcript` fields rather than a parallel model.
- **Structured content types** — event / tour-date / public-notice / release / **podcast-episode** (№ · title · date · duration · audioUrl · notes) records for §G (either dedicated CMS content-types or a flexible record with typed fields). A podcast **show page** is a `record_list` of episodes; each episode plays via self-hosted `<audio>` (already allowlisted) or an `Embed`.
- **Media embeds — mostly ALREADY covered, one real gap.** The `Embed` component exists and frames YouTube/Vimeo/Maps (raw `<iframe>` floors to `<div>` — use `Embed`), and `<video>`/`<audio>` are already in the allowlist. So the only platform ask is **music/audio + podcast provider framing in `Embed`** — Spotify (music + podcasts) / SoundCloud / Apple Music + Apple Podcasts / Bandcamp (optionally the podcast hosts Simplecast / Megaphone / Transistor / Buzzsprout) — needed by Rolling Stone + Sony (+ podcast content on TED / New Yorker / PlayStation); plus the six video/maps framing-correctness fixes already filed. (Earlier this doc claimed `toHtml` "drops iframe/video" and a new node must be built — that was wrong; verified against the live `Embed` component + the allowlist 2026-08-06.)
- **`popular` post source** for `most_popular` (analytics-backed; falls back to `recent`).
- **Relative-timestamp rendering** ("3 hours ago") — a bind-time formatter, not a static string.

## L. Theme/token coverage [T]

The ten bespoke **content** themes stress the token bag + catalog-sweep AA in new ways —
confirm each clears the sweep:

- **serif-across / serif-head + sans-body** — `broadsheet` (New Yorker), `runway` (Vogue), `quad` (Harvard).
- **no registered accent** — `runway` (B/W, chroma from photography only; sweep must treat as intentional, like SKIMS did).
- **dark content grounds** — `amplitude` (Rolling Stone), `expanse` (Nat Geo), `console` (PlayStation), `amp` (Sony) — the content set's first dark defaults; confirm readable ink + accent AA on near-black.
- **two-brand-color** — `quad` navy primary + crimson accent (the prior single-accent themes never stressed a two-color chassis).
- **duotone neon** — `amp` magenta + cyan (Sony) on dark.
- **AAA-civic** — `agency` federal-blue at AAA + severity accents + the accessibility gate (§H).
- **light single-accent** — `dispatch` emerald (TechCrunch), `podium` coral (TED).

---

## Build-order implication

The bulk is **[S]** static silica composition — **A, B, C(image mode), D, E(static), G, H, I,
J** cover most "closest clone" fidelity with zero runtime, and are the content-side
counterpart to the commerce set's static majority. The **[B]** interactive items (category-chip
filters, scroll-reveal photo chapters, lightbox, video heroes, comments) layer behaviors after —
each template still reads faithfully statically (a video hero shows its poster, a photo chapter
stacks, a chip row shows all). The **[P]** platform items — chiefly the **sandboxed media-embed
node** and the **`format`/structured content types** — are the real gate: they're the few things
a blueprint genuinely cannot fake, so they lead the build. **[T]** theme work is per-blueprint,
gated by the catalog-sweep AA test.

**Decision to confirm (mirrors the commerce set):** build the **[B]** behaviors for full
interactive fidelity in v1, or ship the **[S]** static approximation first and layer behaviors
after — no template is blocked on a runtime, but four ARE blocked on the **[P]** media-embed node,
so that platform ask should go to silicaui now regardless of the [B] decision.
