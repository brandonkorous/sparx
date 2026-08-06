// Standardized full-site SCREENSHOT step for the reference-driven site templates.
//
// The third build oracle, made repeatable for template #1 through template #100+: after a
// generator runs (emit → safeParseBlueprint → writeTemplatePreview), it drops a self-contained
// `.preview/preview-<slug>.html` holding EVERY page of the site (Home, Shop, Collections, Cart,
// Search, Journal, About, Contact, Product), stacked under sticky page labels, in the bundle's
// real theme. This script renders each one in headless Chrome and writes a full-page PNG beside
// it, so a whole site's authored design can be eyeballed in one image.
//
// Usage (from repo root):
//   node marketplace-catalog/_gen/screenshot-template.mjs <slug> [slug...]
//   node marketplace-catalog/_gen/screenshot-template.mjs all      # every preview in .preview/
//
// Output: marketplace-catalog/_gen/.preview/site-<slug>.png  (gitignored, like the HTML).
//
// WHY file:// + Playwright (not the claude-in-chrome MCP): the preview is a local file and needs
// no dev server, no DB, no install — it renders the STAMPED bundle exactly as the storefront
// would, in isolation. The MCP blocks file://; Playwright does not. Nothing here touches a
// running dev stack.
//
// WHY the .pnpm glob for Playwright: marketplace-catalog has no node_modules, and pnpm does not
// hoist playwright to the workspace root, so a bare `import 'playwright'` can't resolve from here.
// Finding the versioned dir under node_modules/.pnpm keeps this working across version bumps
// without a hard-coded path.

import { readdirSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const PREVIEW_DIR = join(here, '.preview');

/** Resolve Playwright from the workspace's pnpm store, version-agnostically. */
async function loadPlaywright() {
  const pnpmDir = join(repoRoot, 'node_modules', '.pnpm');
  const match = readdirSync(pnpmDir).find((d) => /^playwright@\d/.test(d));
  if (!match) {
    throw new Error(
      'Playwright not found under node_modules/.pnpm — run `pnpm install` at the repo root first.'
    );
  }
  const entry = join(pnpmDir, match, 'node_modules', 'playwright', 'index.js');
  const mod = await import(pathToFileURL(entry).href);
  // playwright's index is CJS — under ESM interop `chromium` may sit on the namespace or on
  // `.default` depending on Node's analysis. Return whichever actually carries it.
  return mod.chromium ? mod : mod.default;
}

async function slugsFromArgs() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === 'all') {
    const files = await fs.readdir(PREVIEW_DIR).catch(() => []);
    return files
      .filter((f) => /^preview-.*\.html$/.test(f) && !f.endsWith('.body.html'))
      .map((f) => f.replace(/^preview-/, '').replace(/\.html$/, ''));
  }
  return args;
}

async function main() {
  const slugs = await slugsFromArgs();
  if (!slugs.length) {
    console.error('usage: node marketplace-catalog/_gen/screenshot-template.mjs <slug> [slug...] | all');
    process.exit(1);
  }
  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const slug of slugs) {
      const src = pathToFileURL(join(PREVIEW_DIR, `preview-${slug}.html`)).href;
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await page.goto(src, { waitUntil: 'networkidle', timeout: 60000 });
      // Force every lazy image to load so the full-page shot isn't full of grey bands, then
      // wait for fonts + image decode.
      await page.evaluate(async () => {
        for (const img of Array.from(document.images)) {
          img.loading = 'eager';
          if (img.dataset && img.dataset.src && !img.src) img.src = img.dataset.src;
        }
        if (document.fonts) await document.fonts.ready;
        await Promise.all(
          Array.from(document.images).map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise((r) => {
                  img.addEventListener('load', r);
                  img.addEventListener('error', r);
                })
          )
        );
      });
      await page.waitForTimeout(1200);
      const broken = await page.evaluate(
        () => Array.from(document.images).filter((i) => !i.complete || i.naturalWidth === 0).length
      );
      const out = join(PREVIEW_DIR, `site-${slug}.png`);
      await page.screenshot({ path: out, fullPage: true });
      console.log(`${slug}: wrote ${out}${broken ? ` (⚠ ${broken} broken imgs)` : ''}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
