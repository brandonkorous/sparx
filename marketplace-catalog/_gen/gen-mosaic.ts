// ENTRY for the mosaic blueprint generator (docs/guides/building-a-template.md §3).
// Modeled on docs/mockups/examples/notion.html — a clean, modern AI-workspace /
// productivity SaaS marketing site, branded generically as "Mosaic" (a shipped
// first-party blueprint must not carry a competitor's trademark; see
// blueprints/mosaic/README.md). It exercises the platform's dense-UI primitives: raw
// HTML elements (browser chrome, faux DB table, bento tiles), the marquee behavior
// (the logo wall), a CMS spine (customer stories + a blog_post template), and emails.
//
// This file is THIN by design: the authoring vocabulary is split into the ./mosaic/
// module folder (one cohesive concern per file — _kit, theme, logo, media, sections,
// the page trees, layout, cms, email), so neither a human nor a model holds a wall in
// their head. `manifest.ts` assembles the blueprint (and owns the shared node-id
// ordering); `emit.ts` serializes it to the multi-file payload.
//
// Why a generator at all: the ingest dynamic-imports the bundle's blueprint.ts from
// marketplace-catalog/ (NOT a workspace package), so that committed payload must be
// SELF-CONTAINED data with no `@sparx/*` imports. The modules here author the manifest
// with the real helpers (imported by RELATIVE path so tsx resolves the package source)
// and serialize the compiled result to a thin entry + ./parts/* under the bundle.
//
// Run (then format the emitted payload — it ships in the prettier-checked bundle):
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-mosaic.ts"
//   npx prettier --write "marketplace-catalog/blueprints/mosaic/**/*.ts"
//
// Reference by HANDLE/assetId, never id; trees bind via tokens so they re-theme to the
// tenant; everything installs to DRAFT for the tenant to review + publish.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emitBundle } from './mosaic/emit';
import { manifest } from './mosaic/manifest';

const here = dirname(fileURLToPath(import.meta.url)); // marketplace-catalog/_gen
const bundleDir = join(here, '..', 'blueprints', 'mosaic');

await emitBundle(bundleDir, manifest);
