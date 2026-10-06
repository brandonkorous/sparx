// The builder buy box's old-part choice (sparx persona issue 057): a rebuilt part
// bought by paying its core deposit, or by sending the old part first with no
// deposit. Server-rendered, which is enough to see what a shopper is offered.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { BuilderBuyBox } from './commerce';
import type { BuilderProduct, BuilderVariant } from './commerce-types';

function product(variant: Partial<BuilderVariant>): BuilderProduct {
  return {
    id: 'p1',
    handle: 'bosch-injector',
    title: 'Bosch injector',
    price: 600,
    compareAtPrice: null,
    description: '',
    images: [],
    sku: 'INJ-1',
    currency: 'USD',
    priceMinCents: 60_000,
    priceMaxCents: 60_000,
    options: [],
    variants: [
      {
        id: 'v1',
        sku: 'INJ-1',
        title: null,
        priceCents: 60_000,
        compareAtPriceCents: null,
        isDefault: true,
        inStock: true,
        available: 3,
        optionValueIds: [],
        ...variant,
      },
    ],
    attributes: {},
    attributeSections: [],
  };
}

describe('the builder buy box, on a rebuilt part', () => {
  it('offers both ways when the part can be bought both ways', () => {
    const html = renderToStaticMarkup(
      <BuilderBuyBox product={product({ coreChargeCents: 15_000, coreFirstOffered: true })} />
    );
    expect(html).toContain('Your old part');
    expect(html).toContain(
      'Pay the $150.00 core deposit now. Your part is ready right away, and we pay the deposit back when your old part comes back.'
    );
    expect(html).toContain(
      'Send your old part first. No deposit. Your part is ready once it arrives.'
    );
    // Paying is the default: nobody is held for a part they did not know to send.
    expect(html).toMatch(/checked="" value=""/);
    expect(html).not.toMatch(/checked="" value="1"/);
    // The deposit line names both ways instead of promising extra money.
    expect(html).toContain('A $150.00 refundable core deposit, or send your old part first');
  });

  it('keeps the plain deposit line, and no choice, when the part takes the deposit only', () => {
    const html = renderToStaticMarkup(
      <BuilderBuyBox product={product({ coreChargeCents: 15_000 })} />
    );
    expect(html).not.toContain('Your old part');
    expect(html).toContain('Plus a $150.00 refundable core deposit');
  });

  it('says nothing about old parts on an ordinary product', () => {
    const html = renderToStaticMarkup(<BuilderBuyBox product={product({})} />);
    expect(html).not.toContain('old part');
  });
});
