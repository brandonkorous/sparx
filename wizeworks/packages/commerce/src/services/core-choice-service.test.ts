import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A CORE CHARGE SOLD AS A CHOICE BECOMES A REAL ONE (sparx persona issue 057).
 *
 * Gillett Diesel's Bosch injector came across from Shopify as two versions: "Accept
 * Core Charge (+$150)" at $730.15 under the plain code, and "Defer Core Charge" at
 * $600.00 under a lengthened one. One part, one shelf. It becomes one version under
 * the plain code at the part's own price, with the $150.00 its words name as a
 * deposit, still letting the buyer send the old part first.
 */

const PRODUCT = '2db1efc0-fd08-46b4-ac1d-6f334d426077';
const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' };

interface V {
  id: string;
  sku: string;
  priceCents: number;
  currency: string;
  position: number;
  isDefault: boolean;
  coreChargeCents: number | null;
  optionAssignments: { optionValueId: string }[];
}

let options: { id: string; name: string; values: { id: string; value: string }[] }[];
let variants: V[];
let stock: { onHand: number; allocated: number; variant: { sku: string } }[];
let images: { id: string; variantId: string; mediaAssetId: string }[];

const variantUpdate = vi.fn();
const optionDelete = vi.fn();

function product() {
  return {
    id: PRODUCT,
    title: 'Bosch Remanufactured Fuel Injector (0986435621)',
    options,
    variants,
  };
}

const tx = {
  product: {
    findMany: vi.fn(() => Promise.resolve([product()])),
    update: vi.fn(() => Promise.resolve({})),
  },
  inventoryLevel: { findMany: vi.fn(() => Promise.resolve(stock)) },
  productVariant: {
    update: variantUpdate.mockImplementation(() => Promise.resolve({})),
    aggregate: vi.fn(() =>
      Promise.resolve({ _min: { priceCents: 60000 }, _max: { priceCents: 60000 } })
    ),
  },
  variantImage: {
    findMany: vi.fn((args: { where: { variantId: string } }) =>
      Promise.resolve(images.filter((i) => i.variantId === args.where.variantId))
    ),
    update: vi.fn((args: { where: { id: string }; data: { variantId: string } }) => {
      const image = images.find((i) => i.id === args.where.id);
      if (image) image.variantId = args.data.variantId;
      return Promise.resolve({});
    }),
    delete: vi.fn((args: { where: { id: string } }) => {
      images = images.filter((i) => i.id !== args.where.id);
      return Promise.resolve({});
    }),
  },
  cartItem: { findMany: vi.fn(() => Promise.resolve([])), update: vi.fn() },
  productOption: { delete: optionDelete.mockImplementation(() => Promise.resolve({})) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('@wizeworks/inventory', () => ({ syncProductInStock: vi.fn(() => Promise.resolve()) }));
vi.mock('../audit', () => ({ writeAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('../events', () => ({ publishCommerceEvent: vi.fn(() => Promise.resolve()) }));
vi.mock('../inventory-gate', () => ({ isInventoryActive: vi.fn(() => Promise.resolve(true)) }));
vi.mock('./cart-service', () => ({
  repriceCart: vi.fn(() => Promise.resolve()),
  NOT_BOUGHT_YET: { checkoutSessions: { none: { step: 'completed' } } },
}));
vi.mock('./lattice-memory', () => ({ rememberCoordinates: vi.fn(() => Promise.resolve()) }));

const { listCandidates, convert } = await import('./core-choice-service');

const PLAIN = 'v-plain';
const DEFER = 'v-defer';

beforeEach(() => {
  options = [
    {
      id: 'opt-core',
      name: 'Core Charge',
      values: [
        { id: 'val-accept', value: 'Accept Core Charge (+$150)' },
        { id: 'val-defer', value: 'Defer Core Charge' },
      ],
    },
  ];
  variants = [
    {
      id: PLAIN,
      sku: '0986435621',
      priceCents: 73015,
      currency: 'USD',
      position: 0,
      isDefault: true,
      coreChargeCents: null,
      optionAssignments: [{ optionValueId: 'val-accept' }],
    },
    {
      id: DEFER,
      sku: '0986435621-DEFER-CORE-CHARGE',
      priceCents: 60000,
      currency: 'USD',
      position: 1,
      isDefault: false,
      coreChargeCents: null,
      optionAssignments: [{ optionValueId: 'val-defer' }],
    },
  ];
  stock = [];
  images = [];
  variantUpdate.mockClear();
  optionDelete.mockClear();
});

describe('listCandidates', () => {
  it('reads the deposit from the words and the part price from the old-part-first side', async () => {
    const [candidate] = await listCandidates(CTX);
    expect(candidate).toMatchObject({
      depositLabel: 'Accept Core Charge (+$150)',
      firstLabel: 'Defer Core Charge',
      keptSku: '0986435621',
      retiredVariantIds: [DEFER],
      depositSidePriceCents: 73015,
      firstSidePriceCents: 60000,
      suggestedPartPriceCents: 60000,
      suggestedCoreChargeCents: 15000,
      groups: 1,
      problem: null,
    });
  });

  it('leaves a choice the words do not place for the owner', async () => {
    options[0]!.values = [
      { id: 'val-accept', value: 'Remanufactured' },
      { id: 'val-defer', value: 'New' },
    ];
    options[0]!.name = 'Core type';
    const [candidate] = await listCandidates(CTX);
    expect(candidate?.problem).toMatch(/not one “ship now” and one “old part first”/);
  });

  it('will not retire a version that still has stock on it', async () => {
    stock = [{ onHand: 3, allocated: 0, variant: { sku: '0986435621-DEFER-CORE-CHARGE' } }];
    const [candidate] = await listCandidates(CTX);
    expect(candidate?.problem).toMatch(/still has 3 in stock/);
  });
});

describe('convert', () => {
  it('keeps the plain code at the part price with the deposit, and retires the other side', async () => {
    images = [
      { id: 'img-1', variantId: DEFER, mediaAssetId: 'asset-photo' },
      { id: 'img-2', variantId: DEFER, mediaAssetId: 'asset-shared' },
      { id: 'img-3', variantId: PLAIN, mediaAssetId: 'asset-shared' },
    ];
    const [result] = await convert(CTX, {
      conversions: [{ productId: PRODUCT, partPriceCents: 60000, coreChargeCents: 15000 }],
    });

    expect(result).toEqual({
      productId: PRODUCT,
      title: 'Bosch Remanufactured Fuel Injector (0986435621)',
      problem: null,
    });
    expect(variantUpdate).toHaveBeenCalledWith({
      where: { id: PLAIN },
      data: { priceCents: 60000, coreChargeCents: 15000, coreFirstOffered: true },
    });
    expect(variantUpdate).toHaveBeenCalledWith({
      where: { id: DEFER },
      data: { deletedAt: expect.any(Date) as Date, isDefault: false },
    });
    expect(optionDelete).toHaveBeenCalledWith({ where: { id: 'opt-core' } });
    // Only baskets still being shopped have their line moved: a bought one is a
    // record of what was bought and refuses a reprice (sparx persona issue 087).
    expect(tx.cartItem.findMany).toHaveBeenCalledWith({
      where: { variantId: DEFER, cart: { checkoutSessions: { none: { step: 'completed' } } } },
      select: { id: true, cartId: true },
    });
    // The retired side's own photo moves; the one both showed is kept once.
    expect(images).toEqual([
      { id: 'img-1', variantId: PLAIN, mediaAssetId: 'asset-photo' },
      { id: 'img-3', variantId: PLAIN, mediaAssetId: 'asset-shared' },
    ]);
  });

  it('makes the kept version the one shown first when the retired one was', async () => {
    variants[0]!.isDefault = false;
    variants[1]!.isDefault = true;
    await convert(CTX, { conversions: [{ productId: PRODUCT, coreChargeCents: 15000 }] });
    expect(variantUpdate).toHaveBeenCalledWith({ where: { id: PLAIN }, data: { isDefault: true } });
  });

  it('changes nothing on a product it cannot place, and says why', async () => {
    stock = [{ onHand: 1, allocated: 0, variant: { sku: '0986435621-DEFER-CORE-CHARGE' } }];
    const [result] = await convert(CTX, {
      conversions: [{ productId: PRODUCT, partPriceCents: 60000, coreChargeCents: 15000 }],
    });
    expect(result?.problem).toMatch(/still has 1 in stock/);
    expect(variantUpdate).not.toHaveBeenCalled();
    expect(optionDelete).not.toHaveBeenCalled();
  });
});
