# Sony Music / artist sites — design study → `sparx-artist-media`

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-06
**Reference:** Sony Music (https://www.sonymusic.com) + the flagship recording-artist/band site archetype it anchors (label roster sites are near-universally WordPress-VIP; automated capture is blocked — 403, same as Condé Nast in the New Yorker study — so structure is grounded in the live archetype + well-known artist-site conventions; visual pass to `./images/`).
**Archetype:** Recording artist / band — media-rich, stage-dark, atmospheric. A full-bleed media hero (video or key art), a latest-release spotlight with streaming links, a tour-dates list, a discography grid, a news/journal feed, a photo/video gallery, and a fan/newsletter signup. Emotional and immersive — the one template that leans into tenant-only gradient / glass / glow / full-bleed video.
**sparx slug:** `artist-media` · **Example vertical:** recording artist / band presence (content + a light merch commerce slice) · **Theme:** bespoke — `amp` (see §6; closest shipped presets `console` / `amplitude`)

> Faithfulness bar: **closest clone allowed** — mimic structure AND aesthetic feel,
> sparx components + branding only, no trademarked assets. See [README](../README.md).

## 1. Why this reference

A recording-artist / band site is the **media-forward, emotional** end of publishing:
where TechCrunch optimises for scan-speed and the New Yorker for reading, an artist site
optimises for **mood and momentum** — it wants you to feel the record, find the show, and
press play. Sony Music's own site and the artist microsites its roster runs on WordPress-VIP
are the proven references for this archetype: a **full-bleed media hero** (a looping video or
a single piece of key art that fills the viewport), a **latest-release spotlight** that pushes
the current drop to every streaming service, a **tour-dates list** that is really a
date → venue → tickets conversion, a **discography grid** of cover art, a **news/journal**
feed, and a **fan signup** as the primary relationship. It anchors our content set as the
**atmospheric media** archetype — the clearest showcase of
[[feedback_design_restraints_are_sparx_only]]: sparx's own product surfaces forbid gradient,
glass, glow and full-bleed autoplay video, but a **tenant** artist site is exactly where those
belong, and this template proves the restraint is a scope, not a universal law. Every band,
musician, DJ, festival, film, game, or launch-hype site needs this language.

## 2. Screenshots

Captured to `./images/` (manual / archetype pass — automated capture is 403-blocked, like
the New Yorker).

- `home-fold.png` — Full-bleed **media hero**: an edge-to-edge looping video (or key art) filling the viewport, a **frosted-glass nav** floating over it (logo/wordmark centered, thin nav: Music · Tour · News · Gallery · About), the artist name set huge in a heavy display face over a duotone gradient scrim, and two CTAs ("Listen" primary + "Tour" ghost). No announcement bar competing with the image.
- `home-full.png` — Full scroll: media hero → **latest-release spotlight** (large album art + title + a row of streaming-service link chips + "Pre-save / Listen") → **upcoming tour dates** (a stacked list, date block + venue + city + a "Tickets" button per row, "All dates" link) → **latest news/journal** (3-up post cards) → **discography grid** preview (cover-art tiles) → **gallery** preview (photo/video mosaic) → **fan signup** band → footer with a big social row.
- `nav.png` — Header over media: transparent/frosted nav that solidifies to `base-200` on scroll; centered wordmark; slim uppercase-tracked nav; a persistent "Listen" pill; mobile → full-screen dark overlay menu.
- `release.png` — **Music / Releases** page: a discography **grid** of cover art (album/EP/single), each tile → a release detail (big art, tracklist, credits, and a **streaming-links row** to every service). The "PDP" of an artist site is a **release page**, and its buy-box is the streaming-links row (+ optional buy/merch).
- `tour.png` — **Tour** page: the full **dates list** (upcoming + past), each row date + venue + city + status ("Tickets" / "Sold out" / "Notify me"), optional map/region filter.
- `gallery.png` — **Gallery:** a dense photo/video **mosaic** opening a full-screen **lightbox**; video tiles play inline.
- `article.png` — **News / journal** post: a media header (lead image/video + title + date), single-column body with inline media, a related-posts rail — the reading page reused from the shared content adds.
- `footer.png` — Footer: a large **social row** (icon links), a small link map (Music · Tour · News · Store · Contact), fan-signup echo, label/legal line.

## 3. Design language

- **Palette:** **Stage-dark ground + a vivid duotone accent.** The whole site sits on a near-black stage ground (`~#0B0B0F`) so imagery, video and neon accents glow against it. Ink is an off-white (`~#F4F4F6`). Color is a **duotone concert-lighting pair** — an electric magenta primary (`~#FF2D78`) and an electric cyan accent (`~#22D3EE`) — used on CTAs, active nav, tour "Tickets" buttons, streaming chips, and the gradient scrims/glows. Mood: nocturnal, kinetic, emotional — a dark room with the lights up on stage. (Third-party streaming-service chips MAY carry their own brand marks — that is the one sanctioned literal-brand exception, like the New Yorker's illustration color; our chrome is magenta/cyan only.)
- **Typography:** **Poster display + clean sans body.** The identity is a **heavy, wide/condensed display face** (tour-poster / marquee feel — a Druk/Monument/Anton register) set huge for the artist name, release titles and section heads, in tight leading and often uppercase. Body is a **neutral grotesque** at a comfortable size. Tour dates and metadata use a **tabular/mono-ish** treatment so dates and venues align in a column. The display face doing poster-scale headlines is the single most important token — it's what reads as "artist," not "blog."
- **Imagery:** **Media-first, full-bleed, art-directed.** A looping muted hero video or one strong key-art frame fills the viewport; album/press photography is high-contrast and moody; cover art is square and dense in the discography grid. Duotone gradient scrims sit over media so display type stays legible. This is the opposite of TechCrunch's utilitarian thumbnails — here the image **is** the statement.
- **Shape & density:** **Medium radius** on cards/chips, **glass** surfaces (frosted nav, glassy tour-date rows and streaming chips over media), **neon glow** on the primary CTA and active states, generous full-bleed sections that breathe, tight metadata columns for dates. Separation is **elevation + glow + gradient**, not hairlines — the tenant-only affordances doing real work.
- **Motion:** **Signature, not incidental.** Autoplay-muted looping hero video; parallax/scale on the hero on scroll; a subtle **glow pulse** on the "Listen" CTA; hover-lift + glow on release tiles; a full-screen lightbox for the gallery; the nav fading from glass-over-video to solid on scroll. Motion sells the momentum.

## 4. Layout anatomy (top to bottom)

- **Announcement / utility bar:** Usually **none** — nothing competes with the media hero. An optional slim "New album out now" strip can sit inside the hero scrim, not above it.
- **Header / nav:** A **frosted-glass nav floating over the hero video**: centered wordmark, a slim uppercase-tracked department nav (Music · Tour · News · Gallery · About · Store), and a persistent **"Listen"** pill. Transparent/glass at the top of the page, **solidifying to `base-200` on scroll**. Mobile → a full-screen dark overlay menu. Sticky.
- **Hero:** **Full-bleed media** — an edge-to-edge looping muted video (or a single key-art frame) filling the viewport, a **duotone gradient scrim** for legibility, the artist name in the heavy display face, and **1–2 CTAs** ("Listen" primary glow + "Tour" ghost). Recency-and-mood driven, not a curated headline.
- **Homepage section sequence** (this IS the blueprint's home composition):
  1. **Media hero** — full-bleed video/key art + artist name + Listen/Tour CTAs.
  2. **Latest-release spotlight** — big cover art + title + a **streaming-links row** (every service) + "Pre-save / Listen." The current drop, pushed hard.
  3. **Upcoming tour dates** — a stacked list: date block + venue + city + **"Tickets"** button per row, "All dates →" to the Tour page. Show the next 4–6.
  4. **Latest news / journal** — a 3-up row of recent posts (media card + title + date), "All news →".
  5. **Discography grid preview** — a row of cover-art tiles linking into release pages, "Full discography →".
  6. **Gallery preview** — a photo/video mosaic strip opening the lightbox, "Gallery →".
  7. **Fan signup band** — email + optional SMS opt-in ("Join the list"), styled in-voice over a gradient/glow panel. The primary relationship.
  8. **Footer** — big social row + link map + label/legal.
- **Release anatomy** (the "PDP" of an artist site): big **cover art** + release title + type/date → a **tracklist** → **credits** → the **streaming-links row** (the buy-box: link out to every service) → optional **buy / merch** CTA → related releases. The conversion is _press play on your service of choice_, mirrored by an optional real purchase.
- **Tour list:** the full **dates list** (upcoming, then past), each row **date · venue · city · status** with a **"Tickets" / "Sold out" / "Notify me"** action; optional region/month filter and a map. This is a list, not a feed — chronological and conversion-focused.
- **Article / journal:** media header (lead image/video + title + date) → single-column body with inline media → related-posts rail. Reuses the **shared** `article_header` + `article_body` content adds from the TechCrunch/New Yorker studies.
- **Gallery:** a dense photo/video **mosaic** → full-screen **lightbox**; video tiles play inline.
- **Footer:** a **large social row** (the artist's platforms) over a small link map (Music · Tour · News · Store · Contact), a fan-signup echo, and a label/legal line.

## 5. Signature interaction patterns

1. **Full-bleed media hero with glass nav:** an edge-to-edge looping video (or key art) under a frosted-glass nav and a duotone scrim, artist name at poster scale. Reproduce the full-bleed video + glass + display type and the "artist site" feel arrives instantly — this is the template's whole reason to exist.
2. **Streaming-links row as the buy-box:** the release spotlight and every release page end in a row of streaming-service chips ("Listen on …") — the artist-site equivalent of the commerce buy-box, a _link-out_ conversion rather than an add-to-cart. This is the pattern that makes it a music site.
3. **Tour dates = a conversion list:** date · venue · city · **Tickets** on every row — a chronological list whose job is selling seats, not scanning news. The metadata column (aligned dates/venues) is what makes it read as a tour, not a blog.
4. **Neon glow + duotone gradient as the accent system:** glow on the Listen CTA and active nav, gradient scrims over media, glass tour rows — the tenant-only affordances carrying the mood the way illustration carried the New Yorker's.

## 6. The sparx translation

- **Theme:** **bespoke — `amp`** (closest shipped: `console` / `amplitude`). A **stage-dark, duotone-neon, poster-display** artist theme. This is the set's darkest, most atmospheric theme and the one that most exercises the tenant-only design freedom.
  - **Grounds (4 surfaces):** `base-100` page = `#0B0B0F` (near-black stage ground); `base-200` elevated surface / solid-nav / cards = `#14141B`; `base-300` borders / glass edges = `#26262F`; `base-content` ink = `#F4F4F6` (off-white — sits well above the readable-ink floor on the dark ground, RULE #3).
  - **Primary / accent strategy:** a **duotone concert-lighting pair.** Primary = **electric magenta** `oklch(~64% 0.24 350)` (`~#FF2D78`) on the Listen CTA, active nav, tour "Tickets" buttons, and the primary glow; accent = **electric cyan** `oklch(~78% 0.15 200)` (`~#22D3EE`) on secondary actions, links, and the second stop of the gradient scrims. Both must clear AA as button fills and as text on the dark ground at the catalog-sweep sizes — magenta with off-white ink on fills, cyan reserved for larger/interactive text where its lighter value stays legible (confirm cyan-on-dark for small body ink; if it fails, cyan stays chrome-only and magenta carries text-weight color). Gradient scrims are a **decorative** magenta→cyan wash over media (tenant-only) — not used as an ink.
  - **Fonts:** **display** = a heavy, wide/condensed grotesque (a Druk/Monument/Anton register) for the artist name, release titles and section heads — poster scale, tight leading, often uppercase; **body** = a neutral grotesque (Inter/Söhne feel) at a comfortable size; **meta** = a tabular/mono treatment for tour dates and credits so date/venue columns align. The heavy display face is the single most important token — it, not the color, is what separates "artist" from "blog."
- **Section mapping:**

  | Artist-site homepage band                    | sparx catalog key                                              |
  | -------------------------------------------- | -------------------------------------------------------------- |
  | Glass nav over media + footer w/ social row  | `sparx_layout` (silica frame navbar/footer; glass + social)    |
  | Full-bleed media hero (video / key art)      | **NEW: `media_hero`** (full-bleed video/image + scrim + title) |
  | Latest-release spotlight + streaming links   | **NEW: `release_spotlight`** (art + title + `streaming_links`) |
  | Upcoming tour dates (date · venue · Tickets) | **NEW: `tour_dates`** (list: date/venue/city/status + CTA)     |
  | Latest news / journal (3-up)                 | `blog_post_grid` _(media-card variant — shared add)_           |
  | Discography grid preview                     | **NEW: `discography_grid`** (cover-art tiles → release page)   |
  | Gallery preview / mosaic                     | **NEW: `media_gallery`** (photo/video mosaic + lightbox)       |
  | Fan signup band                              | `newsletter_signup` _(fan-signup variant — shared)_            |

  **Release page:** cover art + title/type/date → **NEW: `release_detail`** (art + tracklist + credits) ending in **NEW: `streaming_links`** (the buy-box row; a shared sub-element also used by `release_spotlight` and each `discography_grid` tile); related → `discography_grid`. **Article / journal:** media header → `article_header` (media variant of the shared add); body → `article_body`; related → `blog_post_grid`. **Tour page:** `collection_header` (content variant) + `tour_dates` at full length (upcoming + past). **Gallery page:** `media_gallery` full-length.

- **Example business:** **Vela** — a fictional recording artist / band ("Songs for the small hours"). Seeds the **content spine** plus a **light commerce slice**:
  - ~5 **releases** (an album, an EP, and 3 singles) — each a record with cover art (royalty-free / poster placeholder), title, type, release date, a **tracklist**, credits, and a `streaming_links` set (genericised "Listen on …" targets), so the release spotlight, discography grid, and release pages all render real.
  - ~10 **tour dates** (upcoming + a few past) — date, venue, city, status (Tickets / Sold out / Notify), and a tickets link — so the home preview and the full Tour page render a real run of shows.
  - ~8 **`cms.blog_post`** journal entries (studio notes, single announcements, tour diary) with a lead image/video, author, date and a real body — so the news feed and article page render.
  - ~1 **author** (the band / a band member) with a bio + portrait; taxonomy = a few post tags (Releases · Tour · Studio).
  - a **`media_gallery`** set of ~16 photo/video items for the mosaic + lightbox.
  - a **light merch commerce slice** (~4 products — tee, vinyl, poster, hoodie) so the Store link and a release-page "Buy" CTA demo **content + commerce on one site** — but the artist **presence** (releases, tour, news, gallery) is the spine, not the store.
- **Design freedom used (tenant-only affordances):** this is the template that uses **all of them**, and by design — see [[feedback_design_restraints_are_sparx_only]]. **Full-bleed autoplay-muted looping video** hero; **gradient** duotone scrims/washes over media; **glass** (frosted nav over video, glassy tour-date rows and streaming chips); **glow** (neon glow on the Listen CTA and active states); **shadow** and hover-lift on release tiles; and the **stage-dark atmospheric ground** itself. Every one of these is forbidden on a sparx product surface and correct here — the doc is the clearest proof that the restraints govern sparx's own chrome, not tenant sites.
- **Deliberate departures:** the vertical is a generic fictional artist ("Vela"), never Sony, its logo/roster, or any real artist's name, likeness, art or music; cover art, press photos and hero video are royalty-free / original poster placeholders; streaming chips link to genericised "Listen on …" targets (third-party service marks are the sole sanctioned literal-brand exception, and only on the chips); the tour "Tickets" links are placeholders, not a real ticketing integration; and we ship the **light** merch slice as a demo, not a full store — a heavier commerce presence is the commerce-ten's job.

## 7. Build notes / catalog gaps

Catalog additions (propagate once, never per-bundle inlines). Several **content-shared** adds
(`article_header`, `article_body`, `blog_post_grid` media-card, `newsletter_signup` variant)
already land from the TechCrunch / New Yorker studies and are reused here; the ones below are
the **genuinely new artist-media sections** this teardown contributes to
[CATALOG-ADDITIONS](../CATALOG-ADDITIONS.md):

- **`media_hero`** — a **full-bleed video-or-image hero**: a background media slot (autoplay-muted looping video with an image poster fallback), a duotone gradient **scrim** for legibility, a display-scale title/subtitle, and 1–2 CTAs. The tenant-only full-bleed-video + glass-nav-overlay pattern the commerce heroes never needed. Static poster fallback if the behaviors runtime / video isn't present (matching the countdown/dismiss precedent).
- **`release_spotlight`** — a single featured release: large cover art + title + type/date + a **`streaming_links`** row + a primary "Listen / Pre-save" CTA. Bound to a "latest release" record.
- **`streaming_links`** — a **shared sub-element**: a row of "Listen on …" service chips (bound to a release's link set), reused by `release_spotlight`, `release_detail`, and each `discography_grid` tile. The artist-site analogue of the commerce buy-box's action row (a link-out, not add-to-cart). Third-party service marks allowed on the chips only.
- **`tour_dates`** — a **date-list section**: rows of date-block · venue · city · **status/CTA** ("Tickets" / "Sold out" / "Notify me"), bound to a tour-date source, with a home-preview length (`limit`) and a full-page length, plus an optional region/month filter. A genuinely new **structured-list** primitive — not a blog feed, not a product grid — that any tour/events/schedule site reuses.
- **`discography_grid`** — a **cover-art grid** of releases (album/EP/single tiles: art + title + year), each tile linking to a release page and optionally surfacing the `streaming_links` on hover. A media-tile grid distinct from `blog_post_grid` (square art, no dek, no byline).
- **`release_detail`** — the release "PDP": big art + title/type/date + **tracklist** + **credits** + `streaming_links` (+ optional buy CTA). The one detail surface the content set adds that isn't an article.
- **`media_gallery`** — a **photo/video mosaic** with a full-screen **lightbox**; video tiles play inline. Needs a lightbox behavior (static grid fallback without the runtime).
- **Dark-theme + glow/gradient/glass theme support** — confirm the theme token bag carries a **dark-first** ground set cleanly (off-white ink on `#0B0B0F` clearing AA), that `font-heading` carries a heavy display face at poster scale, and that the catalog sections degrade gracefully when the tenant-only affordances (video, gradient scrim, glass blur, glow) are the mood rather than the message. This template is the reference implementation for the tenant-only design-freedom scope — the sweep should verify these sections render on a **light** theme too (the sections must be theme-driven, so a different tenant could run `media_hero` / `tour_dates` on a bright ground).
