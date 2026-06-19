# Farm Fresh — blueprint

A warm, organic DTC food storefront, modeled on
[`docs/mockups/examples/farmfreshbowls.html`](../../../docs/mockups/examples/farmfreshbowls.html)
and authored per [`docs/guides/building-a-template.md`](../../../docs/guides/building-a-template.md).

**Layout.** The payload is **multi-file** (docs/85): `blueprint.ts` is a thin entry that
imports `./parts/*` and `export default`s the manifest — `parts/layout.ts`,
`parts/commerce.ts`, `parts/pages/<page>.ts`, and the home page as a folder of
per-section files (`parts/pages/home/01-hero.ts` …). Each part is pure data with
relative imports only (no `@sparx/*`), so the ingest's dynamic-import stays self-
contained and a human can edit one scoped file instead of a 3,000-line wall.

> **Source of truth is the generator**, not the emitted bundle. The generator is itself
> a module folder (not a single wall): [`marketplace-catalog/_gen/farm-fresh/`](../../_gen/farm-fresh/)
> — `_kit` (the shared `node()` helper + id counter), `theme`, `media`, `sections`,
> `layout`, `pages/*`, `email`, `manifest` (assembles + owns the node-id order), `emit`
> (writes the multi-file payload) — run via the thin entry
> [`_gen/gen-farm-fresh.ts`](../../_gen/gen-farm-fresh.ts). Edit a module
> (friendly `node({box,layout})` vocabulary), then re-run:
> `pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-farm-fresh.ts"`
> then `npx prettier --write "marketplace-catalog/blueprints/farm-fresh/**/*.ts"`.
> A part is safe to hand-edit for a quick tweak, but the generator overwrites it.

**What it provisions** (all as draft):

- **Brand + theme** — "Farm Fresh" over the `market` base preset: leaf-green primary,
  berry accent, Quicksand/Nunito, soft 16px radius.
- **Commerce** — 3 categories (Açaí & Smoothie Bowls, Cold-Pressed Smoothies, Salads &
  Grain Bowls), two collections ("Signature Bowls", "Fan Favorites"), and 10 products
  with prices + tags.
- **CMS** — two blog posts (sourcing local, eating with the seasons) with cover images.
- **Site** — a site layout (announcement · header · footer), a rich **Home** page,
  **Menu** (shoppable), **Our Story**, **Locations** (with maps), **Catering**,
  **Contact**, and **Journal** (the blog index), plus an enriched **product** PDP
  (breadcrumb · buy box · trust points · benefits · cross-sell) and a **blog post**
  collection template.
- **Email** — a welcome email for newsletter signups.

Modules: `builder`, `commerce`, `cms`, `email`.

Imagery hot-links placeholder photos the tenant swaps after install. Ingest with
`pnpm --filter @sparx/api-rest marketplace:ingest` (local) or
`gh workflow run marketplace-ingest.yml` (prod).
