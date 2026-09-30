import pino from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ENTITY_FIELDS,
  mapManually,
  validateRows,
  type CanonicalEntity,
} from '@wizeworks/migration';

import type { ProcessorOptions } from './types';

// What the columns Move in offers actually become, entity by entity.
//
// `contract.test.ts` proves each processor READS every offered column. This proves
// the value lands where it belongs: a file mapped the way the column mapper maps it,
// checked the way the API checks it, then saved against fakes that record every write.
// Each of these columns was once offered and dropped on arrival.

const state = vi.hoisted(() => ({
  /** `model.method` → what the fake database answers. Unlisted reads find nothing. */
  answers: new Map<string, (args: unknown) => unknown>(),
  /** Every write and service call, in order. */
  calls: [] as { name: string; args: unknown[] }[],
}));

vi.mock('@wizeworks/db', () => {
  const tx: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_target, model: string) =>
        new Proxy(
          {},
          {
            get: (_inner, method: string) => (args: unknown) => {
              const answer = state.answers.get(`${model}.${method}`);
              if (answer !== undefined) return Promise.resolve(answer(args));
              if (method.startsWith('find')) {
                return Promise.resolve(method === 'findMany' ? [] : null);
              }
              state.calls.push({ name: `${model}.${method}`, args: [args] });
              return Promise.resolve({ id: `${model}-written` });
            },
          }
        ),
    }
  );
  return {
    withTenant: (_ctx: unknown, run: (client: unknown) => unknown) => run(tx),
    prisma: tx,
  };
});

/** A service that records each call and answers with a created id. */
const recorder = vi.hoisted(
  () =>
    (service: string, answers: Record<string, (...args: unknown[]) => unknown> = {}) =>
      new Proxy(
        {},
        {
          get:
            (_target, method: string) =>
            (...args: unknown[]) => {
              state.calls.push({ name: `${service}.${method}`, args });
              const answer = answers[method];
              return Promise.resolve(
                answer === undefined ? { id: `${service}-${state.calls.length}` } : answer(...args)
              );
            },
        }
      )
);

vi.mock('@wizeworks/commerce', () => ({
  productService: recorder('productService'),
  variantService: recorder('variantService', { setOptions: () => [] }),
  categoryService: recorder('categoryService'),
  collectionService: recorder('collectionService'),
}));

vi.mock('@wizeworks/inventory', () => ({ inventoryService: recorder('inventoryService') }));

vi.mock('@wizeworks/crm', () => ({
  customerService: recorder('customerService', {
    create: () => ({ id: 'customer-new' }),
    listAddresses: () => [],
  }),
  engagementService: recorder('engagementService'),
  objectDefService: { schemaFor: () => Promise.resolve({ fields: [] }) },
  propertiesFromRow: () => ({ values: {}, problems: [], matchedColumns: [] }),
  describeColumnProblems: () => '',
  describeCustomerError: (error: unknown) => String(error),
  checkCustomerInput: () => null,
}));

vi.mock('@wizeworks/cms', () => ({
  listContentTypes: () => Promise.resolve([{ key: 'article', url_pattern: '/journal/{slug}' }]),
  createContentType: () => Promise.resolve({ contentType: { key: 'post', url_pattern: null } }),
  createEntry: (...args: unknown[]) => {
    state.calls.push({ name: 'cms.createEntry', args });
    return Promise.resolve({ entry: { id: 'entry-1' } });
  },
  updateEntry: () => Promise.resolve({}),
  publishEntry: () => Promise.resolve({}),
}));

vi.mock('./images', () => ({
  ingestImage: (_ctx: unknown, url: string) => {
    state.calls.push({ name: 'ingestImage', args: [url] });
    return Promise.resolve({ assetId: `asset:${url}`, copied: true, reused: false });
  },
  filenameFromUrl: (url: string) => url.split('/').pop() ?? 'file',
  linkedNotice: () => 'linked',
}));

const { getProcessor } = await import('./index');

const logger = pino({ level: 'silent' });
const ctx = {
  tenantId: '00000000-0000-0000-0000-000000000001',
  propertyId: '00000000-0000-0000-0000-000000000003',
};
const MODULES: ProcessorOptions = {
  upsert: true,
  modules: ['builder', 'commerce', 'inventory', 'crm', 'cms'],
};

/** Map a file onto an entity's fields by the labels the mapper prints, and check it
 *  imports cleanly the way the API would. */
function moveIn(
  entity: CanonicalEntity,
  raw: Record<string, string>[],
  labels: Record<string, string>
): Record<string, string>[] {
  const columnMap: Record<string, string> = {};
  for (const [header, label] of Object.entries(labels)) {
    const field = ENTITY_FIELDS[entity].find((spec) => spec.label === label);
    if (field === undefined) throw new Error(`no ${entity} field labelled ${label}`);
    columnMap[header] = field.key;
  }
  const mapped = mapManually(entity, raw, columnMap);
  expect(validateRows(entity, mapped.rows).errorRows).toEqual([]);
  return mapped.rows;
}

async function run(entity: string, rows: Record<string, string>[], options = MODULES) {
  const processor = getProcessor(entity);
  if (processor === undefined) throw new Error(`no processor for ${entity}`);
  return processor.run(ctx, rows, options, logger);
}

function called(name: string): unknown[][] {
  return state.calls.filter((call) => call.name === name).map((call) => call.args);
}

beforeEach(() => {
  state.answers.clear();
  state.calls.length = 0;
});

describe('products', () => {
  const labels = {
    Handle: 'Handle',
    Name: 'Title',
    Sku: 'SKU',
    State: 'Status',
    Groups: 'Collections',
    Qty: 'Quantity',
    Ships: 'Needs shipping',
    Picture: 'Image URL',
    Place: 'Image position',
    Live: 'Published',
    Was: 'Old URL',
    Code: 'Barcode',
  };

  it('saves collections, stock, shipping, gallery order, published date and a redirect', async () => {
    state.answers.set('productCollection.findFirst', (args) => {
      // The name-or-handle match; a handle-availability check has no OR and finds
      // nothing, so a created collection gets the handle it asked for.
      const where = (args as { where: { OR?: { handle?: string }[] } }).where;
      return where.OR?.some((clause) => clause.handle === 'summer') === true
        ? { id: 'collection-summer', type: 'manual', name: 'Summer' }
        : null;
    });
    const rows = moveIn(
      'products',
      [
        {
          Handle: 'linen-shirt',
          Name: 'Linen shirt',
          Sku: 'LIN-S',
          State: 'active',
          Groups: 'Summer, New in',
          Qty: '14',
          Ships: 'yes',
          Picture: 'https://old.example.com/back.jpg',
          Place: '2',
          Live: '2024-05-01',
          Was: '/products/linen-shirt-old',
          Code: 'ABC-1',
        },
        {
          Handle: 'linen-shirt',
          Name: 'Linen shirt',
          Sku: 'LIN-M',
          State: 'active',
          Groups: '',
          Qty: '',
          Ships: 'no',
          Picture: 'https://old.example.com/front.jpg',
          Place: '1',
          Live: '',
          Was: '',
          Code: '00012345678905',
        },
      ],
      labels
    );

    const results = await run('products', rows);
    expect(results).toEqual([
      expect.objectContaining({ status: 'imported' }),
      expect.objectContaining({ status: 'imported' }),
    ]);

    // "New in" did not exist and was created; "Summer" was found by handle.
    expect(called('collectionService.create')).toEqual([
      [ctx, expect.objectContaining({ name: 'New in', type: 'manual' })],
    ]);
    const product = called('productService.create')[0]![1] as Record<string, unknown>;
    expect(product).toMatchObject({
      status: 'active',
      requiresShipping: true,
      collectionIds: ['collection-summer', expect.stringMatching(/^collectionService-/)],
    });

    // The gallery follows the positions, not the row order.
    expect(called('ingestImage').map((args) => args[0])).toEqual([
      'https://old.example.com/front.jpg',
      'https://old.example.com/back.jpg',
    ]);

    // The file's published date, not migration day.
    expect(called('product.update')).toEqual([
      [{ where: { id: expect.any(String) }, data: { publishedAt: new Date('2024-05-01') } }],
    ]);

    // The old address redirects to the new one, on the site being migrated.
    expect(called('redirect.create')).toEqual([
      [
        {
          data: {
            tenantId: ctx.tenantId,
            propertyId: ctx.propertyId,
            fromPath: '/products/linen-shirt-old',
            toPath: '/products/linen-shirt',
            statusCode: 301,
          },
        },
      ],
    ]);

    // Each variant keeps its own shipping answer; a bad barcode is left off and said.
    const variants = called('variantService.create').map((args) => args[2]) as Record<
      string,
      unknown
    >[];
    expect(variants[0]).toMatchObject({ sku: 'LIN-S', requiresShipping: true });
    expect(variants[0]).not.toHaveProperty('barcode');
    expect(variants[1]).toMatchObject({
      sku: 'LIN-M',
      requiresShipping: false,
      barcode: '00012345678905',
    });
    expect(results[0]!.errorMsg).toContain('not a barcode');

    // Stock at the main location, for the row that had a quantity.
    expect(called('inventoryService.updateLevelCount')).toEqual([
      [ctx, expect.any(String), expect.objectContaining({ onHand: 14, reason: 'recount' })],
    ]);
  });

  it('leaves the quantity alone when stock is already recorded, or a stock file is coming', async () => {
    state.answers.set('inventoryLevel.findFirst', () => ({ variantId: 'v' }));
    const row = { handle: 'mug', title: 'Mug', sku: 'MUG', quantity: '5' };
    const results = await run('products', [row]);
    expect(called('inventoryService.updateLevelCount')).toEqual([]);
    expect(results[0]!.errorMsg).toContain('already recorded');

    state.answers.clear();
    state.calls.length = 0;
    await run('products', [row], { ...MODULES, stockLevelsInRun: true });
    expect(called('inventoryService.updateLevelCount')).toEqual([]);
  });

  it('never clears a product from a blank cell and adds to its collections', async () => {
    state.answers.set('product.findFirst', () => ({ id: 'product-live' }));
    state.answers.set('collectionProduct.findMany', () => [{ collectionId: 'collection-kept' }]);
    state.answers.set('productCollection.findFirst', () => ({
      id: 'collection-sale',
      type: 'manual',
      name: 'Sale',
    }));

    await run('products', [{ handle: 'mug', title: 'Mug', collections: 'Sale' }]);
    const update = called('productService.update')[0]![2] as Record<string, unknown>;
    expect(update).not.toHaveProperty('status');
    expect(update).not.toHaveProperty('tags');
    expect(update).not.toHaveProperty('fulfillmentType');
    expect(update).not.toHaveProperty('requiresShipping');
    expect(update.collectionIds).toEqual(['collection-kept', 'collection-sale']);
  });

  it('says so when it cannot tell whether a redirect can be made', async () => {
    const results = await run(
      'products',
      [{ handle: 'mug', title: 'Mug', sku: 'MUG', source_url: '/old/mug' }],
      { upsert: true }
    );
    expect(called('redirect.create')).toEqual([]);
    expect(results[0]!.errorMsg).toContain('No redirect was made');
  });
});

describe('stock levels', () => {
  it('saves the unit cost and barcode on the item, and sets a home shelf that exists', async () => {
    state.answers.set('productVariant.findFirst', () => ({ id: 'variant-1', productId: 'p' }));
    state.answers.set('warehouse.findFirst', () => ({ id: 'warehouse-1' }));
    state.answers.set('inventoryBin.findFirst', () => ({ id: 'bin-a3' }));

    const rows = moveIn(
      'inventory_levels',
      [
        {
          SKU: 'MUG',
          Where: 'Back room',
          Count: '9',
          Cost: '3.20',
          EAN: '5012345678900',
          Shelf: 'A3',
        },
      ],
      {
        SKU: 'SKU',
        Where: 'Location',
        Count: 'On hand',
        Cost: 'Unit cost',
        EAN: 'Barcode',
        Shelf: 'Bin',
      }
    );
    const results = await run('inventory_levels', rows);

    expect(results[0]).toMatchObject({ status: 'updated' });
    expect(called('variantService.update')).toEqual([
      [ctx, 'variant-1', { costCents: 320, barcode: '5012345678900' }],
    ]);
    expect(called('inventoryService.setVariantHomeBin')).toEqual([[ctx, 'variant-1', 'bin-a3']]);
  });

  it('does not invent a shelf, and says so', async () => {
    state.answers.set('productVariant.findFirst', () => ({ id: 'variant-1', productId: 'p' }));
    state.answers.set('warehouse.findFirst', () => ({ id: 'warehouse-1' }));
    const results = await run('inventory_levels', [{ sku: 'MUG', quantity: '9', bin: 'Z9' }]);
    expect(called('inventoryService.setVariantHomeBin')).toEqual([]);
    expect(called('variantService.update')).toEqual([]);
    expect(results[0]!.errorMsg).toContain('No shelf called “Z9”');
  });
});

describe('customers', () => {
  it('splits a full name and puts the note on their timeline once', async () => {
    const rows = moveIn(
      'customers',
      [{ Mail: 'mary@example.com', Who: 'Mary Ann Lee', Role: 'Buyer', Said: 'Prefers mornings' }],
      { Mail: 'Email', Who: 'Full name', Role: 'Job title', Said: 'Note' }
    );
    await run('customers', rows);

    expect(called('customerService.create')[0]![1]).toMatchObject({
      firstName: 'Mary Ann',
      lastName: 'Lee',
      jobTitle: 'Buyer',
    });
    expect(called('engagementService.logNote')).toEqual([
      [ctx, { customerId: 'customer-new', body: 'Prefers mornings' }],
    ]);

    state.calls.length = 0;
    state.answers.set('engagementMessage.findFirst', () => ({ id: 'note-already' }));
    await run('customers', rows);
    expect(called('engagementService.logNote')).toEqual([]);
  });

  it('never lets a full name override the first and last name the file gave', async () => {
    await run('customers', [
      { email: 'sam@example.com', first_name: 'Sam', last_name: 'Ortiz', name: 'Samuel Ortiz' },
    ]);
    expect(called('customerService.create')[0]![1]).toMatchObject({
      firstName: 'Sam',
      lastName: 'Ortiz',
    });
  });
});

describe('categories and collections', () => {
  it('saves a category’s position and banner', async () => {
    const rows = moveIn(
      'categories',
      [{ Name: 'Shirts', Order: '4', Banner: 'https://old.example.com/shirts.jpg' }],
      { Name: 'Name', Order: 'Position', Banner: 'Image URL' }
    );
    await run('categories', rows);
    expect(called('categoryService.create')[0]![1]).toMatchObject({
      name: 'Shirts',
      position: 4,
      heroMediaId: 'asset:https://old.example.com/shirts.jpg',
    });
  });

  it('saves a collection’s banner, and never re-types one that is already here', async () => {
    const rows = moveIn(
      'collections',
      [{ Name: 'Summer', Banner: 'https://old.example.com/summer.jpg' }],
      { Name: 'Name', Banner: 'Image URL' }
    );
    await run('collections', rows);
    expect(called('collectionService.create')[0]![1]).toMatchObject({
      name: 'Summer',
      type: 'manual',
      heroMediaId: 'asset:https://old.example.com/summer.jpg',
    });

    state.calls.length = 0;
    state.answers.set('productCollection.findFirst', () => ({ id: 'collection-rules' }));
    await run('collections', [{ name: 'Summer' }]);
    expect(called('collectionService.update')[0]![2]).toEqual({ name: 'Summer' });
  });
});

describe('media', () => {
  it('saves the caption onto the file', async () => {
    const rows = moveIn(
      'media',
      [{ Link: 'https://old.example.com/team.jpg', Words: 'The team in 2019' }],
      { Link: 'File URL', Words: 'Caption' }
    );
    await run('media', rows);
    expect(called('mediaAsset.update')).toEqual([
      [
        {
          where: { id: 'asset:https://old.example.com/team.jpg' },
          data: { caption: 'The team in 2019' },
        },
      ],
    ]);
  });
});

describe('suppliers and purchase orders', () => {
  it('saves a supplier’s currency', async () => {
    const rows = moveIn('suppliers', [{ Name: 'Harbor Mills', Money: 'eur' }], {
      Name: 'Supplier name',
      Money: 'Currency',
    });
    await run('suppliers', rows);
    expect(called('inventoryService.createSupplier')[0]![1]).toMatchObject({
      name: 'Harbor Mills',
      currency: 'EUR',
    });
  });

  it('creates a purchase order in its currency, matched on the old number', async () => {
    state.answers.set('supplier.findFirst', () => ({ id: 'supplier-1' }));
    state.answers.set('warehouse.findFirst', () => ({ id: 'warehouse-1' }));
    state.answers.set('productVariant.findFirst', () => ({ id: 'variant-1', productId: 'p' }));
    const lookups: unknown[] = [];
    state.answers.set('purchaseOrder.findFirst', (args) => {
      lookups.push(args);
      return null;
    });

    const rows = moveIn(
      'purchase_orders',
      [{ PO: 'PO-7781', From: 'Harbor Mills', Money: 'cad', Line: 'MUG', Qty: '40', Each: '2.10' }],
      {
        PO: 'PO number',
        From: 'Supplier',
        Money: 'Currency',
        Line: 'Line SKU',
        Qty: 'Line quantity',
        Each: 'Line unit cost',
      }
    );
    const results = await run('purchase_orders', rows);

    expect(results[0]).toMatchObject({ status: 'imported' });
    expect(lookups).toEqual([
      { where: { tenantId: ctx.tenantId, reference: 'PO-7781' }, select: { id: true } },
    ]);
    expect(called('inventoryService.createPurchaseOrder')[0]![1]).toMatchObject({
      reference: 'PO-7781',
      currency: 'CAD',
      lines: [{ variantId: 'variant-1', quantity: 40, unitCostCents: 210 }],
    });
  });
});

describe('pages and posts', () => {
  it('redirects the old address to where the post now lives', async () => {
    const rows = moveIn(
      'content',
      [
        {
          Heading: 'Bleeding a fuel line',
          Path: 'bleeding-a-fuel-line',
          Was: '/2019/07/bleeding-a-fuel-line/',
        },
      ],
      { Heading: 'Title', Path: 'Slug', Was: 'Old URL' }
    );
    await run('content', rows);
    expect(called('redirect.create')).toEqual([
      [
        {
          data: expect.objectContaining({
            fromPath: '/2019/07/bleeding-a-fuel-line/',
            toPath: '/journal/bleeding-a-fuel-line',
          }),
        },
      ],
    ]);
  });
});
