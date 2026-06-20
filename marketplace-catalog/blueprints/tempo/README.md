# Tempo — blueprint

A bold, stark **athletic / sportswear storefront**, modeled on
[`docs/mockups/examples/adidas.html`](../../../docs/mockups/examples/adidas.html)
and authored per [`docs/guides/building-a-template.md`](../../../docs/guides/building-a-template.md).

> **Brand is generic on purpose.** The mockup recreates the adidas.com homepage
> for _design reference_; a shipped first-party blueprint must not carry a
> competitor's trademark (same reason `farmfreshbowls.html` → "Farm Fresh",
> `notion.html` → "Mosaic", `500designs.html` → "Forge"). So this template
> reproduces the _design language_ — stark black-on-white, bold condensed
> grotesque caps, full-bleed campaign bands, square hard-edged chrome, the
> arrow-link, the membership band — under the generic brand **Tempo**.
>
> The three-stripes is adidas's most-protected mark, so it is **not** reproduced.
> Tempo's signature device is a generic forward **motion-mark** (`»`, two skewed
> chevron bars) used wherever the mockup stamped the three-stripes. Rename and
> re-mark freely after install.

**Vertical:** `retail` (a real selling storefront). **Modules:** `builder`,
`commerce`, `cms`, `email`.

---

## Authoring approach — a hybrid, like Mosaic

Farm Fresh is built almost entirely from the semantic `node({ box, layout })`
vocabulary (broad, re-themable bands + product grids). Tempo is a **hybrid**, like
Mosaic: `node()` for every **section band** (full-bleed, contained, responsive,
re-skins to the installing tenant), and `el()`/`atom()` for the **dense bespoke
interior** the adidas look depends on — the carousel hero, the skewed campaign
typography, the CSS motion-mark, the CSS "shoe/product" silhouette stand-ins, the
uppercase arrow-link, the four-up benefit grid, the mega footer. Both mint ids
from one shared counter in `_kit.ts`.

The design's **playful campaign color** (the team-color gradient tiles, the bold
blue/yellow/red hero) is baked as `bg-[#…]` / `bg-[linear-gradient(...)]` classes
in the page modules — Mosaic's bento precedent and Forge's thumb precedent — so it
reads identically regardless of the installing tenant's theme, while the surfaces
+ primary re-theme on a fork. Tempo's _brand_ is just black + white + a sale red +
a club green; color lives inside the tiles.

---

## Brand & theme (lifted from the mockup)

| Token            | Value                       | Mockup source                                   |
| ---------------- | --------------------------- | ----------------------------------------------- |
| page (`base100`) | `#ffffff` paper             | `bg-paper`                                       |
| `base200` subtle | `#f5f5f5` soft              | product-card / tile wells                        |
| `base300`/border | `#e3e3e3` hairline          | `border-hairline`                               |
| `baseContent`    | `#111111` ink               | `text-ink`                                       |
| `neutral`        | `#111111` ink               | the black footer, black CTAs                     |
| primary          | `#111111` ink               | adidas CTAs are **black**, not colored          |
| accent           | `#e3251f` sale red          | `#d32f2f` sale tags / strike-through prices      |
| secondary        | `#1c6b3e` club green        | `#1d6b3e` adiClub membership band               |
| heading font     | **Archivo** (Google)        | bold condensed grotesque caps                   |
| body font        | **Inter** (Google)          | body copy                                        |
| radius           | `0` (sharp)                 | adidas is hard-edged — square cards, rect CTAs  |
| container        | `1480px`                    | the mockup's `max-w-shell` (1480px)             |

Base preset: **`drop`** (bright, punchy, grid-first, wide) — the platform's
catalog-first foundation, the closest match for a high-volume sportswear grid.

The signature heading treatment (`font-heading` Archivo + `uppercase` +
`tracking-tightest` + `font-black`) is applied per-heading in the section modules —
it is the single strongest carrier of the adidas voice.

---

## Section-by-section map (mockup → manifest)

The home page is split into a folder of per-section payload files
(`parts/pages/home/NN-*.ts`), one cohesive section each.

| #   | Mockup section                          | → Blueprint                                                                              |
| --- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| —   | Top utility bar + sticky header + promo | **layout** chrome — utility links row, app-bar (motion-mark + wordmark · nav · search · account/wishlist/bag · hamburger), then a black-ruled promo strip. |
| 01  | Hero campaign (carousel + pause)        | **carousel** behavior — auto-advancing campaign slides (team-color gradient bands) with an overlaid white copy card, arrows + dots. |
| 02  | Find Your Team scroller                 | a **marquee** strip of colored team/colorway tiles, each stamped with the motion-mark.  |
| 03  | Shop the Season (4-up category tiles)   | a `Grid` of full-bleed gradient tiles with a white caption foot + arrow-link.            |
| 04  | Shop by Category (Originals/Running/…)  | a `Grid` of 4 category tiles, each linking to its `/shop` category.                      |
| 05  | Shop Best Sellers (product row)         | a **live** `boundProductGrid` bound to the `best-sellers` collection by handle — real shoppable cards (PDP link + add-to-cart). |
| 06  | Editorial promo (Men/Women/Kids)        | a 3-up `Grid` of tall gradient editorial panels with arrow-links.                       |
| 07  | Full-bleed editorial banner (dark)      | an `inverse` band with a big display headline, a CSS product silhouette, and a paper CTA. |
| 08  | Membership join band (green)            | a `secondary`-surfaced (club green) band — motion-mark + wordmark lockup, headline, two CTAs. |
| 09  | Benefit strip (4-up)                    | a hairline-gridded 4-up of benefit cells.                                               |
| 10  | SEO copy block                          | a dense `Prose`/`Text` block above the footer.                                          |
| —   | Mega footer                             | **layout** — 5 link columns, a newsletter `Signup`, `SocialLinks`, a big wordmark, a country pill, and the legal line. |

**Commerce** — four categories (Originals, Running, Soccer, Lifestyle) matching the
category tiles, a `best-sellers` + `new-arrivals` collection, and ~12 products
(sneakers, cleats, apparel) with data-URI product images (a brand-gradient panel +
the product emoji, the Farm-Fresh `photoSvg` precedent — 100% reliable, no remote
load). A `commerce.product` collection template renders the PDP.

**Pages** — Home, Shop (full catalog landing), Club (membership), Our Story, Help,
News (a CMS index at `/news`, since `/blog` 404s — see the catalog footgun), a
`commerce.product` template, and a `cms.blog_post` (Article) template + three news
posts.

**Emails** — a club Welcome and a "new drops" broadcast (with the compliance
footer), brand-voiced with the canonical merge tokens.

---

## Build / iterate

The source of truth is the **generator** module folder
[`marketplace-catalog/_gen/tempo/`](../../_gen/tempo/) — `_kit` (the shared
`node()`/`el()`/`atom()` helpers + the ONE id counter), `theme`, `logo`, `media`,
`sections`, `commerce`, `cms`, `layout`, `pages/*` (Home split into a folder of
per-section files), `email`, `manifest` (assembles + owns node-id order), `emit`
(writes the multi-file payload) — run via the thin entry
[`_gen/gen-tempo.ts`](../../_gen/gen-tempo.ts):

```bash
pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-tempo.ts"
npx prettier --write "marketplace-catalog/blueprints/tempo/**/*.ts" "marketplace-catalog/_gen/tempo/**/*.ts"
pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/validate-tempo.ts"
pnpm --filter @sparx/api-rest marketplace:ingest
```

A `parts/*` file is safe to hand-edit for a quick tweak, but the generator
overwrites it — **edit `_gen/`, not the emitted parts.** Bump the version in BOTH
`_gen/tempo/manifest.ts` and `sparx.json` to publish an update. `sparx.json`, this
`README.md`, and `media/` are hand-maintained and survive a regen.
