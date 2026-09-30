// WHAT ON HER SITE IS STILL SOMEBODY ELSE'S WORDS.
//
// A design is copied into a site when it is installed, so a business that pays
// and publishes before editing goes live with the design's example products and
// example articles under its own name. Measured on a real one: The Marrow
// Review, a reader-funded magazine of ideas, publishing three platform marketing
// articles in its Journal and selling thirteen sample products in its shop, live
// and public, with nothing in the product ever mentioning it (issue 849).
//
// `reportUntouched` is what lets Home say so. It has to be right in BOTH
// directions and the second one matters more: an example she has edited is HERS,
// and telling her it is not is telling a business owner her own work is a
// placeholder. So this test installs a design, asserts everything is reported,
// then edits exactly one product and asserts that one and only that one drops
// off the list.
//
// DB-backed on purpose. The question is "does the live row still match the
// stamped baseline", and both halves of that are rows.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { prisma } from '@wizeworks/db';
import type { Blueprint } from '@wizeworks/blueprints';

import { createTestTenant, dropTestTenant } from '../helpers.js';
import { installBlueprint } from '../../src/lib/blueprint-installer.js';
import { reportUntouched } from '../../src/lib/blueprint-updater.js';

const noop = (): void => undefined;
const logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  fatal: noop,
  trace: noop,
  child: () => logger,
} as unknown as FastifyBaseLogger;

/** Two example products and one example article — the two kinds that put another
 *  party's words on a customer's side of the glass. */
const BLUEPRINT = {
  key: 'test-untouched',
  version: '1.0.0',
  name: 'Untouched Fixture',
  summary: 'Fixture for the still-the-example report.',
  vertical: 'services',
  requiresModules: [],
  brand: {
    businessName: 'Untouched Fixture',
    colors: { primary: '#e04631' },
    fonts: { heading: 'Space Grotesk', body: 'Inter' },
  },
  theme: {
    name: 'Untouched Fixture Theme',
    basePresetKey: 'sparx',
    presentation: {},
    apply: false,
  },
  assets: [],
  contentTypes: [],
  authors: [{ slug: 'fixture-writer', displayName: 'Fixture Writer', bio: 'Writes here.' }],
  content: [
    {
      typeKey: 'blog_post',
      slug: 'launch-in-a-weekend',
      status: 'draft',
      body: { title: 'How to launch your online store in a weekend' },
      authorSlug: 'fixture-writer',
      categories: [],
      tags: [],
    },
  ],
  commerce: {
    categories: [],
    collections: [],
    productTypes: [],
    products: [
      {
        handle: 'rowan-enamel-mug',
        title: 'Rowan Enamel Mug',
        status: 'active',
        categoryHandles: [],
        collectionHandles: [],
        images: [],
        options: [],
        variants: [
          {
            sku: 'ROWAN-MUG-1',
            priceCents: 1800,
            inventoryPolicy: 'continue',
            isDefault: true,
            optionValues: {},
          },
        ],
      },
      {
        handle: 'rowan-canvas-tote',
        title: 'Rowan Canvas Tote',
        status: 'active',
        categoryHandles: [],
        collectionHandles: [],
        images: [],
        options: [],
        variants: [
          {
            sku: 'ROWAN-TOTE-1',
            priceCents: 2200,
            inventoryPolicy: 'continue',
            isDefault: true,
            optionValues: {},
          },
        ],
      },
    ],
  },
  emails: [],
  sequences: [],
  pages: [],
} as unknown as Blueprint;

let tenantId = '';
let propertyId = '';
let installId = '';

describe('what is still the example', () => {
  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.tenantId;
    propertyId = tenant.propertyId;
    // A tenant starts with ZERO modules on, so the content and commerce slices
    // would be skipped and this test would assert nothing.
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { modules: { cms: { enabled: true }, commerce: { enabled: true } } } },
    });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      await tx.contentType.create({
        data: {
          tenantId,
          key: 'blog_post',
          name: 'Post',
          pluralName: 'Posts',
          schemaJson: { fields: [{ key: 'title', type: 'text', label: 'Title' }] },
        },
      });
    });
    const installed = await installBlueprint(
      { tenantId, userId: null, propertyId, logger },
      BLUEPRINT
    );
    installId = installed.installId;
  });

  afterAll(async () => {
    if (tenantId) await dropTestTenant(tenantId);
  });

  function read() {
    return reportUntouched(
      { tenantId, userId: null, propertyId, logger },
      { id: installId, blueprintKey: BLUEPRINT.key }
    );
  }

  it('reports the example products and the example article, straight after the install', async () => {
    const report = await read();
    const keys = report.examples.map((e) => e.naturalKey).sort();
    expect(keys).toContain('rowan-enamel-mug');
    expect(keys).toContain('rowan-canvas-tote');
    expect(keys).toContain('blog_post:launch-in-a-weekend');
  });

  it('keeps the products apart from the pages, because the harm is a different size', async () => {
    const report = await read();
    // An unedited About page says nothing about the business. An unedited shop
    // sells an invented brand's mug to the business's customers.
    for (const entry of report.examples) {
      expect(['product', 'content']).toContain(entry.kind);
    }
    for (const entry of report.pages) {
      expect(entry.kind).toBe('page');
    }
    expect(report.total).toBe(report.examples.length + report.pages.length);
  });

  it('drops a product the moment she writes her own words on it, and only that one', async () => {
    const before = await read();
    const beforeKeys = before.examples.map((e) => e.naturalKey);
    expect(beforeKeys).toContain('rowan-enamel-mug');
    expect(beforeKeys).toContain('rowan-canvas-tote');

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      await tx.product.updateMany({
        where: { tenantId, handle: 'rowan-enamel-mug' },
        data: { title: 'Our house mug' },
      });
    });

    const after = await read();
    const afterKeys = after.examples.map((e) => e.naturalKey);
    // Hers now. Telling a business owner her own work is a placeholder is a
    // worse failure than saying nothing at all.
    expect(afterKeys).not.toContain('rowan-enamel-mug');
    // And the one she has not touched is still reported, so an edit to one thing
    // does not quietly silence the panel for everything.
    expect(afterKeys).toContain('rowan-canvas-tote');
  });
});
