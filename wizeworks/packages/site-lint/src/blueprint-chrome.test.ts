// Every SHIPPED blueprint's header and footer, checked against the composite that
// builds them.
//
// WHY THIS EXISTS. A blueprint's frame is a STAMPED tree: the harness calls
// `starterFrame()` once at generate time and the result is committed as JSON. The
// composite goes on improving; the committed bytes do not. Nothing anywhere compared
// the two, so the designs drifted a release behind the platform and shipped that way —
// issue 313. At the point it was found, ZERO of the 191 bundles carried the
// `site.account-link` core the composite had been emitting since issue 291: 167 shipped
// a stamped "Sign in" that tells a signed-in customer she is a stranger, and 24 had no
// route to an account at all. Forty seven had no legal links in the footer, forty six of
// them selling sites.
//
// WHAT IT ASSERTS, and why in this shape. Not "the frame equals `starterFrame()`" — a
// design is SUPPOSED to differ: its own navbar and footer variant, its own CTA label,
// its own classes. What it may not do is lose a live core. So the bar is the host cores
// the composite emits for EVERY module combination — the ones that are not module-gated
// and therefore belong in every site's chrome whatever the business sells.
//
// A bundle clears the bar one of two ways, and the second is not a loophole:
//
//   1. the core is in the frame it ships, or
//   2. `upgradeFrameChrome` PROVABLY puts it there — the same repair the platform runs
//      on a stale stored frame the first time its owner opens the studio.
//
// The second exists for `sparx`, the one bundle no generator writes: its site half is
// CAPTURED from the live Template property, so it is only as current as the last capture
// and cannot be brought forward by regenerating. Run through the heal here rather than
// waved past, so the day the heal stops covering it this goes red instead of quiet.
//
// Written against `starterFrame()` rather than a list of key names, so the next core the
// composite grows is covered here without anyone remembering to come back.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  starterFrame,
  upgradeFrameChrome,
  type SiteChromeOptions,
} from '@wizeworks/silica-catalog';
import { describe, expect, it } from 'vitest';

import { BLUEPRINTS, blueprintSlugs } from './blueprints-dir';

/** Every `kind: 'host'` component key in a tree. */
function hostKeys(tree: unknown, found: string[] = []): string[] {
  if (Array.isArray(tree)) {
    for (const item of tree) hostKeys(item, found);
    return found;
  }
  if (tree && typeof tree === 'object') {
    const node = tree as Record<string, unknown>;
    if (node.kind === 'host' && typeof node.component === 'string') found.push(node.component);
    for (const value of Object.values(node)) hostKeys(value, found);
  }
  return found;
}

// The module combinations a bundle can be generated under. Intersecting across them is
// what separates "every site's chrome carries this" from "a commerce site's does" — a
// core the composite only emits with Commerce on is not something a portfolio bundle
// should be failed for missing.
const COMBINATIONS: SiteChromeOptions[] = [
  {},
  { commerceEnabled: true },
  { commerceEnabled: true, cmsEnabled: true },
  { commerceEnabled: false, cmsEnabled: true },
  { commerceEnabled: false, schedulingEnabled: true },
];

/** The cores the composite puts in EVERY site's chrome, whatever modules are on. */
function requiredCores(): string[] {
  const sets = COMBINATIONS.map((opts) => new Set(hostKeys(starterFrame(opts).root)));
  const [first, ...rest] = sets;
  return [...(first ?? new Set<string>())].filter((key) => rest.every((s) => s.has(key))).sort();
}

/** What the design's chrome reaches once the platform's own repair has run — which is
 *  what a tenant installing it actually ends up with, so it is what to measure. */
function coresAfterHeal(slug: string): Set<string> {
  const site = JSON.parse(readFileSync(join(BLUEPRINTS, slug, 'site.json'), 'utf8')) as {
    frame?: { root: unknown } | null;
  };
  const root = site.frame?.root;
  if (!root) return new Set();
  const healed = upgradeFrameChrome(root as Parameters<typeof upgradeFrameChrome>[0]);
  return new Set(hostKeys(healed.root));
}

describe('every shipped design carries the live chrome', () => {
  it('has cores to require', () => {
    // A guard on the guard. If `starterFrame` ever stops emitting host cores — or this
    // file stops being able to see them — the assertion below would pass over every
    // bundle by requiring nothing, which is the one result a content check must never
    // produce. Four cores at the time of writing: brand, account link, theme toggle,
    // legal links.
    expect(requiredCores().length).toBeGreaterThanOrEqual(4);
  });

  it('leaves no design behind the composite', () => {
    const required = requiredCores();
    const missing = blueprintSlugs().flatMap((slug) => {
      const have = coresAfterHeal(slug);
      return required.filter((core) => !have.has(core)).map((core) => `${slug} · missing ${core}`);
    });
    expect(missing).toEqual([]);
  });
});
