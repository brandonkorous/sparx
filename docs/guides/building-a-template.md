# Building a template (blueprint)

Version: 1.2.0
Author: Brandon Korous
Last Updated: 2026-06-18

A **template** in sparx is a **blueprint**: a single declarative manifest that
provisions a whole themed site in one install — brand + theme, content, an optional
commerce catalog, a site layout, pages, and emails. The installer **replays** the
manifest through the platform's own services, resolving every handle/reference to a
real id as it goes. **No template code ever runs** — a blueprint is data.

This guide is the end-to-end path: anatomy → manifest → trees → theme → commerce →
content → media → validate → ingest → install, plus how to turn a design mockup into
a working template. Read it once and you can build and ship a template from scratch.

> Source of truth for the schema is [`@sparx/blueprints`](../../packages/blueprints/src/manifest.ts)
> (`manifest.ts`, `validate.ts`). The complete worked example is
> [`marketplace-catalog/blueprints/sparx/`](../../marketplace-catalog/blueprints/sparx/) —
> the first-party reference bundle, captured from the live sparx Template site. The
> ingest is [`services/api-rest/src/lib/marketplace/ingest.ts`](../../services/api-rest/src/lib/marketplace/ingest.ts);
> the installer is [`services/api-rest/src/lib/blueprint-installer.ts`](../../services/api-rest/src/lib/blueprint-installer.ts).

---

## 1. How a template lives (the data-first pipeline)

A template is authored as a **bundle** (TypeScript + a JSON manifest + images) under
[`marketplace-catalog/blueprints/<slug>/`](../../marketplace-catalog/blueprints/).
You never write to a SQL payload column and you never commit a compiled artifact.
The flow is (docs/85):

```
marketplace-catalog/blueprints/<slug>/   ← you author this (the SOURCE)
        │  pnpm marketplace:ingest  (local)  /  gh workflow run marketplace-ingest.yml (prod)
        ▼
  ┌─────────────────────────────┐     ┌─────────────────────────────────────┐
  │ object storage (artifact)   │     │ marketplace_blueprints (thin row)   │
  │ marketplace/blueprints/     │     │  slug, name, vertical, version,     │
  │   <slug>/<version>.json     │ ◄── │  requiredModules, contents, media   │
  │ (the full compiled manifest)│     │  (NO payload column — definition NULL)│
  └─────────────────────────────┘     └─────────────────────────────────────┘
        │                                          │
        ▼  browse + install                        ▼
  GET /v1/blueprints (catalog) ──► POST /v1/blueprints/:key/install ──► a draft site
```

- The **bundle** is the source. Pushing it to `main` ships the source only; the
  catalog stays empty until the **ingest** runs (local dev, or the prod workflow).
- The ingest **compiles** the payload (validates it with `safeParseBlueprint`),
  writes the manifest as an **immutable artifact** keyed by `(slug, version)` to
  object storage, and **upserts a thin catalog row** the browse UI reads.
- The runtime is **DB-first**: the moment the ingest completes, the template appears
  in the dashboard `/marketplace`, `/builder/blueprints`, and `GET /v1/blueprints`.
- The in-code `@sparx/blueprints` registry is an empty **fallback** only — first-party
  templates ship as bundles, not in-code manifests.

---

## 2. Bundle anatomy

```
marketplace-catalog/blueprints/<slug>/
  sparx.json      # catalog metadata (category, slug, version, facets, pricing, media)
  blueprint.ts    # the payload: `export default` the manifest object
  media/
    icon.png      # 512×512 — the small catalog tile (REQUIRED)
    preview.png   # ~1600×1000 — the card hero / screenshot of the home page (REQUIRED)
  README.md       # optional — what the template is for
```

Both `icon.png` and `preview.png` are **required** — the ingest denies a bundle that
is missing either (`assertRequiredMedia`). The ingest copies every image under
`media/` to public storage; `preview.png` becomes `media[0]` (the card hero).

### Big templates: split the payload into parts

`payload` names **one entry module**, but that entry may relative-import sibling data
files — so a large template ships as a **folder of scoped files**, not one
multi-thousand-line wall a human has to edit safely. The ingest dynamic-imports the
entry and ESM resolves the whole relative graph:

```
blueprints/<slug>/
  sparx.json        # payload: "blueprint.ts"  (the ENTRY pointer is unchanged)
  blueprint.ts      # THIN: imports ./parts/* and `export default` the manifest
  parts/
    layout.ts · commerce.ts · content.ts · assets.ts
    pages/home.ts          # imports ./home/* and re-exports the page tree
    pages/home/01-hero.ts … 11-order.ts   # one file per section
    pages/{story,locations,…}.ts
    emails/welcome.ts
```

The only rule is **self-containment**: every file in the graph is pure data with
**relative** imports and **no `@sparx/*`** (the entry is imported from outside any
workspace package, and Phase-2 sandboxes the graph). Each part `export default`s its
slice; the entry stitches them back together. `marketplace-catalog/blueprints/sparx/` is
the worked example: `blueprint.ts` imports `./site.json` (the captured site),
`./content.json` (the journal posts), and `./welcome-email.json`.

**Two ways to author the site trees.** The heavy, error-prone part of a blueprint is its
silica page trees. There are two paths:

- **Capture** (what `sparx` does): build the site once in the real studio editor on a
  tenant, then pull it as DATA — `blueprint:capture` locally, or the MCP `get_silica_site`
  read — into `site.json`. The trees carry real, stable ids and reinstall byte-identical;
  no `node()` authoring, no generator.
- **Generate from scratch** (for a blueprint with no live site to capture): author the trees
  with the `node()` helper in a generator under `_gen/` and serialize to `blueprint.ts` (the
  same mechanism the theme/component bundles use — see `_gen/gen-theme-bundles.ts`). Keep the
  `node()` call order stable across edits (the shared id counter advances in call order).

### `sparx.json`

```jsonc
{
  "schemaVersion": 1,
  "category": "blueprint",
  "slug": "studio-starter", // kebab-case [a-z0-9-]; matches the folder + manifest.key
  "name": "Studio Starter",
  "version": "1.0.0", // plain semver; MUST match manifest.version
  "tagline": "A clean three-page site for a small studio.",
  "description": "A themed starter — home, about, contact — installs as a draft.",
  "payload": "blueprint.ts", // the file that default-exports the manifest
  "facets": {
    // category-specific columns on the catalog row
    "vertical": "services", // retail | b2b | content | services
    "requiredModules": ["builder", "cms", "email"],
  },
  "pricing": { "model": "free", "priceCents": 0 }, // free | one_time | subscription
  "media": [
    { "file": "media/icon.png", "kind": "icon", "alt": "Studio icon" },
    { "file": "media/preview.png", "kind": "preview", "alt": "Studio home page" },
  ],
  "author": { "displayName": "sparx", "website": "https://sparx.works" },
  "accent": "#6366f1", // optional card accent
  "sortWeight": 50, // optional; higher sorts earlier in browse
}
```

`facets.vertical` and `facets.requiredModules` override the manifest's values for the
**catalog row** (what filters/badges read); keep them in sync with the manifest.

---

## 3. The manifest (`blueprint.ts`)

`export default` an object validated by `BlueprintSchema` + cross-reference integrity
checks. Top-level shape (full field reference:
[`manifest.ts`](../../packages/blueprints/src/manifest.ts)):

| Field             | Required | What it is                                                                        |
| ----------------- | -------- | --------------------------------------------------------------------------------- |
| `key`             | ✓        | Stable id, kebab-case. Matches `sparx.json.slug`.                                 |
| `version`         | ✓        | Semver `x.y.z`. Matches `sparx.json.version`. Bump to publish an update.          |
| `name`            | ✓        | Display name (≤120).                                                              |
| `summary`         | ✓        | One/two sentences (≤500) — the card blurb.                                        |
| `vertical`        | ✓        | `retail \| b2b \| content \| services`.                                           |
| `requiresModules` | ✓        | The modules the install enables (see the integrity rules).                        |
| `brand`           | ✓        | Business name, tagline, colors, fonts, optional logo/favicon asset ids.           |
| `theme`           | ✓        | The named theme this template ships (base preset + overlay + brand look).         |
| `assets`          |          | MediaAsset declarations referenced by `*AssetId` fields + `{ $asset }` body refs. |
| `contentTypes`    |          | Custom CMS content types to create (most templates omit — use built-ins).         |
| `content`         |          | Content entries (e.g. blog posts, pages). Default status `draft`.                 |
| `commerce`        |          | Categories, collections, products (by handle).                                    |
| `components`      |          | Tenant components (reusable node trees) placed via `custom:<key>`.                |
| `layout`          |          | The site chrome (header · Outlet · footer). Becomes the property's active layout. |
| `pages`           |          | Singleton pages (home/about/…) and collection templates (product/post detail).    |
| `emails`          |          | Email node-trees (welcome, receipt, …). Default not published.                    |

**Golden rules**

1. **Reference by handle, never by id.** The manifest can't know runtime UUIDs.
   Categories link by `parentHandle`; products link by `categoryHandles` /
   `collectionHandles`; collections list `productHandles`; record-bound images carry
   an `*AssetId` that names an entry in `assets`.
2. **Trees are real builder nodes**, built with the `node()` helper and bound to the
   theme via tokens, so they **re-theme** to the installing tenant.
3. **Everything installs to DRAFT.** The tenant reviews in "Review & go live", then
   publishes. Product status, content status, and email publish all default off.

> **The committed `blueprint.ts` must be SELF-CONTAINED data — no `@sparx/*` imports.**
> The ingest dynamic-imports the payload from `marketplace-catalog/` (not a workspace
> package), so a bare `import { seedNode } from '@sparx/builder-schemas'` in the
> committed file fails to resolve (`ERR_MODULE_NOT_FOUND`). Author the trees with the
> `node()` helper in a **generator** under `marketplace-catalog/_gen/` that imports the
> helper by **relative path** (`../../packages/builder-schemas/src/index`) and
> serializes the compiled manifest to `blueprint.ts` as `export default { … }`. The
> theme + component bundles use exactly this generator mechanism — see
> [`_gen/gen-theme-bundles.ts`](../../marketplace-catalog/_gen/gen-theme-bundles.ts) and
> [`_gen/gen-component-bundles.ts`](../../marketplace-catalog/_gen/gen-component-bundles.ts).
> A **captured** blueprint like [`sparx`](../../marketplace-catalog/blueprints/sparx/) skips
> this entirely: its `site.json` comes from `blueprint:capture` / the MCP `get_silica_site`
> read, already serialized, so there is no `node()` authoring to generate.

### Minimal manifest skeleton (authoring view)

```ts
import { seedNode, type BuilderNode } from '@sparx/builder-schemas';

let n = 0;
const node = (type: string, opts: Parameters<typeof seedNode>[2] = {}): BuilderNode =>
  seedNode(`ss-${(n += 1)}`, type, opts);

const manifest = {
  key: 'studio-starter',
  version: '1.0.0',
  name: 'Studio Starter',
  summary: 'A clean three-page site for a small studio — home, about, contact.',
  vertical: 'services',
  requiresModules: ['builder', 'cms', 'email'],
  brand: {
    businessName: 'Studio',
    tagline: 'Design that works as hard as you do.',
    colors: { primary: '#111827', primaryForeground: '#ffffff', accent: '#6366f1' },
    fonts: { heading: 'Space Grotesk', body: 'Inter' },
  },
  theme: {
    name: 'Studio',
    basePresetKey: 'apex',
    presentation: { v: 2, containerWidth: '1140px' },
    brand: {
      colorPrimary: '#111827',
      colorAccent: '#6366f1',
      fontHeading: 'Space Grotesk',
      fontBody: 'Inter',
      tokens: { radiusBase: '10px' },
    },
    apply: true,
  },
  layout: { name: 'Studio layout', tree: layoutTree(), makeActive: true },
  pages: [{ name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Studio' }],
};

export default manifest;
```

Start from the complete worked example at
[`marketplace-catalog/blueprints/sparx/blueprint.ts`](../../marketplace-catalog/blueprints/sparx/blueprint.ts).

---

## 4. Authoring trees (`node()` / `seedNode`)

Pages, layouts, components, and emails are all **builder node trees** — the same JSON
the visual editor emits. Build them with the seed factory:

```ts
seedNode(id, type, { box, layout, props, bind, cls, name, children });
```

- `id` — unique within the tree (use a counter prefix like `ss-1`, `ss-2`).
- `type` — a node primitive (below).
- `box` — the block's own framing (background, padding, height, alignment).
- `layout` — how a **container** arranges its children.
- `props` — leaf content (text, label, href, level, …).
- `bind` — a data binding path (e.g. `page.title`, `product.images`, `site.identity`).
- `children` — child nodes (containers only).

`seedNode` compiles `box` + `layout` into a class string. The one structural case it
splits into two elements is a **full-bleed band with contained content**
(`backgroundWidth: 'full'` + `contentWidth: 'contained'`): an outer band painting the
background, wrapping an inner centered `max-w-site` column. Everything else is one
element.

### Node primitives

**Containers** (carry `children` + `layout`): `Section`, `Stack`, `Grid`, `Card`,
`Carousel`, `ProductForm`.

**Leaves** (content; no children) include: `Heading`, `Text`, `Prose`, `Button`,
`Badge`, `Icon`, `Divider`, `PriceTag`, `Image`, `ImageDisplay`, `Video`, `Map`,
`Stat`, `Wordmark`, `Logo`, `NavMenu`, `SocialLinks`, `Signup`, `ThemeToggle`,
`FAQ`, `FeatureGrid`, `EditorialSection`, `Lightbox`.

**Commerce leaves** (only meaningful on a `commerce.product` collection page, bound
to the record): `BuyBox`, `VariantPicker`, `Quantity`, `AddToCart`.

**Structural**: `Outlet` — the page slot inside a `layout` tree. **Required and the
only required node in a layout** (it is pinned: never deletable/draggable). Header,
footer, and sidebars are author-composed around it.

**Email leaves**: `email_wordmark`, `line_item_table`, `unsubscribe_link`,
`physical_address` (plus the shared leaves above) for `emails[].tree`.

The Add palette in the builder is the **data-driven catalog** of pre-composed blocks
([`packages/builder-schemas/src/catalog/`](../../packages/builder-schemas/src/catalog/)) —
authoring a tree by hand uses the same primitives those compose from.

### `box` vocabulary (framing)

| Field                                  | Values                                        | Notes                                                                       |
| -------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| `name`                                 | string                                        | Author label shown in the Layers tree.                                      |
| `surface`                              | `none \| subtle \| muted \| inverse \| brand` | Background fill from tokens (`brand` = primary).                            |
| `padding`                              | `none \| sm \| md \| lg \| xl`                | `lg`/`xl` ease tighter on small containers (container queries).             |
| `height`                               | `auto \| sm \| md \| lg \| xl \| full`        | Band height in viewport fractions; `lg` ≈ 75vh (hero).                      |
| `align`                                | `start \| center \| end`                      | Text alignment of the block's content.                                      |
| `backgroundWidth`                      | `full \| contained`                           | Does the surface span edge-to-edge or hug the content.                      |
| `contentWidth`                         | `full \| contained`                           | Does content span full width or sit in the centered `max-w-site` column.    |
| `backgroundImage`                      | absolute URL                                  | A full-bleed photo. A URL is data — hot-link it (don't put it in `assets`). |
| `backgroundImageBinding`               | path                                          | A per-record photo (e.g. `product.images`).                                 |
| `overlay`                              | `none \| dark \| light \| gradient`           | Scrim over a background image for legibility.                               |
| `textTone`                             | `default \| light \| dark`                    | Text color over a photo, decoupled from `surface`.                          |
| `backgroundFit` / `backgroundPosition` | `cover/contain` / `center…`                   | Photo framing.                                                              |
| `pin`                                  | `none \| top`                                 | `top` floats the block over the next one (overlay header).                  |

### `layout` vocabulary (container arrangement)

| Field        | Values                              | Notes                                                                                               |
| ------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `direction`  | `stack \| row \| grid`              | Column / horizontal / N-column grid.                                                                |
| `columns`    | number                              | Grid column count.                                                                                  |
| `gap`        | `none \| sm \| md \| lg`            | Space between children.                                                                             |
| `justify`    | `start \| center \| end \| between` | Main-axis distribution.                                                                             |
| `alignItems` | `start \| center \| end \| stretch` | Cross-axis alignment.                                                                               |
| `wrap`       | boolean                             | Allow a row to wrap.                                                                                |
| `collapse`   | boolean                             | Row only. `false` keeps it inline at EVERY width (the app-bar / header lockup that must not stack). |

### Hero example

```ts
node('Section', {
  box: {
    name: 'Hero',
    height: 'lg',
    backgroundWidth: 'full',
    contentWidth: 'contained',
    align: 'center',
    padding: 'xl',
    backgroundImage: 'https://images.example.com/hero.jpg',
    overlay: 'dark',
    textTone: 'light',
  },
  layout: { direction: 'stack', gap: 'md', justify: 'center', alignItems: 'center' },
  children: [
    node('Heading', {
      box: { align: 'center' },
      props: { level: 'h1', text: 'Roasted the morning it ships' },
    }),
    node('Text', {
      box: { align: 'center' },
      props: { variant: 'body', text: 'Single-origin beans, sent fresh.' },
    }),
    node('Button', { props: { label: 'Shop the roasts', style: 'primary', href: '/shop' } }),
  ],
});
```

### Binding to records (`bind`)

On a **collection** page (a detail template for a record type), leaves bind to the
record instead of carrying literal text:

```ts
node('Heading', { props: { level: 'h1' }, bind: 'page.title' }); // CMS page/post title
node('Text', { props: { variant: 'body' }, bind: 'page.body' }); // rich body
node('Section', { box: { backgroundImageBinding: 'product.images' } }); // product hero photo
node('Wordmark', { bind: 'site.identity' }); // the tenant's brand name
node('SocialLinks', { bind: 'site.social' }); // the site's social links
```

---

## 5. Brand + theme

The template ships its **own named theme** (docs/85 §7): a base preset + a Token Model
v2 `presentation` overlay + a brand `look`. The installer creates a tenant `SiteTheme`
and applies it. It's data — fully editable after install, no deploy.

```ts
theme: {
  name: 'Ember',                  // the saved theme's name
  basePresetKey: 'market',        // one of the 6 foundations: apex | industrial | drift | market | fleet | drop
  presentation: { v: 2, containerWidth: '1200px' },
  brand: {                        // the brand "look" snapshot — colors + fonts + shape tokens
    colorPrimary: '#9a3412',
    colorPrimaryForeground: '#fff7ed',
    colorAccent: '#ea580c',
    fontHeading: 'Fraunces',
    fontBody: 'Inter',
    tokens: { radiusBase: '10px' },
  },
  apply: true,                    // set + apply on install (default true)
}
```

`brand` (top-level manifest) is the business **identity** (name, tagline, colors,
fonts, optional logo/favicon asset ids); `theme.brand` is the **look** the theme
applies. Keep the two color/font sets consistent. Fonts are Google-font family names
(loaded by the renderer); don't ship font files.

---

## 6. Commerce (optional)

Set `commerce` only for a selling template (and list `commerce` in `requiresModules`).
Everything links **by handle**.

```ts
commerce: {
  categories: [
    { handle: 'beans', name: 'Beans', featured: true },
    { handle: 'single-origin', name: 'Single Origin', parentHandle: 'beans' },
  ],
  collections: [
    { handle: 'best-sellers', name: 'Best Sellers', type: 'manual', productHandles: ['ethiopia-yirg'] },
  ],
  products: [
    {
      handle: 'ethiopia-yirg',
      title: 'Ethiopia Yirgacheffe',
      status: 'draft',                       // installs draft; tenant publishes
      categoryHandles: ['single-origin'],
      collectionHandles: ['best-sellers'],
      options: [{ name: 'Size', values: [{ value: '12oz' }, { value: '2lb' }] }],
      variants: [
        { sku: 'ETH-12', priceCents: 1800, optionValues: { Size: '12oz' }, isDefault: true },
        { sku: 'ETH-2LB', priceCents: 4200, optionValues: { Size: '2lb' } },
      ],
      images: [{ assetId: 'eth-bag', isPrimary: true }],   // assetId → an entry in `assets`
    },
  ],
}
```

Integrity rules the validator enforces (see §9): unique handles/SKUs; `parentHandle`
must exist and can't be self; product `categoryHandles`/`collectionHandles` and
collection `productHandles` must resolve; declare options before variants; every
variant sets **every** option; **exactly one** `isDefault` variant and **one**
`isPrimary` image per product; `rules` collections need a `ruleSet`, `manual` ones
must not.

Product images are **record-bound** → they go through `assets` (an `*AssetId`),
**not** a hot-linked URL. Static tree images (hero/section backgrounds) hot-link a URL.

---

## 7. Content + content types

`content[]` entries seed CMS records. Most templates use **built-in** types (`page`,
`blog_post`, …) — only declare a `contentTypes[]` entry for a custom type. Bodies are
opaque JSON validated against the type's schema at install; rich text uses the
ProseMirror `doc` shape:

```ts
const doc = (...paragraphs: string[]): Record<string, unknown> => ({
  type: 'doc',
  content: paragraphs.map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })),
});

content: [
  {
    typeKey: 'page',
    slug: 'about',
    status: 'draft',
    body: { title: 'About us', excerpt: 'Who we are.', body: doc('We roast small-batch coffee…') },
  },
];
```

An `asset`-typed field inside a body uses a `{ $asset: '<id>' }` ref (`assetRef('id')`
from `@sparx/blueprints`) that names an entry in `assets`.

---

## 8. Layout, pages, emails

**Layout** — the site chrome. One `Section` with `direction: 'stack'` containing a
header `Section`, the `Outlet`, and a footer `Section`. `makeActive: true` makes it the
property's active layout.

**Pages** — two kinds:

- `kind: 'singleton'` — a one-off route (home, about). Set `slug` for non-home pages
  (`about`, `contact`); omit for home. May carry `seoTitle`/`seoDescription`/`ogImage`.
- `kind: 'collection'` — a **template** for a record type. Set `recordType`
  (`cms.page`, `cms.blog_post`, `commerce.product`) and `isDefault: true` to make it
  the default template. Leaves `bind` to the record.

```ts
pages: [
  { name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Ember Roasting' },
  { name: 'About', kind: 'singleton', slug: 'about', tree: aboutTree() },
  {
    name: 'Product',
    kind: 'collection',
    recordType: 'commerce.product',
    isDefault: true,
    tree: productTpl(),
  },
];
```

**Emails** — node-trees for transactional/marketing emails. Default `publish: false`.
Compose from the email leaves (`email_wordmark`, `line_item_table`, …).

---

## 9. Validation & integrity (what gets checked)

The ingest runs `safeParseBlueprint` = **Zod schema** + **cross-reference integrity**
([`validate.ts`](../../packages/blueprints/src/validate.ts)). A failure denies the
bundle with the offending path. Beyond the commerce rules in §6:

- Every `*AssetId` and every `{ $asset }` body ref resolves to a declared `assets[]`
  id; asset ids are unique.
- `content[].typeKey` is built-in or declared in `contentTypes`; slugs are unique per
  type.
- A `collection` page has a `recordType`; a `singleton` page has none; only a
  collection page may be `isDefault`; at most one default per `recordType`; singleton
  slugs are unique.
- **`requiresModules` covers the content** the template ships:
  - commerce content → must list `commerce`
  - `content[]` → must list `cms`
  - `emails[]` → must list `email`
  - any pages/layout/components → must list `builder`

Validate locally before ingesting — write a tiny script or a unit test that calls
`parseBlueprint(manifest)` (throws with the issues), or just run the ingest (it
validates first and denies with the reason).

---

## 10. Media (the two card images)

Every bundle ships `media/icon.png` (512×512) and `media/preview.png` (~1600×1000).
`preview.png` should be a **screenshot of the installed home page** (it becomes the
card hero). Two ways to make them:

1. **Author HTML and screenshot it.** Build a static HTML approximation of the home
   page (the design mockups under [`docs/mockups/examples/`](../mockups/examples/) are
   exactly this), open it at 1600×1000 in a headless browser, and screenshot. A
   Playwright one-liner (`page.setViewportSize` → `page.goto(fileURL)` →
   `page.screenshot`) is enough; see the pattern in
   [`apps/dashboard/_marketplace-assets.mjs`](../../apps/dashboard/_marketplace-assets.mjs).
2. **Install it and screenshot the real site** (highest fidelity): ingest locally,
   install into a dev tenant, screenshot the rendered home page.

The `icon` is a simple square mark (a monogram on the brand color works well).

---

## 11. Ingest (publish the template)

**Local** (docker Postgres + local storage):

```bash
pnpm --filter @sparx/api-rest marketplace:ingest
```

It reads every bundle under `marketplace-catalog/`, validates, writes the artifact +
upserts the thin row. **Idempotent**: re-running the same `version` is a no-op write
(artifacts are immutable per version). To publish an update, **bump `version`** in
both `sparx.json` and the manifest, then ingest again.

**Prod** (Cloud SQL + GCS, in-cluster):

```bash
gh workflow run marketplace-ingest.yml
```

This builds the api-rest image with `marketplace-catalog/` baked in, pushes it under a
distinct `marketplace-ingest-<sha>` tag (never touching `:latest`), and applies a
one-off Job that runs the same ingest with the prod env. Pushing the bundle to `main`
ships only the source — the catalog lights up when this workflow runs.

---

## 12. Install + go-live (what a tenant does)

Once published, a tenant installs via the dashboard or `POST /v1/blueprints/:key/install`.
The installer ([`blueprint-installer.ts`](../../services/api-rest/src/lib/blueprint-installer.ts))
replays the manifest **in dependency order** into the target site, all as **draft**:

```
modules → assets → brand identity → theme → content types → content →
commerce (categories → collections → products → variants → images) →
components → layout → pages → emails
```

- It records a `tenant_blueprint_installs` row as the idempotency key + id-map +
  audit trail (one install per blueprint per property).
- Installing onto the **primary** site writes the tenant-wide brand; onto a
  **secondary** site it writes a per-site `brand_override` so siblings aren't rebranded.
- The tenant reviews everything in **"Review & go live"**, then publishes — no deploy.
- **Reset & reinstall** (`POST /v1/blueprints/installs/:id/reset`) tears down
  everything the install created (from the id-map) so it can be installed fresh.

---

## 13. Resetting the catalog (remove templates)

To wipe the **first-party blueprint catalog** (e.g. before ingesting a fresh set):

**Local:**

```bash
pnpm --filter @sparx/api-rest marketplace:purge-blueprints
```

It deletes every Sparx-core `marketplace_blueprints` row **and** every blueprint
artifact + card image in storage (all versions). It does **not** touch
`tenant_blueprint_installs` (a tenant's installed site is torn down via Reset), and it
leaves other catalog categories (themes/components/integrations) alone.

**Prod** (gated, destructive):

```bash
gh workflow run marketplace-purge-blueprints.yml -f confirm=purge-blueprints
```

The workflow refuses to run unless you type the confirmation phrase. After a purge,
author the new bundle(s) and run `marketplace-ingest.yml` to repopulate.

To also remove a template from the **source** so it can't be re-ingested, delete its
`marketplace-catalog/blueprints/<slug>/` folder.

---

## 14. From a design mockup to a template

The next-step workflow: turn a real-site mockup
([`docs/mockups/examples/`](../mockups/examples/)) into a blueprint. The translation:

| In the mockup                                         | → In the blueprint                                                                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand name, logo, palette, fonts                      | `brand` + `theme.brand` (colors, fonts, `radiusBase`). Pick the closest `basePresetKey`.                                                                         |
| The header (logo · nav · CTA)                         | `layout` tree: a header `Section` (`layout.direction: 'row'`, `justify: 'between'`, `collapse: false`) with a `Wordmark`/`Heading`, a `NavMenu`, and a `Button`. |
| The footer                                            | a footer `Section` with `NavMenu`, `SocialLinks`, a `Text` meta line.                                                                                            |
| Each home section (hero, features, gallery, CTA band) | a `Section` in the home page tree. Full-bleed photo bands → `backgroundWidth: 'full'` + `backgroundImage` + `overlay`. Feature rows → `Grid`/`Card`.             |
| Secondary pages (about, contact)                      | `kind: 'singleton'` pages with their own trees + `slug`.                                                                                                         |
| A products/shop grid                                  | `commerce` (categories, products, variants, images) + a `commerce.product` collection template page.                                                             |
| A blog/news list                                      | `content[]` `blog_post` entries + a `cms.blog_post` collection template.                                                                                         |
| Section/hero photography                              | hot-link absolute URLs in `box.backgroundImage`. Product imagery → `assets` + `*AssetId`.                                                                        |

Recipe:

1. **Pick the vertical + modules.** Selling → `commerce` (+ `builder`); publisher →
   `cms`; services/lead-gen → `cms` + `email`. List them in `requiresModules`.
2. **Lift the brand + theme** from the mockup's colors/fonts; choose the nearest base
   preset.
3. **Build the layout** (header/Outlet/footer) once — it frames every page.
4. **Build the home page** section by section, top to bottom, as `Section`s.
5. **Add secondary pages**, then commerce/content if the template sells/publishes.
6. **Capture media** (§10): screenshot the home page → `preview.png`; make an `icon.png`.
7. **Ingest locally**, install into a dev tenant, eyeball it, iterate (bump `version`).
8. **Ship**: push the bundle to `main`, then run `marketplace-ingest.yml`.

---

## 15. Checklist

- [ ] `marketplace-catalog/blueprints/<slug>/` with `sparx.json`, `blueprint.ts`, `media/{icon,preview}.png`.
- [ ] `slug` (folder) == `sparx.json.slug` == `manifest.key`; `version` matches in both.
- [ ] `requiresModules` covers every module the content needs (commerce/cms/email/builder).
- [ ] All references resolve by handle/assetId; one default variant + one primary image per product.
- [ ] `layout` has exactly one `Outlet`; pages set `kind` correctly (singleton vs collection + recordType).
- [ ] Static images hot-link URLs; record-bound images use `assets` + `*AssetId`.
- [ ] `pnpm --filter @sparx/api-rest marketplace:ingest` succeeds locally and the template installs cleanly into a dev tenant.
- [ ] `preview.png` reflects the actual home page.
