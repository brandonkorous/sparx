// ENTRY for the tempo blueprint generator (docs/guides/building-a-template.md §3).
// Modeled on docs/mockups/examples/adidas.html — a stark black-on-white athletic /
// sportswear storefront that exercises the whole platform: a real commerce catalog
// (sneakers, cleats, apparel across four categories), a CMS news section, a full themed
// site (layout + a campaign home + shop + club + story + help + news + product & article
// templates), and brand-voiced emails. The brand is generic ("Tempo", the "»" motion-mark)
// — a shipped first-party blueprint must not carry a competitor's trademark.
//
// This file is THIN by design: the authoring vocabulary is split into the ./tempo/ module
// folder (one cohesive concern per file — _kit, theme, logo, media, sections, commerce,
// cms, the page trees, layout, email), so neither a human nor a model has to hold a
// 1,000-line wall in their head. `manifest.ts` assembles the blueprint (and owns the
// shared node-id ordering); `emit.ts` serializes it to the multi-file payload.
//
// Why a generator at all: the ingest dynamic-imports the bundle's blueprint.ts from
// marketplace-catalog/ (NOT a workspace package), so that committed payload must be
// SELF-CONTAINED data with no `@sparx/*` imports. The modules here author the manifest with
// the real `node()`/`el()`/`atom()` helpers (imported by RELATIVE path so tsx resolves the
// package source) and serialize the compiled result to a thin entry + ./parts/* under the
// bundle.
//
// Run (then format the emitted payload — it ships in the prettier-checked bundle):
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-tempo.ts"
//   npx prettier --write "marketplace-catalog/blueprints/tempo/**/*.ts"
//
// Reference by HANDLE/assetId, never id; trees bind via tokens so they re-theme to the
// tenant; everything installs to DRAFT for the tenant to review + publish.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emitBundle } from './tempo/emit';
import { manifest } from './tempo/manifest';

const here = dirname(fileURLToPath(import.meta.url)); // marketplace-catalog/_gen
const bundleDir = join(here, '..', 'blueprints', 'tempo');

await emitBundle(bundleDir, manifest);
