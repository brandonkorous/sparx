// ENTRY for the farm-fresh blueprint generator (docs/guides/building-a-template.md
// §3). Modeled on docs/mockups/examples/farmfreshbowls.html — a warm, organic DTC food
// brand that exercises the whole platform: a real commerce catalog (açaí bowls,
// smoothies, salads), a CMS story/blog, a full themed site (layout + home + story +
// locations + catering + contact + journal + product & post templates), and a welcome
// email.
//
// This file is THIN by design: the authoring vocabulary is split into the
// ./farm-fresh/ module folder (one cohesive concern per file — _kit, theme, media,
// sections, the page trees, layout, email), so neither a human nor a model has to hold a
// 1,000-line wall in their head. `manifest.ts` assembles the blueprint (and owns the
// shared node-id ordering); `emit.ts` serializes it to the multi-file payload.
//
// Why a generator at all: the ingest dynamic-imports the bundle's blueprint.ts from
// marketplace-catalog/ (NOT a workspace package), so that committed payload must be
// SELF-CONTAINED data with no `@sparx/*` imports. The modules here author the manifest
// with the real `node()` helper (imported by RELATIVE path so tsx resolves the package
// source) and serialize the compiled result to a thin entry + ./parts/* under the bundle.
//
// Run (then format the emitted payload — it ships in the prettier-checked bundle):
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-farm-fresh.ts"
//   npx prettier --write "marketplace-catalog/blueprints/farm-fresh/**/*.ts"
//
// Reference by HANDLE/assetId, never id; trees bind via tokens so they re-theme to the
// tenant; everything installs to DRAFT for the tenant to review + publish.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emitBundle } from './farm-fresh/emit';
import { manifest } from './farm-fresh/manifest';

const here = dirname(fileURLToPath(import.meta.url)); // marketplace-catalog/_gen
const bundleDir = join(here, '..', 'blueprints', 'farm-fresh');

await emitBundle(bundleDir, manifest);
