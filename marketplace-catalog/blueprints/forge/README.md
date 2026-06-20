# Forge — blueprint

A bold, **dark, award-style marketing site for a creative / brand & web studio**, modeled
on [`docs/mockups/examples/500designs.html`](../../../docs/mockups/examples/500designs.html)
and authored per [`docs/guides/building-a-template.md`](../../../docs/guides/building-a-template.md).

> **Brand is generic on purpose.** The mockup replicates the 500designs.com homepage for
> _design reference_; a shipped first-party blueprint must not carry another studio's
> trademark (same reason `farmfreshbowls.html` → "Farm Fresh" and `notion.html` →
> "Mosaic"). So this template reproduces the _design language_ — warm near-black canvas,
> a single acid-green accent, the leading slash device, the case-study showcase, the
> scrolling marquee — under the generic studio brand **Forge** ("/" slash mark, "Impactful
> brands & websites. Engineered growth."). Rename freely after install.

**Vertical:** `services` (a studio/agency marketing site — content + lead-gen, no
commerce). **Modules:** `builder`, `cms`, `email`.

---

## Evaluating Farm Fresh + Mosaic as models (what carried over)

Forge is the **third** blueprint, and it deliberately stands on the two before it. Both
were evaluated as reusable models before a line was written:

- **Farm Fresh** established the **semantic `node({ box, layout })` vocabulary** for broad,
  re-themable section bands (full-bleed photo bands, product grids, editorial splits) and
  the **multi-file generator** shape (`_gen/<slug>/` module folder → emitted `parts/*`).
  Its lesson: the `box`/`layout` DTO is the right tool for **section shells** — a band that
  must be contained, responsive, and re-skin to the installing tenant.
- **Mosaic** proved the **hybrid author**: `node()` for the section shells **plus**
  `el()`/`atom()` (raw HTML elements + named registry atoms) for **dense bespoke interior
  UI** — the browser-chrome product shot, the faux database table, the bento tiles. It
  also proved the **near-monochrome `apex` theme + baked accent classes**, the **marquee
  behavior**, the **CMS spine** (seeded `blog_post` stories + a collection template + a
  static-card index), and the **emit auto-split** of the home page into per-section files.

**Forge reuses all of that and pushes on two axes Mosaic didn't:**

1. **A fully dark theme.** Mosaic is a white page; Forge paints the `presentation.light`
   palette with the mockup's warm near-black surfaces — a dark default with no theme
   toggle (see [Theme](#theme)). The same overlay machinery, inverted.
2. **A re-themable brand-surface CTA band.** The signature acid closing band uses
   `surface: 'brand'` (→ `bg-primary text-primary-content`), so it re-themes to the
   tenant's primary on a fork instead of being a baked hex — the one place Forge's color
   is intrinsic to the layout, routed through a token rather than a class.

One **platform-correctness fix** came out of the evaluation: Mosaic's logo wall
pre-doubled its names and omitted `animate-marquee`, so it was a static row. Forge follows
the **catalog's** proven marquee (`interactive.ts` `logo_marquee`): a single set of names
on a track wearing `animate-marquee`, with the live runtime cloning the children for a
seamless loop.

---

## Layout (multi-file payload, docs/85)

`blueprint.ts` is a thin entry that imports `./parts/*` and `export default`s the
manifest. The source of truth is the **generator** module folder
[`marketplace-catalog/_gen/forge/`](../../_gen/forge/) — `_kit` (the shared
`node()`/`el()`/`atom()` helpers + the ONE id counter), `theme`, `logo`, `media` (pill
buttons, slash glyph, arrows, stat cell, footer column), `sections` (band shell, slash
heading, project card + gradient thumbs, service row, phase card, quote figure), `data`
(shared copy), `layout`, `pages/*` (Home split into a folder of per-section files), `cms`,
`email`, `manifest` (assembles + owns node-id order), `emit` (writes the multi-file
payload) — run via the thin entry [`_gen/gen-forge.ts`](../../_gen/gen-forge.ts):

```bash
pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-forge.ts"
npx prettier --write "marketplace-catalog/blueprints/forge/**/*.ts"
pnpm --filter @sparx/api-rest marketplace:ingest
```

A `parts/*` file is safe to hand-edit for a quick tweak, but the generator overwrites it —
**edit `_gen/`, not the emitted parts.** `sparx.json`, this `README.md`, and `media/` are
hand-maintained and survive a regen.

---

## Authoring approach — the hybrid, in a dark editorial key

Like Mosaic, Forge uses `node({ box, layout })` for every **section shell** (so each band
is a real contained, responsive, re-themable band) and `el()`/`atom()` for the **interior
compositions** the design leans on. The interior pieces Forge exercises:

- **The case-study showcase** — a rounded card splitting a cream project slab beside a
  black visual with a glowing acid ring + a mesh-dot grid. Real elements, not an image.
- **Gradient project thumbnails** — each work card's thumb is a `bg-linear-to-br`
  gradient holding a distinct centered shape (acid ring / ember bars / sky tile grid /
  fuchsia rings) that scales on card hover.
- **Numbered service rows** — a divide-ruled list whose titles light acid on `group-hover`.
- **The 4-up stat band**, **process phase cards**, and **testimonial quote figures**
  (`<figure>` + `<blockquote>` + an initial avatar).
- **The awards marquee** (`behave`/`part`, `animate-marquee`) and **the leading slash**
  (`-skew-x-12` acid glyph) that marks the brand lockup and every section heading.
- **A real contact form** (`Field` + `Input`/`Textarea` + a native `<select>`).

Both `node()` and `el()`/`atom()` mint ids from one shared counter in `_kit.ts`.

---

## Design breakdown — mockup section → blueprint node

The home page is one long landing, top to bottom. Each row becomes a `Section` band in
`pages/home/NN-*.ts`:

| #   | Mockup section         | Blueprint translation                                                                                                                                                                                                                                             |
| --- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —   | Sticky header          | `layout.ts`: full-bleed warm-black band, `sticky top-0 z-30` + blur (the mockup's `fixed` is denylisted by the class allowlist), inner `max-w-site` row (`collapse:false`) — Wordmark, `NavMenu` (Work/Services/About/Insights/Careers), cream "Let's talk" pill. |
| 01  | Hero                   | Left band: an eyebrow status line, a big slash-led display `h1` (with "Engineered" stepped back in muted), a subhead + two CTAs, and the **case-study showcase** (cream slab + black acid-ring visual).                                                           |
| 02  | Logo + awards marquee  | Recessed band: a "trusted by" line, a `marquee`-behavior track of muted client wordmarks, and a centered row of award/recognition lines.                                                                                                                          |
| 03  | Selected work          | A heading + blurb intro over a **2-up grid of project cards** (gradient thumb + category pill + title/meta + circular up-right affordance), and a "See all projects" CTA → `/work`.                                                                               |
| 04  | Stats                  | Recessed band: a 4-up grid of big display figures over captions (240+ / 38 / $2.4B / 11 yrs).                                                                                                                                                                     |
| 05  | What we do             | Intro over the four disciplines as **numbered, divide-ruled rows** (each title lights acid on hover).                                                                                                                                                             |
| 06  | How we engineer growth | Recessed band: a heading over a 4-up grid of **process phase cards** (Discover · Define · Design · Deploy).                                                                                                                                                       |
| 07  | What partners say      | A heading over a 3-up row of **testimonial quote figures** (blockquote + initial avatar + name/role).                                                                                                                                                             |
| 08  | Big contact CTA        | The signature **acid band** (`surface: 'brand'`, so it re-themes): a slash-led headline + a cream email pill + a dark "Book a call" pill → `/contact`.                                                                                                            |
| —   | Footer                 | `layout.ts`: deepest-well band, hairline top, a 4-column grid (brand + socials, then Studio / Services / Connect link columns) over a legal/copyright bottom bar.                                                                                                 |

**Secondary pages** (the nav implies them; each is built complete, not a stub): **Work**
(full project gallery), **Services** (the disciplines + process), **About** (beliefs +
stats + testimonials), **Insights** (static cards → the seeded posts), **Careers**
(perks + open roles → `/contact`), and **Contact** (a real inquiry form + studio details).
**CMS:** three "insight" articles + a `cms.blog_post` collection template (the
`/blog/<slug>` detail). **Email:** a brand-voiced inquiry Welcome + a Studio-Notes
broadcast.

---

## Theme

Base preset **`apex`** (clean/modern), fonts **Space Grotesk** (display) + **Sora** (body).
Forge is a **dark** site, so the `presentation.light` (default) palette is painted with the
mockup's warm near-black surfaces: page = night (`#1A1611`), `subtle` = nighter
(`#121009`, the recessed alternating bands), body text = sand (`#C9C3B6`), headings = cream
(`#ECE7DD`, baked per-node), warm hairline borders. Brand look: primary = **acid green**
(`#C6F24E`, ink foreground), accent = ember (`#FF6A3D`), neutral = cream (so the cream pill
buttons + outline CTAs re-theme); pill CTAs force `rounded-full`, cards use a 24px box
radius. The **project-thumb gradients** (and the lone ember/sky/fuchsia accents inside
them) are NOT theme roles — they're baked as `bg-[#…]` / `bg-linear-to-br` classes so the
gallery reads identically regardless of the installing tenant's theme (the brand itself is
warm-black + acid; color lives only inside the work thumbnails — Mosaic's bento precedent).

Imagery is **CSS + emoji-free SVG** (the showcase, the gradient thumbs, the stat band) —
zero remote images, so nothing 404s post-install; the logo/favicon + the insight covers
are self-contained SVG data URIs. Everything installs as **draft** for the tenant to
review and publish.
