// Generate the two REQUIRED bundle media images for the service templates —
// media/icon.png (512×512) + media/preview.png (1600×1000) — as clean, on-brand cards
// built from each bundle's OWN theme colours + fonts (read out of its emitted blueprint.ts).
// A marketplace bundle publish REJECTS a missing icon/preview (blueprint-bundles.ts), so
// these must exist; the installed site is the real thing, this is just the catalog card.
//
// Playwright + setContent (no dev server, no DB). Loaded via the .pnpm glob because
// marketplace-catalog has no node_modules (mirrors screenshot-template.mjs).
//
// Usage (repo root):  node marketplace-catalog/_gen/service-sites/media-service.mjs [slug...]
//   no args → every sparx-* bundle whose sparx.json facets.vertical === 'services'.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const BLUEPRINTS = join(repoRoot, 'marketplace-catalog', 'blueprints');

async function loadPlaywright() {
  const pnpmDir = join(repoRoot, 'node_modules', '.pnpm');
  const match = readdirSync(pnpmDir).find((d) => /^playwright@\d/.test(d));
  if (!match) throw new Error('Playwright not found under node_modules/.pnpm — run pnpm install.');
  const entry = join(pnpmDir, match, 'node_modules', 'playwright', 'index.js');
  const mod = await import(pathToFileURL(entry).href);
  return mod.chromium ? mod : mod.default;
}

/** Pull the brand facts the card needs straight out of the emitted blueprint.ts text
 *  (pure regex — no TS import needed). */
function readBrand(slug) {
  const text = readFileSync(join(BLUEPRINTS, slug, 'blueprint.ts'), 'utf8');
  const grab = (re) => text.match(re)?.[1];
  return {
    businessName: grab(/"businessName":\s*"([^"]+)"/) ?? slug,
    tagline: grab(/"tagline":\s*"([^"]+)"/) ?? '',
    primary: grab(/"primary":\s*"(#[0-9A-Fa-f]{6})"/) ?? '#111111',
    primaryFg: grab(/"primaryForeground":\s*"(#[0-9A-Fa-f]{6})"/) ?? '#ffffff',
    accent: grab(/"accent":\s*"(#[0-9A-Fa-f]{6})"/) ?? '#888888',
    heading: grab(/"heading":\s*"([^"]+)"/) ?? 'Georgia',
    body: grab(/"body":\s*"([^"]+)"/) ?? 'system-ui',
  };
}

/** WCAG relative luminance of a #RRGGBB → pick readable ink over it. */
function ink(hex) {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.42 ? '#141210' : '#ffffff';
}

function initials(name) {
  const words = name.replace(/[^A-Za-zÀ-ÿ ]/g, '').trim().split(/\s+/);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || 'S';
}

function fontsHref(heading, body) {
  const fam = (f) => `family=${f.replace(/ /g, '+')}:wght@400;600;700`;
  const uniq = [heading, body].filter((v, i, a) => a.indexOf(v) === i);
  return `https://fonts.googleapis.com/css2?${uniq.map(fam).join('&')}&display=swap`;
}

function previewHtml(b) {
  const fg = ink(b.primary);
  const soft = fg === '#ffffff' ? 'rgba(255,255,255,0.72)' : 'rgba(20,18,16,0.66)';
  const chipInk = ink(b.accent);
  return `<!doctype html><html><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link rel="stylesheet" href="${fontsHref(b.heading, b.body)}"/>
<style>
  *{margin:0;box-sizing:border-box}
  html,body{width:1600px;height:1000px}
  body{background:${b.primary};color:${fg};font-family:'${b.body}',system-ui,sans-serif;
    display:flex;flex-direction:column;justify-content:center;padding:120px 140px;gap:34px}
  .kicker{font-size:22px;font-weight:600;letter-spacing:.32em;text-transform:uppercase;color:${soft}}
  h1{font-family:'${b.heading}',Georgia,serif;font-size:118px;line-height:0.98;font-weight:700;max-width:20ch;letter-spacing:-0.01em}
  p{font-size:34px;line-height:1.4;max-width:34ch;color:${soft}}
  .row{display:flex;align-items:center;gap:20px;margin-top:12px}
  .btn{background:${b.accent};color:${chipInk};font-weight:700;font-size:26px;padding:20px 40px;border-radius:10px;letter-spacing:.02em}
  .dot{width:14px;height:14px;border-radius:50%;background:${b.accent}}
</style></head>
<body>
  <div class="kicker"><span class="dot" style="display:inline-block;margin-right:14px"></span>Book online</div>
  <h1>${b.businessName}</h1>
  <p>${b.tagline}</p>
  <div class="row"><span class="btn">Book an appointment</span></div>
</body></html>`;
}

function iconHtml(b) {
  const fg = ink(b.primary);
  return `<!doctype html><html><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link rel="stylesheet" href="${fontsHref(b.heading, b.body)}"/>
<style>*{margin:0;box-sizing:border-box}html,body{width:512px;height:512px}
  body{background:${b.primary};color:${fg};display:flex;align-items:center;justify-content:center;
    font-family:'${b.heading}',Georgia,serif;font-weight:700;font-size:230px;letter-spacing:-0.02em}</style></head>
<body>${initials(b.businessName)}</body></html>`;
}

// The NEW booking-backed service templates this pipeline owns. NEVER default to "every
// services-vertical bundle" — the 14 existing generic `services` blueprints (sparx-salon,
// -garage, -clinic…) are hand-maintained and STAY AS-IS; sweeping them here would
// overwrite their committed card art. Pass explicit slugs to target a later block.
const OWNED = [
  'sparx-salon-editorial',
  'sparx-salon-modern',
  'sparx-barber-heritage',
  'sparx-barber-modern',
  'sparx-tattoo-dark',
  'sparx-tattoo-fineline',
];

async function serviceSlugs() {
  const args = process.argv.slice(2);
  const slugs = args.length ? args : OWNED;
  return slugs.filter((slug) => existsSync(join(BLUEPRINTS, slug, 'sparx.json')));
}

async function main() {
  const { chromium } = await loadPlaywright();
  const slugs = await serviceSlugs();
  const browser = await chromium.launch();
  try {
    for (const slug of slugs) {
      const b = readBrand(slug);
      const mediaDir = join(BLUEPRINTS, slug, 'media');
      await fs.mkdir(mediaDir, { recursive: true });

      const pv = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
      await pv.setContent(previewHtml(b), { waitUntil: 'networkidle' });
      await pv.screenshot({ path: join(mediaDir, 'preview.png') });
      await pv.close();

      const ic = await browser.newPage({ viewport: { width: 512, height: 512 } });
      await ic.setContent(iconHtml(b), { waitUntil: 'networkidle' });
      await ic.screenshot({ path: join(mediaDir, 'icon.png') });
      await ic.close();

      console.log(`✓ ${slug}: icon.png + preview.png (${b.businessName})`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
