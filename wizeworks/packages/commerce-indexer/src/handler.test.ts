// Routing tests for the catalog arm of the indexer.
//
// The whole arm was dead for two of the three kinds of event it claims to
// handle. `product.*` events carry a `productId` and worked; every
// `inventory.*` event and six of the `variant.*` writes carry only a
// `variantId`, and the router read `productId` off the payload and gave up when
// it was missing. It logged "missing productId; skipping" and returned
// `skipped`, so nothing about it looked broken — the switch listed the cases,
// the consumer acked the messages, and the index simply never moved.
//
// These pin the routing decision, which is the part that failed. Projection
// itself needs Postgres and Typesense and is exercised by the commerce suite.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const projectProduct = vi.fn();
const productIdForVariant = vi.fn();
const projectAllCollectionRulesForTenant = vi.fn();
const projectInventoryCollectionRulesForTenant = vi.fn();
const projectCollectionRules = vi.fn();
const upsertProduct = vi.fn();
const deleteProduct = vi.fn();
const projectMarketListing = vi.fn();

vi.mock('@wizeworks/commerce', () => ({
  marketService: { projectMarketListing },
  projectProduct,
  productIdForVariant,
  projectAllCollectionRulesForTenant,
  projectInventoryCollectionRulesForTenant,
  projectCollectionRules,
  projectCustomer: vi.fn(),
  projectOrder: vi.fn(),
  commerceUniversalProjectors: [],
}));

vi.mock('@wizeworks/search', () => ({
  upsertProduct,
  deleteProduct,
  upsertCustomer: vi.fn(),
  upsertOrder: vi.fn(),
  upsertEntity: vi.fn(),
  deleteCustomer: vi.fn(),
  deleteOrder: vi.fn(),
  deleteEntity: vi.fn(),
  buildRegistry: () => new Map(),
}));

const { handleEvent } = await import('./handler.js');

const TENANT = '2e78fb6c-a823-4698-bcb9-58a4f17710a0';
const PRODUCT = 'e6d5e1f0-6124-4970-9360-67439d0c4e88';
const VARIANT = '9db162b6-f5ac-4852-8fb9-9dcda9a78086';

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
} as unknown as Parameters<typeof handleEvent>[1];

const event = (type: string, data: Record<string, unknown>) => ({ type, tenantId: TENANT, data });

beforeEach(() => {
  vi.clearAllMocks();
  projectProduct.mockResolvedValue({ document: { id: PRODUCT } });
  productIdForVariant.mockResolvedValue(PRODUCT);
  projectAllCollectionRulesForTenant.mockResolvedValue([]);
  projectInventoryCollectionRulesForTenant.mockResolvedValue([]);
});

describe('an event that names only a variant still reaches the product', () => {
  // Every one of these is a real payload shape from the publishers.
  const variantOnly = [
    ['inventory.low', { variantId: VARIANT, warehouseId: 'w', available: 0, reorderPoint: 2 }],
    ['inventory.depleted', { variantId: VARIANT, warehouseId: 'w' }],
    ['inventory.adjusted', { variantId: VARIANT, warehouseId: 'w', delta: -6 }],
    ['variant.updated', { variantId: VARIANT, change: 'sku' }],
    ['variant.updated', { variantId: VARIANT, change: 'isDefault' }],
    ['variant.deleted', { variantId: VARIANT }],
  ] as const;

  for (const [type, data] of variantOnly) {
    it(`indexes on ${type} ${String(data.change ?? '')}`.trim(), async () => {
      const result = await handleEvent(event(type, data), logger);

      expect(productIdForVariant).toHaveBeenCalledWith({ tenantId: TENANT }, VARIANT);
      expect(projectProduct).toHaveBeenCalledWith({ tenantId: TENANT }, PRODUCT);
      expect(upsertProduct).toHaveBeenCalled();
      expect(result.outcome).toBe('indexed');
    });
  }
});

describe('a payload that carries the product does not pay for a lookup', () => {
  it('uses productId as given', async () => {
    await handleEvent(event('product.updated', { productId: PRODUCT }), logger);

    expect(productIdForVariant).not.toHaveBeenCalled();
    expect(projectProduct).toHaveBeenCalledWith({ tenantId: TENANT }, PRODUCT);
  });
});

describe('which collections get recompiled depends on what could have changed', () => {
  it('re-runs every rule for a product write, which can touch any field', async () => {
    await handleEvent(event('product.updated', { productId: PRODUCT }), logger);

    expect(projectAllCollectionRulesForTenant).toHaveBeenCalled();
    expect(projectInventoryCollectionRulesForTenant).not.toHaveBeenCalled();
  });

  it('re-runs only stock rules for an inventory write, which can touch two', async () => {
    // `inStock` and `lowStock` are the only rule fields an inventory event can
    // move, so recompiling every collection would be work nobody asked for.
    await handleEvent(event('inventory.low', { variantId: VARIANT }), logger);

    expect(projectInventoryCollectionRulesForTenant).toHaveBeenCalled();
    expect(projectAllCollectionRulesForTenant).not.toHaveBeenCalled();
  });

  it('re-projects the product a second time when membership actually moved', async () => {
    // Collection membership lives in CollectionProduct, which the search
    // projection reads — the first pass ran before the rules did.
    projectInventoryCollectionRulesForTenant.mockResolvedValue([
      { collectionId: 'c', added: [PRODUCT], removed: [] },
    ]);

    await handleEvent(event('inventory.low', { variantId: VARIANT }), logger);

    expect(projectProduct).toHaveBeenCalledTimes(2);
    expect(upsertProduct).toHaveBeenCalledTimes(2);
  });
});

describe('a collection write is a rules trigger, not a product write', () => {
  it('routes product.updated with only a collectionId to that collection', async () => {
    // collectionService publishes this shape on collection create/edit.
    projectCollectionRules.mockResolvedValue({ added: [PRODUCT], removed: [] });

    const result = await handleEvent(
      event('product.updated', { collectionId: 'c', change: 'rules' }),
      logger
    );

    expect(projectCollectionRules).toHaveBeenCalled();
    expect(productIdForVariant).not.toHaveBeenCalled();
    expect(result.outcome).toBe('reprojected');
  });
});

describe('skipping is for events that genuinely name nothing', () => {
  it('skips when the payload names neither a product nor a variant', async () => {
    const result = await handleEvent(event('inventory.low', { warehouseId: 'w' }), logger);

    expect(result.outcome).toBe('skipped');
    expect(projectProduct).not.toHaveBeenCalled();
  });

  it('skips when the variant has been hard-deleted since publishing', async () => {
    productIdForVariant.mockResolvedValue(null);

    const result = await handleEvent(event('variant.deleted', { variantId: VARIANT }), logger);

    expect(result.outcome).toBe('skipped');
  });

  it('deletes from the index when the product itself is gone', async () => {
    projectProduct.mockResolvedValue({ document: null });

    const result = await handleEvent(event('inventory.depleted', { variantId: VARIANT }), logger);

    expect(deleteProduct).toHaveBeenCalledWith(TENANT, PRODUCT);
    expect(result.outcome).toBe('deleted');
  });
});

describe('an event without a tenant is never guessed at', () => {
  it('skips rather than reading across tenants', async () => {
    const result = await handleEvent(
      { type: 'inventory.low', data: { variantId: VARIANT } },
      logger
    );

    expect(result.outcome).toBe('skipped');
    expect(productIdForVariant).not.toHaveBeenCalled();
  });
});
