# Blueprint submission

A **blueprint** provisions a whole themed site in one install — brand + theme,
content, an optional commerce catalog, a site layout, pages, and emails. It is a
declarative manifest; the installer replays it through the platform's services. No
submitter code runs.

## Bundle

```
studio-starter/
  sparx.json     # category: "blueprint"; facets: vertical, requiredModules[]
  blueprint.ts   # exports the manifest object (brand, theme, content, pages, …)
  media/
    preview.png  # a screenshot of the installed home page (card image)
  README.md
```

## Payload contract (`blueprint.ts`)

`export default` a manifest with: `key`, `version`, `name`, `summary`, `vertical`
(`retail | b2b | content | services`), `requiresModules`, `brand`, `theme`, and any
of `assets`, `contentTypes`, `content`, `commerce`, `components`, `layout`, `pages`,
`emails`. See the full field reference in `@sparx/blueprints` (`manifest.ts`).

- Reference everything by **handle** (categories/products/collections link by handle).
- Trees use the allow-listed `node()` helper and bind via tokens.
- Record-bound images go through `assets` (an `*AssetId` ref); static tree images
  hot-link an absolute `https` URL.
- The shipped `theme` is a data overlay on a base preset — or names a marketplace
  theme slug.

## What gets checked

- Parses against the blueprint schema + integrity cross-refs (every handle/ref
  resolves; one default variant + one primary image per product; options declared
  before variants).
- **Price cap by feature counts** — the ceiling scales with products + pages +
  content entries + emails + components. Over-cap → denied with the cap explained.
- Allow-list: only the files above; imports limited to the authoring helper.

## Install

On approval the manifest is stored on the catalog row. **Install** replays it into
the tenant's primary property as a **draft**; the tenant reviews and goes live — no
deploy.
