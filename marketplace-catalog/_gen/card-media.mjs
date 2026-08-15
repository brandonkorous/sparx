// Shoot a bundle's CARD image — `media/preview.png`, the picture the marketplace
// listing shows.
//
// Distinct from `screenshot-template.mjs`, and the difference matters. That one
// renders the whole review preview — every page stacked under sticky labels — as
// one very tall PNG for a human to eyeball. A CARD wants the home page alone, at
// the catalog's own aspect (~1600×1000), with the review labels gone. Shooting
// the review image into `media/` is how a bundle ends up advertising itself with
// a picture of seven pages and a row of black debug banners.
//
// Usage (from repo root, after preview-showcase.ts has written the HTML):
//   node marketplace-catalog/_gen/card-media.mjs <slug>...
//
// Writes directly to marketplace-catalog/blueprints/<slug>/media/preview.png.
// file:// + Playwright — no dev server, no database, no install.

import { readdirSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const PREVIEW_DIR = join(here, '.preview');
const BLUEPRINTS = join(here, '..', 'blueprints');

const WIDTH = 1600;
const HEIGHT = 1000;

/** Resolve Playwright from the workspace's pnpm store, version-agnostically —
 *  marketplace-catalog has no node_modules of its own. */
async function loadPlaywright() {
  const pnpmDir = join(repoRoot, 'node_modules', '.pnpm');
  const match = readdirSync(pnpmDir).find((d) => /^playwright@\d/.test(d));
  if (!match) {
    throw new Error('Playwright not found under node_modules/.pnpm — run `pnpm install` first.');
  }
  const entry = join(pnpmDir, match, 'node_modules', 'playwright', 'index.js');
  const mod = await import(pathToFileURL(entry).href);
  // playwright's index is CJS — under ESM interop `chromium` sits on the namespace
  // or on `.default` depending on Node's analysis. Return whichever carries it.
  return mod.chromium ? mod : mod.default;
}

async function shoot(browser, slug) {
  const html = join(PREVIEW_DIR, `preview-${slug}.html`);
  try {
    await fs.access(html);
  } catch {
    throw new Error(
      `card-media: no preview at ${html} — run preview-showcase.ts (or the template generator) for "${slug}" first.`
    );
  }

  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle', timeout: 60000 });

  // Drop the review chrome. The labels are sticky and would otherwise sit across
  // the top of the card looking like part of the design.
  await page.addStyleTag({ content: '.__pv-label { display: none !important; }' });

  // Force lazy images in and wait for fonts, or the card is a grey band where the
  // hero should be — the shot is taken before anything above the fold has loaded.
  await page.evaluate(async () => {
    for (const img of Array.from(document.images)) {
      img.loading = 'eager';
      if (!img.complete) await img.decode().catch(() => undefined);
    }
    await document.fonts.ready;
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  const outDir = join(BLUEPRINTS, slug, 'media');
  await fs.mkdir(outDir, { recursive: true });
  const out = join(outDir, 'preview.png');
  // Viewport-clipped, NOT fullPage: the card is the top of the home page at the
  // catalog's aspect, and a full-page shot of a seven-page preview is a 1600×11000
  // strip that renders as an unreadable sliver in a card.
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
  await page.close();
  console.log(`  · ${slug.padEnd(20)} → ${out}`);
}

const ICON_SIZE = 512;

/**
 * Render an SVG mark to the bundle's `media/icon.png`.
 *
 * The icon is NOT a screenshot — the golden's is the platform's own monogram, so
 * the convention for a showcase bundle is the publishing product's mark rather
 * than a picture of the site. On a white ground, matching the existing one; the
 * catalog card sits on a light surface and a transparent PNG would vanish into
 * it in one theme and glow in the other.
 */
async function shootIcon(browser, slug, svgPath) {
  const svg = await fs.readFile(svgPath, 'utf8');
  const page = await browser.newPage({
    viewport: { width: ICON_SIZE, height: ICON_SIZE },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;width:${ICON_SIZE}px;height:${ICON_SIZE}px;background:#ffffff;}
      body{display:flex;align-items:center;justify-content:center;}
      svg{width:78%;height:78%;display:block;}
    </style></head><body>${svg}</body></html>`,
    { waitUntil: 'networkidle' }
  );
  const out = join(BLUEPRINTS, slug, 'media', 'icon.png');
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: ICON_SIZE, height: ICON_SIZE } });
  await page.close();
  console.log(`  · ${slug.padEnd(20)} → ${out}`);
}

async function main() {
  const args = process.argv.slice(2);
  const iconAt = args.indexOf('--icon');
  const iconSvg = iconAt >= 0 ? args[iconAt + 1] : null;
  const slugs = (iconAt >= 0 ? [...args.slice(0, iconAt), ...args.slice(iconAt + 2)] : args).filter(
    Boolean
  );
  if (slugs.length === 0) {
    console.error('usage: card-media.mjs <slug>... [--icon <mark.svg>]');
    process.exit(1);
  }
  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const slug of slugs) {
      await shoot(browser, slug);
      if (iconSvg) await shootIcon(browser, slug, join(repoRoot, iconSvg));
    }
  } finally {
    await browser.close();
  }
  console.log(`card-media: wrote media for ${slugs.length} bundle(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
