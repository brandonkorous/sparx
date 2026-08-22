#!/usr/bin/env node
/**
 * A brand's logo is drawn in ONE place, and the deployment carries a copy.
 * This fails the build when the two disagree.
 *
 * ─── WHY THERE IS A COPY AT ALL ─────────────────────────────────────────────
 *
 * The attribution badge at the foot of every tenant's public site is rendered by
 * `wizeworks/apps/site` — one deployment serving the public sites of every
 * brand, which is exactly why it may not import `@piggles/*` or `@sparx/*`
 * (check-boundaries RULE 1). It cannot reach a brand's marks package, so it
 * reads the geometry as configuration: `<BRAND>_BRAND_WORDMARK`, beside the name,
 * the accent and the destination it already reads the same way.
 *
 * That is a second copy of a logo, and a second copy of anything drifts. The
 * drift would be quiet in the worst way: the badge renders a perfectly clean
 * wordmark that is simply the previous version of the logo, on every tenant site
 * the platform serves, and nothing anywhere reports a problem.
 *
 * So: the brand's own file is the source, the ConfigMap holds the serialisation,
 * and this compares them. `--update` rewrites the ConfigMap from the art.
 *
 * ─── WHAT IT REFUSES TO DO ──────────────────────────────────────────────────
 *
 * Pass quietly when it cannot find something. A check that shrugs at a missing
 * file is worse than no check, because its OK is indistinguishable from a real
 * one — five sibling checks in this repo went blind that way in a single tree
 * move. Every lookup here is asserted, and the counts are printed.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * One row per brand that publishes a drawn wordmark.
 *
 * A brand whose mark IS its letterforms belongs nowhere on this list — sparx
 * sets its name as type with an Ember "x" (`SPARX_BRAND_ACCENT_CHARS=1`), which
 * is the badge's other treatment and needs no geometry.
 */
const BRANDS = [
  {
    key: 'piggles',
    envVar: 'PIGGLES_BRAND_WORDMARK',
    source: 'piggles/packages/brand/src/marks.ts',
    /** Asserted, so a re-drawn logo with a different number of letterforms is a
     *  deliberate edit here rather than a silent change in what ships. */
    expectPaths: 7,
    expectAccent: true,
  },
];

const CONFIGMAP = 'k8s/azure/infra/app-env-configmap.env';

function fail(...lines) {
  console.error('\nBrand wordmark check FAILED:');
  for (const l of lines) console.error('  ' + l);
  console.error('');
  process.exit(1);
}

/** Pull the geometry out of the brand's own file. Pure text, no TS toolchain —
 *  same family as every other check here — but every match is asserted. */
function readArt(brand) {
  const abs = join(ROOT, brand.source);
  if (!existsSync(abs)) {
    fail(
      brand.source + ' does not exist.',
      'A moved or renamed marks file makes this check blind. Fix the path.'
    );
  }
  const src = readFileSync(abs, 'utf8');

  const viewBox = /WORDMARK_VIEWBOX\s*=\s*'([^']+)'/.exec(src)?.[1];
  const block = /export const WORDMARK_LETTER_PATHS = \[([\s\S]*?)\n\] as const;/.exec(src)?.[1];
  const accentPath = /WORDMARK_DOT_PATH\s*=\s*\n?\s*'([^']+)'/.exec(src)?.[1] ?? null;

  if (!viewBox || !block) {
    fail(
      brand.source + ' no longer declares WORDMARK_VIEWBOX / WORDMARK_LETTER_PATHS',
      'in the shape this check reads. Update the patterns rather than deleting the check —',
      'a wordmark that cannot be read here is a wordmark nothing is comparing.'
    );
  }
  const paths = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);

  if (paths.length !== brand.expectPaths) {
    fail(
      brand.key + ': found ' + paths.length + ' letterform path(s), expected ' + brand.expectPaths,
      'If the mark was genuinely re-drawn, update expectPaths in this file in the same',
      'commit — the count is asserted so a partial parse cannot pass as a correct one.'
    );
  }
  if (brand.expectAccent && !accentPath) {
    fail(brand.key + ': WORDMARK_DOT_PATH is missing — the accent shape is the mark.');
  }

  return JSON.stringify({ viewBox, paths, accentPath });
}

const cfgPath = join(ROOT, CONFIGMAP);
if (!existsSync(cfgPath)) {
  fail(CONFIGMAP + ' does not exist. Fix the path; do not delete the check.');
}
let cfg = readFileSync(cfgPath, 'utf8');
const update = process.argv.includes('--update');
const drifted = [];

for (const brand of BRANDS) {
  const art = readArt(brand);
  const line = new RegExp('^' + brand.envVar + "='(.*)'$", 'm');
  const found = line.exec(cfg);

  if (update) {
    const replacement = brand.envVar + "='" + art + "'";
    cfg = found ? cfg.replace(line, replacement) : cfg.trimEnd() + '\n' + replacement + '\n';
    continue;
  }

  if (!found) {
    drifted.push(brand.envVar + ' is absent from ' + CONFIGMAP + ' — the badge would set the');
    drifted.push('  brand name as plain type instead of drawing its logo.');
    continue;
  }
  if (found[1] !== art) {
    drifted.push(
      brand.envVar +
        ' does not match ' +
        brand.source +
        ' (' +
        found[1].length +
        ' configured bytes vs ' +
        art.length +
        ' drawn).'
    );
  }
}

if (update) {
  writeFileSync(cfgPath, cfg, 'utf8');
  console.log(
    'Updated ' + BRANDS.length + ' wordmark(s) in ' + relative(ROOT, cfgPath).split(sep).join('/')
  );
  process.exit(0);
}

console.log('Brand wordmark check: ' + BRANDS.length + ' brand(s) with a drawn wordmark compared.');

if (drifted.length > 0) {
  fail(
    ...drifted,
    '',
    'The drawing is the source. Run `pnpm check:brand-wordmark --update` to rewrite',
    'the ConfigMap from it, and update the local .env files the same way.'
  );
}
console.log('OK: every configured wordmark matches the art it was drawn from.');
