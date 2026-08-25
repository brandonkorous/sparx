#!/usr/bin/env node
/**
 * One-off: heal every blueprint's stamped FEATURED STRIP.
 *
 * ---------------------------------------------------------------------------
 * What was wrong
 * ---------------------------------------------------------------------------
 *
 * `featuredCarousel()` was built on silica's `carousel` behavior, which shows
 * exactly ONE slide per view. Under a product, that made the cross-sell card
 * bigger than the product the page exists to sell. Beside it sat a
 * `basis-full @2xl:basis-1/3 @4xl:basis-1/4` ladder meant to show four cards on
 * a desktop, which never applied at any width — silicaui sizes a carousel's
 * children itself.
 *
 * The catalog is fixed: the strip is a `scroll-strip` now, which is the behavior
 * whose own description is this job ("every item is meant to be visible at
 * once"), with real card widths and controls the component reveals only once the
 * cards overflow.
 *
 * ---------------------------------------------------------------------------
 * Why a codemod as well
 * ---------------------------------------------------------------------------
 *
 * A blueprint's `site.json` is a STAMPED tree. It was produced by the factory
 * once and frozen, so fixing the factory reaches the next tenant and no existing
 * bundle. Every bundle carrying a product strip still ships the broken one.
 *
 * The repair itself is NOT written here — it is `upgradePageBody` from
 * `@wizeworks/silica-catalog`, the same function that heals a live tenant's
 * stored draft at studio load. One definition, two callers: a second copy of the
 * transform is a second thing to keep correct.
 *
 * Bumps the patch version of every bundle it changes, because a content change
 * with no bump is a change no installed tenant is ever offered
 * (`check-blueprint-versions.mjs` enforces it).
 *
 * Writes with `JSON.stringify(…, 2)` and then runs prettier over exactly the files
 * it touched: the bundles are prettier-formatted (short arrays stay inline), and
 * without that pass a three-line repair arrives as a 456-line reformat that hides
 * itself in review.
 *
 * Usage: node scripts/codemod-featured-strip.mjs [--dry]
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { upgradePageBody } from '../wizeworks/packages/silica-catalog/src/upgrade-page.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLUEPRINTS = path.join(ROOT, 'marketplace-catalog', 'blueprints');
const DRY = process.argv.includes('--dry');

/**
 * Bump the patch version of a bundle — in BOTH places it is written.
 *
 * A bundle carries its version twice: `version: '1.4.2'` in `blueprint.ts` and
 * `"version": "1.4.2"` in `sparx.json`. The loader cross-checks them and REFUSES
 * the bundle when they disagree, which is the right call and is also easy to
 * trip: bumping only the manifest took the whole first-party catalog down with
 * `payload version 1.4.3 disagrees with sparx.json 1.4.2` and left api-rest
 * serving a stale catalog.
 *
 * Both or neither, in one function, so a caller cannot bump half a bundle.
 */
function bumpVersion(manifest, meta) {
  const src = readFileSync(manifest, 'utf8');
  const match = src.match(/(version:\s*')(\d+)\.(\d+)\.(\d+)(')/);
  if (!match) return null;
  const from = `${match[2]}.${match[3]}.${match[4]}`;
  const to = `${match[2]}.${match[3]}.${Number(match[4]) + 1}`;
  const write = () => {
    writeFileSync(manifest, src.replace(match[0], `${match[1]}${to}${match[5]}`));
    if (!existsSync(meta)) return;
    const json = JSON.parse(readFileSync(meta, 'utf8'));
    json.version = to;
    writeFileSync(meta, `${JSON.stringify(json, null, 2)}\n`);
  };
  return { write, from, to };
}

let touched = 0;
const written = [];
for (const slug of readdirSync(BLUEPRINTS)) {
  const siteFile = path.join(BLUEPRINTS, slug, 'site.json');
  const manifest = path.join(BLUEPRINTS, slug, 'blueprint.ts');
  const meta = path.join(BLUEPRINTS, slug, 'sparx.json');
  if (!existsSync(siteFile)) continue;

  const site = JSON.parse(readFileSync(siteFile, 'utf8'));
  let changedAny = false;

  for (const page of site.pages ?? []) {
    if (!page.root) continue;
    const { root, changed } = upgradePageBody(page.root);
    if (changed) {
      page.root = root;
      changedAny = true;
    }
  }
  if (site.frame?.root) {
    const { root, changed } = upgradePageBody(site.frame.root);
    if (changed) {
      site.frame.root = root;
      changedAny = true;
    }
  }
  if (!changedAny) continue;

  touched += 1;
  const bumped = existsSync(manifest) ? bumpVersion(manifest, meta) : null;
  console.log(`${slug}${bumped ? `  ${bumped.from} →` : '  (no version found)'}`);
  if (DRY) continue;

  writeFileSync(siteFile, `${JSON.stringify(site, null, 2)}\n`);
  written.push(path.relative(ROOT, siteFile).split(path.sep).join('/'));
  if (bumped) bumped.write();
}

// In batches: one argv carrying 66 long paths overruns the Windows command limit.
for (let i = 0; i < written.length; i += 20) {
  execFileSync('npx', ['prettier', '--write', ...written.slice(i, i + 20)], {
    cwd: ROOT,
    stdio: 'ignore',
    shell: true,
  });
}

console.log(`\n${touched} blueprint${touched === 1 ? '' : 's'} ${DRY ? 'would be' : ''} healed.`);
