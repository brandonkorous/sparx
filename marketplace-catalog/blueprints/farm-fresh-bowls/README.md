# Farm Fresh Bowls — blueprint

A warm, organic DTC food storefront, modeled on
[`docs/mockups/examples/farmfreshbowls.html`](../../../docs/mockups/examples/farmfreshbowls.html)
and authored per [`docs/guides/building-a-template.md`](../../../docs/guides/building-a-template.md).

**What it provisions** (all as draft):

- **Brand + theme** — "Farm Fresh" over the `market` base preset: leaf-green primary,
  berry accent, Quicksand/Nunito, soft 16px radius.
- **Commerce** — 3 categories (Açaí & Smoothie Bowls, Cold-Pressed Smoothies, Salads &
  Grain Bowls), a "Signature Bowls" collection, and 10 products with prices + tags.
- **CMS** — two blog posts (sourcing local, eating with the seasons).
- **Site** — a site layout (announcement · header · footer), a rich **Home** page,
  **Our Story**, **Locations** (with maps), **Catering**, plus **product** and **blog
  post** collection templates.
- **Email** — a welcome email for newsletter signups.

Modules: `builder`, `commerce`, `cms`, `email`.

Imagery hot-links placeholder photos the tenant swaps after install. Ingest with
`pnpm --filter @sparx/api-rest marketplace:ingest` (local) or
`gh workflow run marketplace-ingest.yml` (prod).
