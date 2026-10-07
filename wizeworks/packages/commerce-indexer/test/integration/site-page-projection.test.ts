// A site's pages can be found from the console's search box (sparx persona issue 130).
//
// MEASURED 2026-10-06 on Gillett Diesel: typing "About" with the About page open in
// the editor behind the box answered "Nothing in your records matches". Pages had
// no projector, so the record half of the search could not see any of them.
//
// Real Postgres: the documents the indexer would send, from rows written through
// the same Prisma client the projector uses.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { prisma, withTenant } from '@wizeworks/db';
import { REGISTRY } from '../../src/registry.js';

let tenantId = '';
let siteId = '';
let aboutId = '';
let productId = '';
let draftId = '';

const pages = () => {
  const projector = REGISTRY.get('builder_page');
  if (!projector) throw new Error('no projector for builder_page');
  return projector;
};

describe('a site page in search', () => {
  beforeAll(async () => {
    const slug = `idx-${crypto.randomBytes(4).toString('hex')}`;
    const tenant = await prisma.tenant.create({
      data: {
        slug,
        name: `Index ${slug}`,
        email: `${slug}@sparx.test`,
        plan: 'starter',
        status: 'active',
        settings: {},
      },
    });
    tenantId = tenant.id;

    await withTenant({ tenantId }, async (tx) => {
      const site = await tx.property.create({
        data: { tenantId, slug: 'savory', name: 'Savory Donuts' },
        select: { id: true },
      });
      siteId = site.id;
      const page = (data: {
        name: string;
        kind: string;
        slug: string | null;
        recordType?: string;
        seoTitle?: string;
        seoDescription?: string;
        publishedAt?: Date;
      }) =>
        tx.builderPage.create({
          data: { tenantId, propertyId: site.id, draftTree: {}, ...data },
          select: { id: true },
        });
      aboutId = (
        await page({
          name: 'About',
          kind: 'singleton',
          slug: 'about',
          seoTitle: 'Our story: family donuts since 1987',
          seoDescription: 'Who makes the donuts, and why we still fry at 4am.',
          publishedAt: new Date(),
        })
      ).id;
      productId = (
        await page({
          name: 'Each product',
          kind: 'collection',
          slug: '/products/:handle',
          recordType: 'commerce.product',
          publishedAt: new Date(),
        })
      ).id;
      draftId = (await page({ name: 'Catering', kind: 'singleton', slug: 'catering' })).id;
    });
  });

  afterAll(async () => {
    if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } });
  });

  it('is listed for a full rebuild', async () => {
    const ids = await pages().listIdsForTenant({ tenantId });
    expect(ids.sort()).toEqual([aboutId, productId, draftId].sort());
  });

  it('is found by its name, its address and its search title, and names its site', async () => {
    const doc = await pages().project({ tenantId }, aboutId);
    expect(doc).toMatchObject({
      entity_type: 'builder_page',
      module: 'builder',
      record_id: aboutId,
      title: 'About',
      subtitle: '/about · Savory Donuts',
      body: 'Who makes the donuts, and why we still fry at 4am.',
      status: 'published',
      url: `/builder?pageId=${aboutId}&site=${siteId}`,
    });
    expect(doc?.keywords).toEqual([
      'about',
      'Our story: family donuts since 1987',
      'Savory Donuts',
    ]);
  });

  it('says the page for every product in the owner’s words', async () => {
    const doc = await pages().project({ tenantId }, productId);
    expect(doc?.subtitle).toBe('Every page under /products/ · Savory Donuts');
  });

  it('marks a page that was never published as a draft', async () => {
    const doc = await pages().project({ tenantId }, draftId);
    expect(doc?.status).toBe('draft');
  });

  it('is removed from search once the page is deleted', async () => {
    await withTenant({ tenantId }, (tx) => tx.builderPage.delete({ where: { id: draftId } }));
    expect(await pages().project({ tenantId }, draftId)).toBeNull();
  });
});
