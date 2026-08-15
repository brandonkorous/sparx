// Preview renderer for the SHOWCASE bundles — the captured-site family.
//
// The reference site-templates get their preview from `writeTemplatePreview`,
// which composes pages from a `TemplateSiteSpec`. The showcase bundles have no
// spec: their site is CAPTURED from a live tenant, frame and pages pulled
// verbatim. So they had no preview path at all, which is why their `media/` was
// hand-made and why a new one in the family inherits another bundle's picture.
//
// This gives them one, through the SAME renderer — `writeSitePreview`, the half
// of the template path below the compose step, which was always generic.
//
// Usage (from repo root):
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/preview-showcase.ts" <slug>...
//
// Output: marketplace-catalog/_gen/.preview/preview-<slug>.html (gitignored), which
// `screenshot-template.mjs <slug>` then renders to a full-page PNG. Both steps are
// file:// only — no dev server, no database, no install.

import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Node, Theme } from '../../packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';

import { writeSitePreview, PREVIEW_DIR } from './template-sites/preview';

const here = dirname(fileURLToPath(import.meta.url));
const blueprintsDir = join(here, '..', 'blueprints');

interface CapturedSite {
  frame: { root: Node };
  pages: { name: string; root: Node }[];
  theme: Theme;
}

interface ShowcaseBundle {
  key: string;
  name: string;
  brand: { businessName: string };
  commerce: unknown;
  assets: unknown;
  content: unknown;
  site: CapturedSite;
}

async function previewOne(slug: string): Promise<void> {
  const entry = join(blueprintsDir, slug, 'blueprint.ts');
  try {
    await fs.access(entry);
  } catch {
    throw new Error(`preview-showcase: no bundle at blueprints/${slug}/blueprint.ts`);
  }

  // Cache-busted: this runs right after a generator rewrote the file, and a warm
  // module cache would render the previous build while reporting success.
  const mod = (await import(
    `${pathToFileURL(entry).href}?t=${String(Date.now())}`
  )) as { default: ShowcaseBundle };
  const bp = mod.default;

  if (!bp.site?.frame?.root || !Array.isArray(bp.site.pages)) {
    throw new Error(
      `preview-showcase: ${slug} has no captured site (frame + pages) — this renderer is ` +
        'for the showcase family; a reference template previews through its own generator.'
    );
  }

  const { path } = await writeSitePreview({
    slug,
    title: `${bp.brand.businessName} — ${bp.name} preview`,
    businessName: bp.brand.businessName,
    frameRoot: bp.site.frame.root,
    pages: bp.site.pages,
    // Bound content resolves against the bundle's OWN records, so the preview
    // shows the six demo goods and the journal posts a tenant would actually get.
    source: {
      slug,
      commerce: bp.commerce,
      assets: bp.assets,
      content: bp.content,
      brand: bp.brand,
    },
    theme: bp.site.theme,
  });

  console.log(`  · ${slug.padEnd(20)} ${bp.site.pages.length} pages → ${path}`);
}

async function main(): Promise<void> {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) {
    console.error('usage: preview-showcase.ts <slug>...');
    process.exitCode = 1;
    return;
  }
  await fs.mkdir(PREVIEW_DIR, { recursive: true });
  for (const slug of slugs) await previewOne(slug);
  console.log(`preview-showcase: wrote ${slugs.length} preview(s)`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
