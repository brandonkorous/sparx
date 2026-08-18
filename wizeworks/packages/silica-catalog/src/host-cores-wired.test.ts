// Every registered host core actually renders on the live site.
//
// `host-nodes.ts` states this as a rule in its header — "a key with no live mapping on
// either end is a half-built surface, so an entry is added here only once its full
// vertical lands" — and nothing enforced it. The failure it guards against is quiet in
// exactly the wrong way: `SiteHostRenderer`'s switch ends in `default: return null`, so
// a key that is in the palette but not in that switch gives an author a block they can
// place, style, save and publish, which then renders NOTHING for every visitor. No
// error, no warning, no empty box — the page simply does not have the thing on it.
//
// Only the wizeworks/apps/site end can be checked this way, and that is the right asymmetry. The
// studio's `renderHostNode` ends in a generic labelled skeleton, so an unlisted key
// there is merely a plain preview rather than a broken one; naming every key in that
// file would be a rule against its own design. The live site has no such fallback.
//
// READS THE REPO, like `site-lint`'s blueprint sweep: the thing worth guarding is the
// wiring on disk, and a fixture would drift from it the moment someone edits the switch.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { HOST_KEYS } from './host-nodes';

const RENDERER = join(
  process.cwd(),
  '..',
  '..',
  'apps',
  'site',
  'components',
  'silica-host-cores.tsx'
);

const SOURCE = readFileSync(RENDERER, 'utf8');

describe('the live site renders every core the palette offers', () => {
  it('found the renderer, and it is the switch we think it is', () => {
    // Guard on the guard: a moved or renamed file would otherwise make every case
    // below fail for the wrong reason, or (if this used a try/catch) pass for one.
    expect(SOURCE.length).toBeGreaterThan(500);
    expect(SOURCE).toContain('switch (node.component)');
    expect(SOURCE).toContain('default:');
  });

  // Named by their CONSTANT, not their string value: the switch reads
  // `case HOST_KEYS.siteVideo`, and matching on `'site.video'` would miss it.
  it.each(Object.keys(HOST_KEYS))('HOST_KEYS.%s has a case', (name) => {
    expect(SOURCE).toContain(`HOST_KEYS.${name}`);
  });
});
