#!/usr/bin/env node
/**
 * Fails if a blueprint's journal is somebody else's.
 *
 * ---------------------------------------------------------------------------
 * The problem this exists for
 * ---------------------------------------------------------------------------
 *
 * Twenty-two blueprints — a dental clinic, a garage, a florist, an accountancy,
 * a boutique — installed the SAME three blog posts, published, on the tenant's
 * public journal the moment the blueprint went in:
 *
 *   · How to launch your online store in a weekend
 *   · Writing product descriptions that actually sell
 *   · Five ways to turn first-time buyers into regulars
 *
 * They are the vendor's advice to the OWNER, published under the business's name
 * for its CUSTOMERS to read. None of the twenty-two carried a single post about
 * its own trade; the three were a fallback that got copied everywhere and never
 * replaced. Meanwhile seventy-two other blueprints do it properly — an
 * electrical wholesaler ships "Sizing cable and breakers", a coffee roaster
 * ships "Dialling in for your cafe".
 *
 * Blueprint content is COPIED at install and is the tenant's from that moment
 * (see check-blueprint-versions.mjs), so this is not a bug you can quietly fix
 * later — it is on their site until they notice and delete it.
 *
 * ---------------------------------------------------------------------------
 * The rule
 * ---------------------------------------------------------------------------
 *
 * A blueprint that ships journal content must ship at least one post nobody else
 * ships. Sharing a post is fine — two candle shops both want "Get a clean, even
 * burn" — but a blueprint whose journal is ENTIRELY other people's posts has no
 * journal of its own, and that is exactly what the fallback looked like.
 *
 * Shipping no posts at all passes: an empty journal is honest, and the owner
 * writes the first one.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BLUEPRINTS = join(ROOT, 'marketplace-catalog', 'blueprints');

// A check that scans nothing prints a tick. Refuse to, and say where we looked.
try {
  if (!statSync(BLUEPRINTS).isDirectory()) throw new Error('not a directory');
} catch {
  console.error(
    `No blueprints directory at ${BLUEPRINTS}.\n` +
      `This check scans a fixed path, so a moved directory would make it pass over\n` +
      `nothing and report a false clean. Update the path in this file.`
  );
  process.exit(1);
}

/** Every blueprint's journal slugs, by bundle key. */
const journals = new Map();
for (const key of readdirSync(BLUEPRINTS).sort()) {
  let raw;
  try {
    raw = readFileSync(join(BLUEPRINTS, key, 'content.json'), 'utf8');
  } catch {
    continue; // No content.json at all — nothing to install, nothing to check.
  }
  let entries;
  try {
    entries = JSON.parse(raw);
  } catch (error) {
    console.error(`\n${key}/content.json is not valid JSON: ${error.message}\n`);
    process.exit(1);
  }
  if (!Array.isArray(entries)) continue;
  const slugs = entries
    .filter((entry) => (entry?.typeKey ?? 'blog_post') === 'blog_post')
    .map((entry) => entry?.slug)
    .filter(Boolean);
  journals.set(key, slugs);
}

/** How many blueprints ship each slug. */
const shippedBy = new Map();
for (const slugs of journals.values()) {
  for (const slug of slugs) shippedBy.set(slug, (shippedBy.get(slug) ?? 0) + 1);
}

const offenders = [];
for (const [key, slugs] of journals) {
  if (slugs.length === 0) continue;
  if (slugs.some((slug) => shippedBy.get(slug) === 1)) continue;
  offenders.push({ key, slugs });
}

const withPosts = [...journals.values()].filter((slugs) => slugs.length > 0).length;

if (offenders.length > 0) {
  console.error(`\nBlueprint journal check FAILED\n`);
  for (const { key, slugs } of offenders) {
    console.error(`  NOT ITS OWN  ${key}`);
    console.error(`               every post it installs is also installed by another`);
    console.error(`               blueprint: ${slugs.join(', ')}`);
  }
  console.error(
    `\n  These posts publish to the business's own journal at install, for its\n` +
      `  customers to read. A journal made entirely of posts written for somebody\n` +
      `  else's trade is how a dental clinic came to publish "Writing product\n` +
      `  descriptions that actually sell".\n` +
      `\n  Write at least one post for this trade, or ship none — an empty journal is\n` +
      `  honest and the owner writes the first one.\n`
  );
  process.exit(1);
}

console.log(
  `OK: ${withPosts} of ${journals.size} blueprints ship journal posts, ` +
    `every one with a post of its own (${shippedBy.size} distinct posts).`
);
