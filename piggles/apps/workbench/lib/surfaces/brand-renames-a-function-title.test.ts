// A FUNCTION TITLE IS USUALLY A SCREEN NAME, NOT A RECORD'S.
//
// `resolveTitle` used to hand a function title straight back without asking the
// brand, on the stated grounds that a function title names a record: "Order
// #1043", a customer's own product name, the tenant's data rather than the
// platform's vocabulary.
//
// That is true of ONE surface in the catalog. The other 32 look like this:
//
//     title: (params) => (params.id === 'new' ? 'New purchase order' : 'Purchase order')
//
// Fixed words, chosen for the other audience, and out of reach of the one file
// whose job is replacing them. The tab on an order to a supplier read "Purchase
// order" until the pane's own `setTitle` arrived, and a menu row asking
// `surfaceTitle()` for one read it and kept it. Issue 729.
//
// These two cases are the whole rule, so they are the whole test: the brand's
// word wins when there is one, and the function still runs when there is not.

import { describe, expect, it } from 'vitest';

import { registerSurface, resolveTitle, surfaceTitle, type SurfaceDefinition } from './registry';
import { configureProduct } from '../product';
import { PIGGLES_SURFACES } from '../console/vocabulary';

// The brand, pointed at the SHIPPED vocabulary rather than a fixture, so this
// asks the real table. The shell does the same thing at module scope; doing it
// here instead of importing the whole brand module keeps three hundred React
// surfaces out of a test about two strings.
configureProduct({ surfaceTitles: PIGGLES_SURFACES });

const stub = (key: string, title: SurfaceDefinition['title']): SurfaceDefinition =>
  ({
    key,
    title,
    module: 'platform',
    icon: null,
    component: () => null,
  }) as unknown as SurfaceDefinition;

/** A real key with a real entry, so this asks the shipped vocabulary. */
const RENAMED = 'inventory.purchase-orders.detail';
/** A key nobody renamed, so the catalog's own function is still the answer. */
const UNTOUCHED = 'test.function.title.untouched';

const renamed = stub(RENAMED, (params) =>
  params.id === 'new' ? 'New purchase order' : 'Purchase order'
);
const untouched = stub(UNTOUCHED, (params) => (params.id === 'new' ? 'New widget' : 'Widget'));

registerSurface(renamed);
registerSurface(untouched);

describe('a function title and the brand', () => {
  it('has an entry for the surface these tests are about', () => {
    // Without this, the two below would pass for the wrong reason if the entry
    // were ever removed.
    expect(PIGGLES_SURFACES[RENAMED]).toBe('Order to a supplier');
  });

  it("uses the brand's word for a function title that returns fixed words", () => {
    expect(resolveTitle(renamed, { id: 'abc' })).toBe('Order to a supplier');
    expect(resolveTitle(renamed, { id: 'new' })).toBe('Order to a supplier');
  });

  it('reads the same in a menu row, which is where it used to stick', () => {
    expect(surfaceTitle(RENAMED)).toBe('Order to a supplier');
  });

  it('still runs the function when the brand has said nothing', () => {
    expect(resolveTitle(untouched, { id: 'new' })).toBe('New widget');
    expect(resolveTitle(untouched, { id: 'abc' })).toBe('Widget');
  });
});
