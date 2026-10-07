// Every live block the builder offers has a renderer on the site.
//
// A host key with no `case` in the site's renderer draws nothing: the block sits
// in the page, selectable in the builder, and the live page shows a gap with no
// error anywhere. The product fit list went missing from every product page that
// way once (sparx persona issue 126), and the save heart before it (issue 642).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HOST_KEYS } from '@wizeworks/silica-catalog';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('the site host renderer', () => {
  it('has a case for every host key', () => {
    const source = readFileSync(join(HERE, 'silica-host-cores.tsx'), 'utf8');
    const names = Object.keys(HOST_KEYS);
    expect(names.length).toBeGreaterThan(20);
    const missing = names.filter((name) => !source.includes(`case HOST_KEYS.${name}:`));
    expect(missing).toEqual([]);
  });
});
