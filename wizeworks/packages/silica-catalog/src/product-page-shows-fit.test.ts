// The default product page says what the product fits (sparx persona issue 126).
//
// The fit list lived in the previous generation's product body. When product
// pages became silica trees nothing placed it, so no live product page said which
// vehicles (or sizes, or models) a part fits.

import { describe, expect, it } from 'vitest';
import { productDetailPage } from './commerce';
import { HOST_COMPONENTS, HOST_KEYS } from './host-nodes';

function hosts(node: unknown, found: { component?: string; locked?: string }[] = []) {
  const n = node as { kind?: string; component?: string; locked?: string; children?: unknown[] };
  if (!n || typeof n !== 'object') return found;
  if (n.kind === 'host') found.push(n);
  for (const child of n.children ?? []) hosts(child, found);
  return found;
}

describe('the default product page', () => {
  it('places "What it fits", unpinned', () => {
    const fit = hosts(productDetailPage()).find(
      (h) => h.component === HOST_KEYS.commerceProductFitment
    );
    expect(fit).toBeDefined();
    expect(fit?.locked).toBeUndefined();
  });

  it('offers it in the builder palette under a shop owner’s words', () => {
    const def = HOST_COMPONENTS.find((c) => c.key === HOST_KEYS.commerceProductFitment);
    expect(def?.label).toBe('What it fits');
    expect(def?.pinned).toBe(false);
  });
});
