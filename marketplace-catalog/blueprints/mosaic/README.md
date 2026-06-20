# Mosaic — blueprint

A clean, modern **AI-workspace / productivity SaaS** marketing site, modeled on
[`docs/mockups/examples/notion.html`](../../../docs/mockups/examples/notion.html)
and authored per [`docs/guides/building-a-template.md`](../../../docs/guides/building-a-template.md).

> **Brand is generic on purpose.** The mockup replicates Notion's homepage for
> _design reference_; a shipped first-party blueprint must not carry a
> competitor's trademark (same reason `farmfreshbowls.html` → the generic "Farm
> Fresh" brand). So this template reproduces the _design language_ — near-mono
> palette, bento mosaics, the browser-chrome product preview, the marquee — under
> the generic brand **Mosaic** ("M" monogram, the AI workspace where your work
> comes together). Rename freely after install.

**Vertical:** `services` (a SaaS product/marketing site — content + lead-gen, no
commerce). **Modules:** `builder`, `cms`, `email`.

---

## Layout (multi-file payload, docs/85)

`blueprint.ts` is a thin entry that imports `./parts/*` and `export default`s the
manifest. The source of truth is the **generator** module folder
[`marketplace-catalog/_gen/mosaic/`](../../_gen/mosaic/) — `_kit` (the shared
`node()`/`el()`/`atom()` helpers + the ONE id counter), `theme`, `logo`, `media`,
`sections`, `layout`, `pages/*` (Home split into a folder of per-section files),
`cms`, `email`, `manifest` (assembles + owns node-id order), `emit` (writes the
multi-file payload) — run via the thin entry
[`_gen/gen-mosaic.ts`](../../_gen/gen-mosaic.ts):

```bash
pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-mosaic.ts"
npx prettier --write "marketplace-catalog/blueprints/mosaic/**/*.ts"
pnpm --filter @sparx/api-rest marketplace:ingest
```

A `parts/*` file is safe to hand-edit for a quick tweak, but the generator
overwrites it — **edit `_gen/`, not the emitted parts.** `sparx.json`, this
`README.md`, and `media/` are hand-maintained and survive a regen.

---

## Authoring approach — why `el()`/`atom()` lead here (vs. Farm Fresh's `node()`)

Farm Fresh is a retail storefront built almost entirely from the semantic
`node({ box, layout })` vocabulary — big full-bleed bands, product grids, editorial
splits. That vocabulary is perfect for **broad, re-themable bands**, and Mosaic
uses it the same way for every **section shell** (so each band is a real
contained band, responsive, and re-skins to the installing tenant's theme).

But Notion's design is **dense, bespoke interior UI**: a fake browser window with a
sidebar and a database table, bento "screenshot" tiles with skeleton bars, an
overlapping avatar cluster, a scrolling logo marquee, a 4-up stat grid. Those are
exactly what the platform's **raw-element primitive** (`el('div', …)`, `el('svg',
…)`, `el('table', …)`) + named **atoms** (`atom('Heading', …)`) express cleanly —
the same helpers the platform component catalog
([`packages/builder-schemas/src/catalog/`](../../../packages/builder-schemas/src/catalog/))
is authored with. So Mosaic is a **hybrid**: `node()` for the section bands,
`el()`/`atom()` for the interior compositions. Both mint ids from one shared
counter in `_kit.ts`.

Notable platform features this template exercises that Farm Fresh doesn't:

- **Raw HTML elements** (`el:div`/`el:svg`/`el:table`/`el:aside`) — the browser
  chrome, faux DB table, and bento screenshots are real element trees, not images.
- **The `marquee` behavior** (`behave(track, { type: 'marquee' })`, docs/98
  Pillar 5) — the logo strip scrolls on the live site, CSS-reduced-motion aware.
- **A near-monochrome `apex` theme** with bento accent hexes baked as classes
  (the brand is black + blue; the playful color lives only inside the bento tiles).

---

## Design breakdown — mockup section → blueprint node

The home page is one long landing, top to bottom. Each row becomes a `Section`
band in `pages/home/NN-*.ts`:

<<<<<<< HEAD
| #   | Mockup section                  | Blueprint translation                                                                                                                                                  |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —   | Sticky header                   | `layout.ts`: full-bleed white band, `sticky top-0 z-30`, inner `max-w-[1240px]` row (`collapse:false`) — `M` monogram + Wordmark, `NavMenu` (Product/AI/Solutions/…), "Log in" link, blue "Get Mosaic free" CTA. |
| 01  | Hero                            | Centered band: a 6-up overlapping **avatar cluster** (`-space-x-2`, `ring-4`), a display `h1` with an inline lime **"Ship" pill** (dot + word), a muted subhead, two CTAs (solid blue + ghost). |
| 02  | Workspace preview               | A `rounded-2xl` shadowed card = **browser chrome** (3 traffic-light dots + URL pill) wrapping a flex row: an `aside` **sidebar** (workspace nav) + a main pane with tabs and a **faux database table** (`el:div` grid rows, status pills, owner dots). Floating coral/amber accent dots pinned over the corners. |
| 03  | Logo strip                      | A full-bleed hairline-topped band; a `marquee`-behavior track of muted wordmarks (Vela, Northwind, Lumen, …), duplicated for a seamless scroll.                          |
| 04  | "Keep work moving 24/7"         | Cream band. A white panel split 2-col: copy + a round play **pill-btn**, beside a stack of 4 **agent rows** (colored icon tile + label). Below: a 5-up **capability card grid** (4 light cards + 1 dark navy card), each an emoji + "… →" line. |
| 05  | "Ask your on-demand assistants" | White band. **Bento**: one wide 2-col split card (copy + amber "screenshot" panel with a running-agent chip + skeleton bars), then two cards (coral search panel, blue meeting-notes panel). Each copy half carries a circular arrow **pill-btn**. |
| 06  | "Bring all your work together"  | Cream band. **Bento**: two cards (teal Docs skeleton, blue Knowledge-Base tile grid) + one wide brown Projects card (3-column kanban tiles). Closes with a centered **serif italic pull-quote**.                |
| 07  | "Trusted by teams that ship"    | White band. A big cream **testimonial** card + "Read the story →" link, a 3-up quote-card row, and a 4-up **stat grid** (#1 / #1 / 62% / 50%+) in bordered cells.        |
| 08  | "Try for free"                  | Cream band. 2-col: a primary "Get started on Mosaic" card (monogram + two buttons) beside a stack of two product cards (Mail, Calendar) with download links.            |
| —   | Footer                          | `layout.ts`: white band, hairline top, a 5-column grid (brand + socials + language pill, then Company / Download / Resources / "Mosaic for" link columns) over a legal/copyright bottom bar. |
=======
| #   | Mockup section                  | Blueprint translation                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —   | Sticky header                   | `layout.ts`: full-bleed white band, `sticky top-0 z-30`, inner `max-w-[1240px]` row (`collapse:false`) — `M` monogram + Wordmark, `NavMenu` (Product/AI/Solutions/…), "Log in" link, blue "Get Mosaic free" CTA.                                                                                                 |
| 01  | Hero                            | Centered band: a 6-up overlapping **avatar cluster** (`-space-x-2`, `ring-4`), a display `h1` with an inline lime **"Ship" pill** (dot + word), a muted subhead, two CTAs (solid blue + ghost).                                                                                                                  |
| 02  | Workspace preview               | A `rounded-2xl` shadowed card = **browser chrome** (3 traffic-light dots + URL pill) wrapping a flex row: an `aside` **sidebar** (workspace nav) + a main pane with tabs and a **faux database table** (`el:div` grid rows, status pills, owner dots). Floating coral/amber accent dots pinned over the corners. |
| 03  | Logo strip                      | A full-bleed hairline-topped band; a `marquee`-behavior track of muted wordmarks (Vela, Northwind, Lumen, …), duplicated for a seamless scroll.                                                                                                                                                                  |
| 04  | "Keep work moving 24/7"         | Cream band. A white panel split 2-col: copy + a round play **pill-btn**, beside a stack of 4 **agent rows** (colored icon tile + label). Below: a 5-up **capability card grid** (4 light cards + 1 dark navy card), each an emoji + "… →" line.                                                                  |
| 05  | "Ask your on-demand assistants" | White band. **Bento**: one wide 2-col split card (copy + amber "screenshot" panel with a running-agent chip + skeleton bars), then two cards (coral search panel, blue meeting-notes panel). Each copy half carries a circular arrow **pill-btn**.                                                               |
| 06  | "Bring all your work together"  | Cream band. **Bento**: two cards (teal Docs skeleton, blue Knowledge-Base tile grid) + one wide brown Projects card (3-column kanban tiles). Closes with a centered **serif italic pull-quote**.                                                                                                                 |
| 07  | "Trusted by teams that ship"    | White band. A big cream **testimonial** card + "Read the story →" link, a 3-up quote-card row, and a 4-up **stat grid** (#1 / #1 / 62% / 50%+) in bordered cells.                                                                                                                                                |
| 08  | "Try for free"                  | Cream band. 2-col: a primary "Get started on Mosaic" card (monogram + two buttons) beside a stack of two product cards (Mail, Calendar) with download links.                                                                                                                                                     |
| —   | Footer                          | `layout.ts`: white band, hairline top, a 5-column grid (brand + socials + language pill, then Company / Download / Resources / "Mosaic for" link columns) over a legal/copyright bottom bar.                                                                                                                     |
>>>>>>> 9e04db99317c79fd4bece5b3cdf2d3fcbd646dd1

**Secondary pages** (the nav implies them; each is built complete, not a stub):
**Pricing** (3-tier table + comparison + FAQ), **Enterprise** (security/scale
pitch + stat band), **Request a demo** (contact form + details). **CMS:** two
"customer story" posts + a **Customers** index and a `cms.blog_post` collection
template. **Email:** a brand-voiced Welcome + a product-tips broadcast.

---

## Theme

Base preset **`apex`** (clean/modern, Inter heading + body, white page). The
`presentation` overlay paints the mockup's exact surfaces — page = white, `subtle`
= cream (`#F6F5F3`, the alternating section bg), `inverse` = ink (`#191918`),
border = line (`#EAE9E5`), body text = `#37352F`. Brand look: primary = Notion-blue
(`#2383E2`), accent = teal, secondary = amber; 8px field / 16px box radius. The
**bento solids** (yellow/coral/blue/teal/brown/navy/lime) are NOT theme roles —
they're the design's playful interior palette, baked as `bg-[#…]` classes in
`theme.ts` so they read identically regardless of the installing tenant's theme.

Imagery is **emoji + CSS** (avatar clusters, skeleton bars, browser chrome) — zero
remote images, so nothing 404s post-install; the logo/favicon are self-contained
SVG data URIs. Everything installs as **draft** for the tenant to review and
publish.
