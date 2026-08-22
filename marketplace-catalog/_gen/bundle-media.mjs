// The bundle MEDIA step — the fourth build oracle, and the one that was missing.
//
// Every shipped blueprint bundle MUST carry `media/icon.png` + `media/preview.png`; the loader
// (`wizeworks/services/api-rest/src/lib/marketplace/blueprint-bundles.ts`) refuses the bundle without them,
// and `blueprint-bundles.test.ts` refuses the whole catalog. Those two files are hand-maintained
// (they survive a regen — see CLAUDE.md), which is exactly why a second batch of ten templates
// shipped with empty `media/` dirs: generate → validate → preview → screenshot had a documented
// command each, and "make the marketplace card image" had none. This is that command.
//
// Usage (from repo root, AFTER the generator has written .preview/preview-<slug>.html):
//   node marketplace-catalog/_gen/bundle-media.mjs <slug> [slug...]
//   node marketplace-catalog/_gen/bundle-media.mjs all      # every bundle missing media
//   node marketplace-catalog/_gen/bundle-media.mjs stale    # re-shoot every bundle that has a preview
//
// Output, written INTO the bundle (committed, unlike .preview/):
//   blueprints/sparx-<slug>/media/preview.png   1280x900 — the home page in its real chrome
//   blueprints/sparx-<slug>/media/icon.png      512x512  — the shared sparx bundle mark
//
// WHY 1280x900 viewport and not the full page: this is the marketplace DETAIL HERO and the card
// image, so it wants the top of the home page — the frame, the hero, the first band — at the
// same crop every other bundle already ships. `screenshot-template.mjs` is the other shot: full
// page, every page stacked, for review, and it stays gitignored.
//
// WHY the .pnpm glob for Playwright: marketplace-catalog has no node_modules and pnpm does not
// hoist to the workspace root. Same technique, same reason, as `screenshot-template.mjs`.

import { readdirSync, existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const PREVIEW_DIR = join(here, '.preview');
const BLUEPRINTS_DIR = join(here, '..', 'blueprints');

/** The shared bundle mark. Every first-party bundle carries the same icon — the blueprint's own
 *  identity is the preview, the theme and the copy; the icon says "sparx published this". */
const GOLDEN_ICON = join(BLUEPRINTS_DIR, 'sparx', 'media', 'icon.png');

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
  return mod.chromium ? mod : mod.default;
}

/** A bundle is addressable by its KEY (`sparx-restaurant-cafe`) or by the bare slug
 *  (`restaurant-cafe`) — the same directory either way. `piggles-starter` is neither, so
 *  an existing directory always wins over the `sparx-` guess. */
function bundleDirFor(name) {
  const asGiven = join(BLUEPRINTS_DIR, name);
  return existsSync(asGiven) ? asGiven : join(BLUEPRINTS_DIR, `sparx-${name}`);
}

/** The two preview writers disagree about which of those names they stamp into the
 *  filename — `template-sites` writes `preview-<slug>.html`, `service-sites` writes
 *  `preview-<key>.html`. That disagreement is one reason the service bundles were never
 *  shot from a real render at all. Accept either spelling, from either caller. */
function previewHtmlFor(name) {
  const bare = name.replace(/^sparx-/, '');
  for (const candidate of [`preview-${bare}.html`, `preview-sparx-${bare}.html`]) {
    const p = join(PREVIEW_DIR, candidate);
    if (existsSync(p)) return p;
  }
  return null;
}

async function slugsFromArgs() {
  const args = process.argv.slice(2);
  if (args.length && args[0] !== 'all' && args[0] !== 'stale') return args;

  // Every bundle that has a preview HTML to shoot. `all` skips the ones that already
  // have media; `stale` re-shoots them too — which is what a bundle whose card is a
  // synthetic placeholder rather than a picture of the site needs.
  const reshoot = args[0] === 'stale';
  const previews = (await fs.readdir(PREVIEW_DIR).catch(() => []))
    .filter((f) => /^preview-.*\.html$/.test(f) && !f.endsWith('.body.html'))
    .map((f) => f.replace(/^preview-/, '').replace(/\.html$/, ''));
  const wanted = [];
  for (const slug of previews) {
    if (reshoot) {
      wanted.push(slug);
      continue;
    }
    const ok = await fs
      .access(join(bundleDirFor(slug), 'media', 'preview.png'))
      .then(() => true)
      .catch(() => false);
    if (!ok) wanted.push(slug);
  }
  return wanted;
}

/** Strip the review scaffolding so the shot is the storefront, not the review page: drop every
 *  page after Home, then the sticky page labels themselves. */
const HOME_ONLY = () => {
  const labels = Array.from(document.querySelectorAll('.__pv-label'));
  if (labels.length > 1) {
    // Everything from the SECOND label to the end of the body is another page.
    let node = labels[1];
    while (node) {
      const next = node.nextSibling;
      node.remove();
      node = next;
    }
  }
  for (const l of labels) l.remove();
};

/** Force lazy images to load, then wait for fonts + decode, so the hero isn't grey bands. */
const SETTLE = async () => {
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
};

async function main() {
  const slugs = await slugsFromArgs();
  if (!slugs.length) {
    console.error('usage: node marketplace-catalog/_gen/bundle-media.mjs <slug> [slug...] | all');
    process.exit(1);
  }
  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const slug of slugs) {
      const mediaDir = join(bundleDirFor(slug), 'media');
      await fs.mkdir(mediaDir, { recursive: true });

      const htmlPath = previewHtmlFor(slug);
      if (!htmlPath) {
        console.warn(
          `${slug}: SKIPPED — no .preview/preview-*.html. Run that bundle's generator first ` +
            `(it writes the preview), then re-run this.`
        );
        continue;
      }

      const src = pathToFileURL(htmlPath).href;
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(src, { waitUntil: 'networkidle', timeout: 60000 });
      await page.evaluate(HOME_ONLY);
      await page.evaluate(SETTLE);
      await page.waitForTimeout(1200);
      const broken = await page.evaluate(
        () => Array.from(document.images).filter((i) => !i.complete || i.naturalWidth === 0).length
      );
      await page.screenshot({ path: join(mediaDir, 'preview.png') });
      await page.close();

      // The icon is only WRITTEN when the bundle has none — a publish refuses a bundle
      // without one, which is what this guarantees. It is not overwritten: a bundle that
      // ships deliberate icon art keeps it, so re-shooting a preview can never quietly
      // restyle 97 gallery cards as a side effect.
      const iconPath = join(mediaDir, 'icon.png');
      const hadIcon = existsSync(iconPath);
      if (!hadIcon) await fs.copyFile(GOLDEN_ICON, iconPath);
      console.log(
        `${slug}: wrote media/preview.png${hadIcon ? '' : ' + media/icon.png'}` +
          `${broken ? ` (⚠ ${broken} broken imgs)` : ''}`
      );
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
