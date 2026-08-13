// Installing ONE design onto TWO sites of the same tenant.
//
// WHY THIS EXISTS. The install dialog says, in as many words, "Pick which site this
// design goes into. You can add it to more than one." It could not. Two slices created
// rows blindly against natural keys that are UNIQUE PER TENANT, so the second site to
// install a given design hit a constraint and the whole install failed and rolled back:
//
//   · `sitebuilder_themes` is UNIQUE (tenant_id, name) — the saved-theme LIBRARY is
//     tenant-wide by design. Worst for the golden `sparx` bundle: every tenant is
//     provisioned with it, so its theme name is ALWAYS taken and it could never be
//     added to a second site at all.
//   · `content_entries` is UNIQUE (tenant_id, type_key, slug) — an entry is tenant-wide
//     with per-site scoping through `content_entry_properties`.
//
// Neither failure is visible until somebody actually owns two sites, which is why both
// shipped. The multi-site story is a headline capability (docs/49), so this is pinned.
//
// The SECOND half matters as much as the first, and is where COMMERCE comes in. The
// commerce slice always reconciled correctly on INSTALL (`reuseOrRestore*`) — the defect
// was on the other side: uninstall removed every id in its maps, minted or reconciled. So
// removing the design from site B while site A still wore it took A's theme, A's articles,
// A's categories and collections, and soft-deleted the products A was selling. Silent data
// loss on what reads like an undo, and the worst outcome of the three.
//
// Both halves are asserted for all three: nothing duplicated on the second install,
// nothing destroyed on the second uninstall.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { prisma } from '@sparx/db';
import { createTestTenant, dropTestTenant } from '../helpers.js';
import { deleteInstall, installBlueprint } from '../../src/lib/blueprint-installer.js';
import type { Blueprint } from '@sparx/blueprints';

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

/** The smallest blueprint that exercises every shared-row path: a named theme, a slugged
 *  content entry, and a commerce catalogue (category + collection + product). Deliberately
 *  NOT a catalog bundle — this pins the installer's behaviour, and must not start failing
 *  because a shipped bundle was re-authored. */
const BLUEPRINT = {
  key: 'test-two-sites',
  version: '1.0.0',
  name: 'Two Sites Fixture',
  summary: 'Fixture for the install-onto-a-second-site regression.',
  vertical: 'services',
  requiresModules: [],
  // `colors.primary` + both fonts are REQUIRED by BrandDecl — the theme slice reads
  // them straight through to the saved theme's brand snapshot.
  brand: {
    businessName: 'Two Sites Fixture',
    colors: { primary: '#e04631' },
    fonts: { heading: 'Space Grotesk', body: 'Inter' },
  },
  theme: {
    name: 'Two Sites Fixture Theme',
    basePresetKey: 'sparx',
    presentation: {},
    apply: false,
  },
  assets: [],
  contentTypes: [],
  authors: [],
  content: [
    {
      typeKey: 'blog_post',
      slug: 'shared-across-sites',
      status: 'draft',
      body: { title: 'Shared across sites' },
    },
  ],
  // The commerce slice ALREADY reconciled by natural key on install — the defect was on
  // the other side: uninstall removed every id in its maps, reused or not.
  commerce: {
    categories: [{ handle: 'shared-category', name: 'Shared Category', productHandles: [] }],
    collections: [
      {
        handle: 'shared-collection',
        name: 'Shared Collection',
        type: 'manual',
        productHandles: [],
      },
    ],
    productTypes: [],
    products: [
      {
        handle: 'shared-product',
        title: 'Shared Product',
        status: 'active',
        categoryHandles: [],
        collectionHandles: [],
        images: [],
        options: [],
        // `optionValues` is read unguarded (`Object.entries`), so the fixture supplies it
        // even though this product has no options — the real schema defaults it.
        variants: [
          {
            sku: 'SHARED-SKU-1',
            priceCents: 1000,
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
let siteA = '';
let siteB = '';

describe('installing one design onto two sites', () => {
  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.tenantId;
    // The content slice is CMS-gated, and a tenant starts with ZERO modules on (that is
    // the platform's whole premise — you turn on what you pay for). Without this the
    // entries are silently skipped and the content half of this test asserts nothing.
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { modules: { cms: { enabled: true }, commerce: { enabled: true } } } },
    });
    // …and the type the entry is filed under. A real tenant gets `blog_post` from CMS
    // activation; a bare fixture does not, and without it the entry resolves to no type
    // and is skipped — which looks exactly like the bug this test is meant to catch.
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
    // The tenant's PRIMARY, seeded by the helper exactly as real provisioning does —
    // 'exactly one primary per tenant' is a partial unique index, so making another is a
    // constraint violation rather than a second site.
    siteA = tenant.propertyId;
    siteB = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      const row = await tx.property.create({
        data: { tenantId, slug: 'site-b', name: 'Site B', isPrimary: false },
        select: { id: true },
      });
      return row.id;
    });
  });

  afterAll(async () => {
    if (tenantId) await dropTestTenant(tenantId);
  });

  it('succeeds on the second site instead of colliding on the first site’s rows', async () => {
    const a = await installBlueprint(
      { tenantId, userId: null, propertyId: siteA, logger },
      BLUEPRINT
    );
    expect(a.installId).toBeTruthy();

    // The whole point. Before the fix this threw a unique-constraint error out of the
    // theme slice, the transaction rolled back, and the install row was marked failed.
    const b = await installBlueprint(
      { tenantId, userId: null, propertyId: siteB, logger },
      BLUEPRINT
    );
    expect(b.installId).toBeTruthy();

    // ONE library theme and ONE entry, shared — not a duplicate pair, which is what a
    // "rename it and move on" fix would have produced.
    const themes = await countThemes();
    expect(themes).toBe(1);
    const entries = await countEntries();
    expect(entries).toBe(1);

    // …and site B genuinely SHOWS the entry: reuse must still scope it to the new site,
    // or the second install silently yields a site with no content on it.
    const links = await entryLinks();
    expect(new Set(links)).toEqual(new Set([siteA, siteB]));

    // Commerce reconciles on install too — one catalogue, wired into both sites.
    expect(await countCommerce()).toEqual({ categories: 1, collections: 1, products: 1 });
    expect(new Set(await productLinks())).toEqual(new Set([siteA, siteB]));
  });

  it('uninstalling the second site leaves the first site’s theme and content intact', async () => {
    const installs = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      return tx.tenantBlueprintInstall.findMany({
        where: { tenantId, blueprintKey: BLUEPRINT.key },
        select: { id: true, propertyId: true },
      });
    });
    const bInstall = installs.find((i) => i.propertyId === siteB);
    expect(bInstall).toBeDefined();

    await deleteInstall({ tenantId, userId: null, propertyId: siteB, logger }, bInstall!.id);

    // The rows survive — they were never site B's to delete.
    expect(await countThemes()).toBe(1);
    expect(await countEntries()).toBe(1);
    // But site B no longer shows the entry: unlink, not delete.
    expect(await entryLinks()).toEqual([siteA]);

    // Same for the catalogue. This is the one that would have hurt most: site A's
    // product soft-deleted and its category gone, because site B pressed Remove.
    expect(await countCommerce()).toEqual({ categories: 1, collections: 1, products: 1 });
    expect(await liveProducts()).toBe(1);
    expect(await productLinks()).toEqual([siteA]);
  });
});

async function countCommerce(): Promise<{
  categories: number;
  collections: number;
  products: number;
}> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    return {
      categories: await tx.productCategory.count({
        where: { tenantId, handle: 'shared-category' },
      }),
      collections: await tx.productCollection.count({
        where: { tenantId, handle: 'shared-collection' },
      }),
      products: await tx.product.count({ where: { tenantId, handle: 'shared-product' } }),
    };
  });
}

/** Products SOFT-delete, so "still there" is not the same as "still sellable" — the
 *  damage this pins is a tombstone, not a missing row. */
async function liveProducts(): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    return tx.product.count({ where: { tenantId, handle: 'shared-product', deletedAt: null } });
  });
}

async function productLinks(): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    const product = await tx.product.findFirst({
      where: { tenantId, handle: 'shared-product' },
      select: { id: true },
    });
    if (!product) return [];
    const rows = await tx.productProperty.findMany({
      where: { productId: product.id },
      select: { propertyId: true },
    });
    return rows.map((r) => r.propertyId);
  });
}

async function countThemes(): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    return tx.siteTheme.count({ where: { tenantId, name: BLUEPRINT.theme.name } });
  });
}

async function countEntries(): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    return tx.contentEntry.count({ where: { tenantId, slug: 'shared-across-sites' } });
  });
}

async function entryLinks(): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    const entry = await tx.contentEntry.findFirst({
      where: { tenantId, slug: 'shared-across-sites' },
      select: { id: true },
    });
    if (!entry) return [];
    const rows = await tx.contentEntryProperty.findMany({
      where: { entryId: entry.id },
      select: { propertyId: true },
    });
    return rows.map((r) => r.propertyId);
  });
}
