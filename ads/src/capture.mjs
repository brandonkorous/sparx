import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// pnpm keeps playwright-core in the virtual store, not hoisted next to this
// script — resolve it from the workspace root explicitly.
const pwUrl = pathToFileURL(
  path.resolve(
    process.cwd(),
    '../node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core/index.js',
  ),
).href;
const pw = await import(pwUrl);
const chromium = pw.chromium ?? pw.default?.chromium;

const adsDir = path.resolve(process.cwd());
const url = pathToFileURL(path.join(adsDir, 'module-set.html')).href;

const browser = await chromium.launch();
// Viewport at least as large as the biggest frame (1920 on either axis) so element
// screenshots capture in full without scroll seams.
const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 1920, height: 1920 } });
await page.goto(url, { waitUntil: 'networkidle' });

// Each .frame carries its own output path (data-out) from the generator, so naming
// + foldering live in one place and never drift from the ratio/module tables.
const outs = await page.$$eval('.frame', (els) => els.map((el) => el.getAttribute('data-out')));

for (const out of outs) {
  const abs = path.join(adsDir, out);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  await page.locator(`[data-out="${out}"]`).screenshot({ path: abs });
  console.log('wrote', out);
}

await browser.close();
console.log(`done — ${outs.length} creatives`);
