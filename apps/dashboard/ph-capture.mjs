// Temporary Product Hunt gallery capture script. Run from apps/dashboard so
// '@playwright/test' resolves. Safe to delete after the gallery is rendered.
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

const ROOT = 'g:/code/@wizeworks/sparx.works';
const GAL = `${ROOT}/launch/product-hunt/gallery`;
const MOCK = `${ROOT}/mockups`;
const SHOTS = `${GAL}/shots`;
const OUT = `${GAL}/out`;
mkdirSync(SHOTS, { recursive: true });
mkdirSync(OUT, { recursive: true });

const f = (p) => pathToFileURL(p).href;

// Pass A — raw source captures (top fold), embedded later into branded frames.
const RAW = [
  { name: 'workspace', url: f(`${MOCK}/workspace.html`), scroll: '#board' },
  { name: 'builder', url: f(`${MOCK}/builder-canvas-frame.html`), scroll: '.ed' },
  { name: 'storefront', url: f(`${MOCK}/templates/auto-parts.html`) },
  { name: 'consolidate', url: f(`${MOCK}/consolidate.html`) },
  { name: 'pricing', url: 'http://localhost:3003/pricing', fallback: f(`${MOCK}/pricing.html`) },
  { name: 'ai', url: 'http://localhost:3003/ai', fallback: f(`${MOCK}/platform.html`) },
];

// Pass B — final 1270x760 deliverables.
const FINAL = [
  { name: '01-hero', url: f(`${GAL}/01-hero.html`) },
  { name: '02-modules', url: `${f(`${GAL}/frame.html`)}?id=02` },
  { name: '03-ai', url: `${f(`${GAL}/frame.html`)}?id=03` },
  { name: '04-builder', url: `${f(`${GAL}/frame.html`)}?id=04` },
  { name: '05-sites', url: `${f(`${GAL}/frame.html`)}?id=05` },
  { name: '06-stack', url: `${f(`${GAL}/frame.html`)}?id=06` },
  { name: '07-pricing', url: `${f(`${GAL}/frame.html`)}?id=07` },
  { name: '08-permanence', url: f(`${GAL}/08-permanence.html`) },
];

async function settle(page, ms = 700) {
  try {
    await page.evaluate(() => document.fonts && document.fonts.ready);
  } catch {}
  await page.waitForTimeout(ms);
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();

  // Pass A
  for (const t of RAW) {
    await page.setViewportSize({ width: 1280, height: 860 });
    let ok = false;
    try {
      await page.goto(t.url, { waitUntil: 'load', timeout: 120000 });
      try {
        await page.waitForLoadState('networkidle', { timeout: 15000 });
      } catch {}
      await settle(page, t.url.startsWith('http') ? 1400 : 600);
      ok = true;
    } catch (e) {
      console.log(`RAW ${t.name}: primary failed (${e.message.split('\n')[0]})`);
      if (t.fallback) {
        try {
          await page.goto(t.fallback, { waitUntil: 'load', timeout: 60000 });
          await settle(page, 600);
          ok = true;
          console.log(`RAW ${t.name}: used fallback`);
        } catch (e2) {
          console.log(`RAW ${t.name}: fallback failed (${e2.message.split('\n')[0]})`);
        }
      }
    }
    if (ok) {
      if (t.scroll) {
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) el.scrollIntoView({ block: 'start' });
          window.scrollBy(0, -36);
        }, t.scroll);
        await page.waitForTimeout(400);
      }
      await page.screenshot({ path: `${SHOTS}/${t.name}.png` });
      console.log(`RAW ${t.name}: captured`);
    }
  }

  // Pass B
  for (const t of FINAL) {
    await page.setViewportSize({ width: 1270, height: 760 });
    try {
      await page.goto(t.url, { waitUntil: 'load', timeout: 60000 });
      try {
        await page.waitForLoadState('networkidle', { timeout: 10000 });
      } catch {}
      await settle(page, 700);
      await page.screenshot({ path: `${OUT}/${t.name}.png`, clip: { x: 0, y: 0, width: 1270, height: 760 } });
      console.log(`FINAL ${t.name}: rendered`);
    } catch (e) {
      console.log(`FINAL ${t.name}: FAILED (${e.message.split('\n')[0]})`);
    }
  }

  await browser.close();
  console.log('DONE');
}

run().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
