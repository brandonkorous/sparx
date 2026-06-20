// ENTRY for the forge blueprint generator (docs/guides/building-a-template.md §3).
// Modeled on docs/mockups/examples/500designs.html — a bold, dark, award-style marketing
// site for a creative brand & web studio, branded generically as "Forge" (a shipped
// first-party blueprint must not carry a competitor's trademark; see
// blueprints/forge/README.md). It is the dark-theme counterpart to Mosaic: a warm
// near-black canvas with an acid-green accent, exercising the same dense-UI primitives —
// raw HTML elements (the case-study showcase, gradient project thumbs, numbered service
// rows, quote figures, the 4-up stat band), the marquee behavior (the client/awards
// strip), a CMS spine (insight articles + a blog_post template), and emails.
//
// This file is THIN by design: the authoring vocabulary is split into the ./forge/ module
// folder (one cohesive concern per file — _kit, theme, logo, media, sections, data, the
// page trees, layout, cms, email), so neither a human nor a model holds a wall in their
// head. `manifest.ts` assembles the blueprint (and owns the shared node-id ordering);
// `emit.ts` serializes it to the multi-file payload.
//
// Why a generator at all: the ingest dynamic-imports the bundle's blueprint.ts from
// marketplace-catalog/ (NOT a workspace package), so that committed payload must be
// SELF-CONTAINED data with no `@sparx/*` imports. The modules here author the manifest
// with the real helpers (imported by RELATIVE path so tsx resolves the package source)
// and serialize the compiled result to a thin entry + ./parts/* under the bundle.
//
// Run (then format the emitted payload — it ships in the prettier-checked bundle):
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-forge.ts"
//   npx prettier --write "marketplace-catalog/blueprints/forge/**/*.ts"
//
// Reference by HANDLE/assetId, never id; trees bind via tokens so they re-theme to the
// tenant; everything installs to DRAFT for the tenant to review + publish.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emitBundle } from './forge/emit';
import { manifest } from './forge/manifest';

const here = dirname(fileURLToPath(import.meta.url)); // marketplace-catalog/_gen
const bundleDir = join(here, '..', 'blueprints', 'forge');

await emitBundle(bundleDir, manifest);
