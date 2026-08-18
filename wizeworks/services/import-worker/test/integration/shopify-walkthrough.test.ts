// The whole errand, once, on a real-shaped Shopify export.
//
// Every other suite tests a layer. This one is the walk a business owner actually
// takes: the CSV Shopify emails them, read by the same parser their browser runs,
// turned into jobs the way the API turns them, processed by the real processors
// against a real database — and then the question that matters, which is whether the
// thing they were promised is now in their account.
//
// It exists because each layer passing is not evidence the errand works. The bug this
// shape catches is the one that lives BETWEEN the layers: a parser that emits a
// column the processor does not read, an adapter whose handle grouping disagrees with
// the processor's, a variant matrix that survives validation and lands as three
// unrelated products. None of those fail a unit test.
//
// The fixture below is written to be awkward on purpose — every quirk in it is one
// that has actually broken an importer somewhere:
//
//   · a product spread over eight rows, three variants and four images
//   · an embedded newline and a doubled quote inside Body (HTML)
//   · continuation rows carrying nothing but an image
//   · weights in kilograms while the column is still called Grams
//   · a second product with no variants at all
//   · stock in a wide per-location file for a warehouse that does not exist yet
//   · an order flattened across two line rows

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import pino from 'pino';
import { prisma, withTenant } from '@wizeworks/db';
import { readSource, type CanonicalEntity } from '@wizeworks/migration';
import { getProcessor, type ImportRow, type ProcessorContext } from '../../src/processors/index.js';

const logger = pino({ level: 'silent' });

let ctx: ProcessorContext;
let tenantId: string;

// ── The files Shopify actually gives you ─────────────────────────────────────

const PRODUCTS_CSV = `Handle,Title,Body (HTML),Vendor,Type,Tags,Published,Option1 Name,Option1 Value,Variant SKU,Variant Grams,Variant Weight Unit,Variant Inventory Tracker,Variant Inventory Qty,Variant Price,Variant Compare At Price,Cost per item,Image Src,Image Position,Image Alt Text,SEO Title,Status
merino-beanie,Merino Beanie,"<p>Warm, and it stays warm.</p>
<p>She called it ""the good hat"".</p>",Northmill,Hats,"winter, wool",TRUE,Size,Small,BEANIE-S,0.2,kg,shopify,12,24.00,30.00,9.10,https://cdn.example.com/beanie-1.jpg,1,Beanie from the front,Merino Beanie,active
merino-beanie,,,,,,,Size,Medium,BEANIE-M,0.21,kg,shopify,8,24.00,30.00,9.10,https://cdn.example.com/beanie-2.jpg,2,,,
merino-beanie,,,,,,,Size,Large,BEANIE-L,0.22,kg,shopify,0,24.00,,9.10,https://cdn.example.com/beanie-3.jpg,3,,,
merino-beanie,,,,,,,,,,,,,,,,,https://cdn.example.com/beanie-4.jpg,4,,,
wool-scarf,Wool Scarf,<p>Long.</p>,Northmill,Scarves,wool,TRUE,,,SCARF,0.3,kg,shopify,5,38.00,,14.00,https://cdn.example.com/scarf.jpg,1,,Wool Scarf,active
`;

const INVENTORY_CSV = `Handle,Title,Option1 Name,Option1 Value,SKU,HS Code,COO,Studio,Market stall
merino-beanie,Merino Beanie,Size,Small,BEANIE-S,,,9,3
merino-beanie,Merino Beanie,Size,Medium,BEANIE-M,,,6,2
merino-beanie,Merino Beanie,Size,Large,BEANIE-L,,,0,not stocked
wool-scarf,Wool Scarf,,,SCARF,,,5,0
`;

const ORDERS_CSV = `Name,Email,Financial Status,Fulfillment Status,Currency,Subtotal,Shipping,Taxes,Total,Created at,Lineitem quantity,Lineitem name,Lineitem price,Lineitem sku,Billing Name,Shipping Name,Shipping City,Shipping Zip
#1001,ada@example.com,paid,fulfilled,GBP,62.00,4.95,0.00,66.95,2025-03-04 10:00:00 +0000,1,Merino Beanie - Small,24.00,BEANIE-S,Ada Vaughan,Ada Vaughan,Bristol,BS1 4DJ
#1001,,,,,,,,,,1,Wool Scarf,38.00,SCARF,,,,
`;

/** Read a file exactly as the browser does, then hand the rows to the processor
 *  exactly as the worker does. No shortcuts through either. */
async function importFile(
  text: string,
  fileName: string,
  entity: CanonicalEntity
): Promise<{ imported: number; updated: number; errors: string[] }> {
  const read = readSource({ text, fileName });
  expect(read.detected, `${fileName} was not recognised as a Shopify export`).not.toBeNull();

  const mapped = read.entities.find((candidate) => candidate.entity === entity);
  expect(mapped, `${fileName} produced no ${entity}`).toBeDefined();
  if (mapped === undefined) throw new Error('unreachable');
  // Whatever the tenant is shown, they are shown it BEFORE this point. A blocked
  // report here would mean the walkthrough starts from a file the UI would refuse.
  expect(mapped.report.blocked).toBe(false);

  const processor = getProcessor(entity);
  expect(processor, `no processor for ${entity}`).toBeDefined();
  if (processor === undefined) throw new Error('unreachable');

  const rows = mapped.rows.filter(
    (_row, index) => !mapped.report.errorRows.includes(index)
  ) as ImportRow[];

  const results = await processor.run(ctx, rows, { upsert: true, vendor: 'shopify' }, logger);

  return {
    imported: results.filter((result) => result.status === 'imported').length,
    updated: results.filter((result) => result.status === 'updated').length,
    errors: results
      .filter((result) => result.status === 'error')
      .map((result) => result.errorMsg ?? 'unknown'),
  };
}

beforeAll(async () => {
  const slug = `walk-${crypto.randomBytes(4).toString('hex')}`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `Walkthrough ${slug}`,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: 'active',
      settings: {},
    },
  });
  tenantId = tenant.id;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    await tx.property.create({
      data: { tenantId, slug: 'primary', name: `Walkthrough ${slug}`, isPrimary: true },
    });
  });
  ctx = { tenantId, tenantSlug: slug };
});

afterAll(async () => {
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe('moving a small shop off Shopify', () => {
  it('turns eight rows into two products, not eight', async () => {
    const outcome = await importFile(PRODUCTS_CSV, 'products_export.csv', 'products');
    expect(outcome.errors).toEqual([]);

    const products = await withTenant({ tenantId }, (tx) =>
      tx.product.findMany({
        orderBy: { title: 'asc' },
        include: { variants: { orderBy: { sku: 'asc' } } },
      })
    );

    expect(products.map((product) => product.title)).toEqual(['Merino Beanie', 'Wool Scarf']);

    const beanie = products[0];
    expect(beanie?.variants).toHaveLength(3);
    expect(beanie?.variants.map((variant) => variant.sku)).toEqual([
      'BEANIE-L',
      'BEANIE-M',
      'BEANIE-S',
    ]);

    // The body carried an embedded newline and a doubled quote — the two things a
    // naive CSV split destroys, and the reason this package has its own parser.
    expect(beanie?.description).toContain('stays warm');
    expect(beanie?.description).toContain('"the good hat"');
    expect(beanie?.description).not.toContain('""');

    // Shopify still calls the column Grams while writing kilograms into it.
    const small = beanie?.variants.find((variant) => variant.sku === 'BEANIE-S');
    expect(small?.priceCents).toBe(2400);
    expect(small?.compareAtPriceCents).toBe(3000);
    expect(Number(small?.weightGrams ?? 0)).toBeCloseTo(200, 0);

    // A product with no option columns at all is one variant, not zero.
    expect(products[1]?.variants).toHaveLength(1);
  });

  it('keeps the option matrix the tenant had, in their order', async () => {
    const beanie = await withTenant({ tenantId }, (tx) =>
      tx.product.findFirstOrThrow({
        where: { title: 'Merino Beanie' },
        include: { options: { include: { values: true } } },
      })
    );

    expect(beanie.options.map((option) => option.name)).toEqual(['Size']);
    // Small, Medium, Large — the order the file had. Sorting this alphabetically
    // gives Large, Medium, Small, which is nobody's size chart.
    expect(beanie.options[0]?.values.map((value) => value.value)).toEqual([
      'Small',
      'Medium',
      'Large',
    ]);
  });

  it('re-gathers a gallery spread across continuation rows', async () => {
    const images = await withTenant({ tenantId }, (tx) =>
      tx.variantImage.findMany({ orderBy: { position: 'asc' } })
    );
    // Four for the beanie (three variant rows plus one image-only row) and one for
    // the scarf. The fourth is the one only the re-gathering finds.
    expect(images.length).toBeGreaterThanOrEqual(5);
  });

  it('brings the stock across, and makes the shelf it belongs on', async () => {
    const outcome = await importFile(INVENTORY_CSV, 'inventory_export.csv', 'inventory_levels');
    expect(outcome.errors).toEqual([]);

    const warehouses = await withTenant({ tenantId }, (tx) =>
      tx.warehouse.findMany({ orderBy: { name: 'asc' } })
    );
    // Neither existed a moment ago. Every other importer on the market makes the
    // tenant re-count; this creates the location and reports that it did.
    expect(warehouses.map((warehouse) => warehouse.name)).toEqual(['Market stall', 'Studio']);

    const levels = await withTenant({ tenantId }, (tx) =>
      tx.inventoryLevel.findMany({ include: { variant: true, warehouse: true } })
    );
    const studioSmall = levels.find(
      (level) => level.variant.sku === 'BEANIE-S' && level.warehouse.name === 'Studio'
    );
    expect(studioSmall?.onHand).toBe(9);

    // `not stocked` is Shopify's way of saying this variant is not carried there —
    // reading it as a number would be a zero the tenant never counted.
    const stallLarge = levels.find(
      (level) => level.variant.sku === 'BEANIE-L' && level.warehouse.name === 'Market stall'
    );
    expect(stallLarge).toBeUndefined();
  });

  it('runs the stock file twice without doubling anyone stock', async () => {
    await importFile(INVENTORY_CSV, 'inventory_export.csv', 'inventory_levels');

    const levels = await withTenant({ tenantId }, (tx) =>
      tx.inventoryLevel.findMany({ include: { variant: true, warehouse: true } })
    );
    const studioSmall = levels.find(
      (level) => level.variant.sku === 'BEANIE-S' && level.warehouse.name === 'Studio'
    );
    // Still nine. Counts are SET, not added — a tenant who re-uploads because the
    // first attempt looked wrong must not end up with twice the hats.
    expect(studioSmall?.onHand).toBe(9);
  });

  it('writes the order history without selling anything twice', async () => {
    const stockBefore = await withTenant({ tenantId }, (tx) =>
      tx.inventoryLevel.findMany({ include: { variant: true } })
    );

    const outcome = await importFile(ORDERS_CSV, 'orders_export.csv', 'orders');
    expect(outcome.errors).toEqual([]);

    const orders = await withTenant({ tenantId }, (tx) =>
      tx.order.findMany({ include: { items: true } })
    );
    expect(orders).toHaveLength(1);
    const order = orders[0];
    expect(order?.items).toHaveLength(2);
    expect(Number(order?.total ?? 0)).toBeCloseTo(66.95, 2);
    // Provenance: this arrived, it was not placed. The distinction is what stops
    // last year's revenue being counted as this morning's.
    expect(order?.channel).toBe('import');

    // The customer on it exists now, because they were on the order and nowhere else.
    const customer = await withTenant({ tenantId }, (tx) =>
      tx.customer.findFirst({ where: { email: 'ada@example.com' } })
    );
    expect(customer).not.toBeNull();

    // And the stock is untouched. Replaying history through the order service would
    // have decremented every level that was just imported — the beanie would go on
    // sale a hat short on its first day.
    const stockAfter = await withTenant({ tenantId }, (tx) =>
      tx.inventoryLevel.findMany({ include: { variant: true } })
    );
    expect(stockAfter.map((level) => level.onHand).sort()).toEqual(
      stockBefore.map((level) => level.onHand).sort()
    );
  });

  it('leaves the catalogue as it found it on a second pass', async () => {
    const outcome = await importFile(PRODUCTS_CSV, 'products_export.csv', 'products');
    expect(outcome.errors).toEqual([]);
    // Updated, not imported again. A tenant who runs the file twice — which they do,
    // because the first run is the practice one — must not end up with two of
    // everything.
    expect(outcome.imported).toBe(0);
    expect(outcome.updated).toBeGreaterThan(0);

    const count = await withTenant({ tenantId }, (tx) => tx.product.count());
    expect(count).toBe(2);
  });
});
