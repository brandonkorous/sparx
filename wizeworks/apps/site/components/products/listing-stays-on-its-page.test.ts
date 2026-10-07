// A listing's filters submit back to the page it sits on.
//
// MEASURED 2026-10-06 on Gillett Diesel: picking a make in "Fits your vehicle" on
// the tenant's own Shop page (/shop, with its own heading and intro) moved the
// shopper to /products, a different page titled "All products". The listing core
// hard-coded "/products" as its address (sparx persona issue 125).
//
// A source check, since this app keeps no render tests.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('the product listing core', () => {
  it('takes its address from the page it is on', () => {
    const listing = readFileSync(join(HERE, 'product-listing.tsx'), 'utf8');
    expect(listing).toMatch(/basePath=\{basePath\}/);
    expect(listing).not.toMatch(/basePath="\/products"/);

    const cores = readFileSync(join(HERE, '..', 'silica-host-cores.tsx'), 'utf8');
    const plp = cores.slice(cores.indexOf('case HOST_KEYS.commercePlp:'));
    expect(plp.slice(0, plp.indexOf('case HOST_KEYS.', 10))).toMatch(/basePath: ctx\.basePath/);
  });
});
