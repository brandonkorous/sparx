// SCRATCH asset renderer (not committed): reads marketplace-catalog/_assets/*.json
// and screenshots each item's preview (1600x1000) + icon (512x512) into its bundle's
// media/ dir using the dashboard's bundled Playwright chromium.
// Run: pnpm --filter @sparx/dashboard exec node apps/dashboard/_marketplace-assets.mjs

import { chromium } from '@playwright/test';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url)); // apps/dashboard
const catalog = join(here, '..', '..', 'marketplace-catalog');
const assetsDir = join(catalog, '_assets');

let tmpSeq = 0;

async function shoot(page, html, outPath, width, height) {
  const tmp = join(tmpdir(), `mpgen-${process.pid}-${tmpSeq++}.html`);
  await fs.writeFile(tmp, html);
  await page.setViewportSize({ width, height });
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width, height } });
  await fs.rm(tmp, { force: true });
}

async function main() {
  let files;
  try {
    files = (await fs.readdir(assetsDir)).filter((f) => f.endsWith('.json'));
  } catch {
    console.error(`no _assets dir at ${assetsDir}`);
    process.exit(1);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  let count = 0;
  for (const file of files) {
    const specs = JSON.parse(await fs.readFile(join(assetsDir, file), 'utf8'));
    for (const s of specs) {
      const mediaDir = join(catalog, s.category, s.slug, 'media');
      await fs.mkdir(mediaDir, { recursive: true });
      await shoot(page, s.previewHtml, join(mediaDir, 'preview.png'), 1600, 1000);
      await shoot(page, s.iconHtml, join(mediaDir, 'icon.png'), 512, 512);
      count++;
      console.log(`  ${s.category}/${s.slug}`);
    }
  }
  await browser.close();
  console.log(`gen-assets: rendered ${count} item(s) x (preview + icon)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
