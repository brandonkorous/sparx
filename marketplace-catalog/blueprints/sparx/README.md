# sparx blueprint

The first-party reference site — the approved, sparx-branded, vertical-neutral
**Template** (tenant WizeWorks, property "Template") captured into an installable
marketplace blueprint. Full background + locked decisions:
[docs/implementation/perfect-template-blueprint.md](../../../docs/implementation/perfect-template-blueprint.md).

## What's in here

```
sparx/
  sparx.json      # catalog metadata (category:blueprint, payload:blueprint.ts, media)
  blueprint.ts    # the manifest default-export; imports ./site.json
  site.json       # the CAPTURED site (frame + pages + theme + symbols) — generated, not hand-written
  media/          # icon.png (512×512) + preview.png (~1600×1000) — BOTH required by ingest
```

The blueprint has two halves (perfect-template doc, "Two workstreams"):

- **`site` — captured, never hand-transcribed.** The live Template's frame + 7 pages
  (Home, Shop, About, Journal, Contact, Book, Wholesale) + theme + symbols, pulled as
  DATA so it reinstalls byte-identical.
- **`brand` / `theme` / `commerce` / `content` / `emails` — hand-authored in
  `blueprint.ts`**, mirrored from the live tenant for coherence.

## Regenerating `site.json` (the capture step)

`site.json` in the repo is a **placeholder** until captured. Produce the real one from
the live Template, either way:

**A. The capture CLI** (runs against whatever Postgres it can reach — the Template
lives in prod, so run this where that DB is reachable, or point it at a docker DB
seeded from the Template):

```
pnpm --filter @wizeworks/api-rest blueprint:capture -- \
  --tenant 1bfef66a-a489-4e0f-99fd-f041adc7ffaa \
  --property c99e0e23-dae2-4814-b670-b73de5eec0f1 \
  --source published \
  --out marketplace-catalog/blueprints/sparx/site.json
```

**B. The MCP read** (when the live site isn't reachable from a local DB): call
`get_silica_site` (+ `list_silica_pages`) on the Template property and assemble the
`SiteDecl` shape (`{ frame:{root}, pages:[{name,kind,recordType?,slug?,root,seo…}],
theme, symbols }`), dropping runtime ids. Keep `site.theme` (ship the Ember tokens
verbatim, locked decision #2).

## Filling the hand-authored halves

`commerce` (the 6 neutral sparx goods + 1 category `goods` + 1 featured collection),
`content` (the 3 universal journal posts), `emails` (a welcome email), and `assets`
(every product/og image + the wordmark/favicon) are authored in `blueprint.ts`,
mirrored from the live tenant so the bundle is a transcript of something proven — read
the exact handles/SKUs/prices/image URLs via `get_products`, the posts via
`list_content_entries`, and the media via the live media library.

Live ids (products, posts, media, schedule) are catalogued in the perfect-template doc,
"Every id in one place".

## Validate + ingest

```
# validate the manifest parses (safeParseBlueprint runs inside ingest):
pnpm --filter @wizeworks/api-rest marketplace:ingest        # local docker — writes the catalog row + artifact
```

Prod ingest runs through `marketplace-ingest.yml`. Undo a local ingest with
`pnpm --filter @wizeworks/api-rest marketplace:purge-blueprints`.
