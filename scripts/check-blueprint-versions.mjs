#!/usr/bin/env node
/**
 * Fails if a blueprint bundle's CONTENT changed without its version being bumped.
 *
 * ---------------------------------------------------------------------------
 * The problem this exists for
 * ---------------------------------------------------------------------------
 *
 * A blueprint's content is COPIED into a tenant's site when they install it. The
 * pages, the prices, the footer wording — all of it is stamped into their own
 * rows and is theirs from that moment. Correcting the bundle in this repo does
 * not reach them, and it never can: it is their content now.
 *
 * What DOES reach them is the update machinery (docs/55) — a three-way merge
 * that offers the correction and keeps every edit they made. It decides there is
 * something to offer by comparing the version they installed against the version
 * in the catalog.
 *
 * So a content change with no version bump is worse than doing nothing. The fix
 * ships, every test passes, the issue gets closed, and not one existing tenant
 * will ever be offered it — because as far as the catalog is concerned, nothing
 * happened. That is exactly how a bakery kept showing prices with no currency
 * and a footer promising studio news for two days after both were "fixed".
 *
 * ---------------------------------------------------------------------------
 * The rule
 * ---------------------------------------------------------------------------
 *
 * If any file under `marketplace-catalog/blueprints/<key>/` changed against the
 * base ref, EXCEPT `media/**`, then `sparx.json`'s `version` must differ from the
 * base ref's. Media is excluded on purpose: a re-shot preview card is marketplace
 * art, not installed content, and `self-register` re-stages it by byte length
 * with no version involved.
 */

import { execFileSync } from 'node:child_process';

const BLUEPRINTS = 'marketplace-catalog/blueprints';
const baseRef = process.argv[2] || 'origin/main';

function git(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    if (allowFailure) return '';
    throw error;
  }
}

// Refuse to pass on a base we cannot see, rather than reporting a false clean.
const baseTree = git(['ls-tree', '--name-only', `${baseRef}:${BLUEPRINTS}`], {
  allowFailure: true,
}).trim();
if (!baseTree) {
  console.error(
    `No blueprints directory found at ${baseRef}:${BLUEPRINTS}.\n` +
      `This check compares against a base ref, so with nothing to compare against it can\n` +
      `only report a false pass — refusing to. Check the ref exists and is fetched\n` +
      `(CI needs fetch-depth: 0).`
  );
  process.exit(1);
}

const changed = git(['diff', '--name-only', baseRef, 'HEAD', '--', BLUEPRINTS], {
  allowFailure: true,
})
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

/** Bundle key → whether anything OTHER than its media changed. */
const touched = new Map();
for (const file of changed) {
  const rest = file.slice(BLUEPRINTS.length + 1);
  const key = rest.split('/')[0];
  if (!key) continue;
  const isMedia = rest.slice(key.length + 1).startsWith('media/');
  if (!isMedia) touched.set(key, true);
  else if (!touched.has(key)) touched.set(key, false);
}

function versionAt(ref, key) {
  const raw = git(['show', `${ref}:${BLUEPRINTS}/${key}/sparx.json`], { allowFailure: true });
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw).version ?? null;
  } catch {
    return null;
  }
}

const offenders = [];
for (const [key, contentChanged] of touched) {
  if (!contentChanged) continue;
  const before = versionAt(baseRef, key);
  // A brand-new bundle has no `before`, so there is nothing to bump past.
  if (before === null) continue;
  const after = versionAt('HEAD', key);
  if (after === null) continue; // deleted — not this check's business
  if (before === after) offenders.push({ key, version: after });
}

if (offenders.length > 0) {
  console.error(`\nBlueprint version check FAILED (base: ${baseRef})\n`);
  for (const { key, version } of offenders) {
    console.error(`  NOT BUMPED  ${key}`);
    console.error(`              content changed, but sparx.json is still ${version}.`);
  }
  console.error(
    `\n  A tenant who already installed one of these is diffed against the version\n` +
      `  they installed. Leave the version alone and the correction is invisible to\n` +
      `  every existing site, for ever — the catalog says nothing changed.\n` +
      `\n  Bump the patch version in BOTH places (the loader refuses a bundle whose two\n` +
      `  versions disagree):\n` +
      `    marketplace-catalog/blueprints/<key>/sparx.json   "version"\n` +
      `    marketplace-catalog/blueprints/<key>/blueprint.ts  version:\n` +
      `  and the BUNDLE_VERSION in the generator harness that emits it, so the next\n` +
      `  regeneration agrees.\n`
  );
  process.exit(1);
}

const contentBundles = [...touched.values()].filter(Boolean).length;
console.log(
  contentBundles === 0
    ? 'OK: no blueprint content changed.'
    : `OK: ${contentBundles} blueprint(s) changed content, all with a bumped version.`
);
