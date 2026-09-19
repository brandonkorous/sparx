// Whose pages a search score is about.
//
// WHY THIS EXISTS. `seo_audits.property_id` shipped and not one of the table's
// four indexes mentions it, because no read ever filtered on it. So a clothing
// maker with seven websites opened "How people find you" on her shop and read
// **51 pages checked, average 77** — her shop has 42 and averages 76. The other
// nine were her Archive site's pages, scored against a different domain with
// different content, quietly moving her number (issue 391).
//
// TWO TIERS, and the second is the point. A `builder_page` audit carries the site
// its page belongs to; a `cms_page` / `product` / `collection` audit carries NULL,
// because those entities express site visibility through junction tables rather
// than a column. So NULL means "not pinned by this row", and dropping those would
// have taken 20 of her 42 pages off the screen to fix a 9-page error.
//
// AND THEN THE SECOND TIER HAD TO BE FOLLOWED THROUGH. Reading NULL as "shown
// everywhere" is right for an entity linked to no site and wrong for one linked
// to a DIFFERENT one, and 391 recorded that residual rather than closing it. By
// the next walk it was 47 of her 96 pages: her Sample Sale's products, which
// score 95, making her shop read four points better than it is on the one screen
// that exists to say what needs work (issue 639). The predicate now reaches
// through the junction tables, which is why it is SQL.

import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { invalidateModuleCache } from '@wizeworks/auth';
import { prisma, withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import {
  authHeader,
  createTestTenant,
  dropTestTenant,
  signToken,
  type TestTenant,
} from '../helpers.js';

async function enableSeo(tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: { modules: { seo: { enabled: true }, builder: { enabled: true } } } },
  });
  invalidateModuleCache();
}

async function createSite(t: TestTenant, name: string): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
    const row = await tx.property.create({
      data: { tenantId: t.tenantId, slug, name, isPrimary: false },
      select: { id: true },
    });
    return row.id;
  });
}

/** Stored scorecards, each pinned to a site or to none. */
async function seed(
  t: TestTenant,
  audits: { title: string; score: number; propertyId: string | null }[]
): Promise<void> {
  await withTenant({ tenantId: t.tenantId }, async (tx) => {
    for (const a of audits) {
      await tx.seoAudit.create({
        data: {
          tenantId: t.tenantId,
          propertyId: a.propertyId,
          entityType: a.propertyId ? 'builder_page' : 'product',
          entityId: crypto.randomUUID(),
          score: a.score,
          grade: a.score >= 70 ? 'good' : 'poor',
          title: a.title,
          path: `/${a.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          card: { checks: [{ id: 'title', label: 'Title', category: 'basics', status: 'pass' }] },
          computedAt: new Date(),
        },
      });
    }
  });
}

describe('a search score is about the site you are looking at', () => {
  it("counts this site's pages plus the unpinned ones, and not another site's", async () => {
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableSeo(t.tenantId);
      const shop = t.propertyId;
      const archive = await createSite(t, 'The Archive');
      await seed(t, [
        { title: 'Shop home', score: 60, propertyId: shop },
        { title: 'Shop about', score: 80, propertyId: shop },
        // Not pinned by the audit row — a product, whose visibility lives in a
        // junction. Counted on every site, deliberately.
        { title: 'A product', score: 70, propertyId: null },
        // Another website's pages. These are the nine.
        { title: 'Archive home', score: 100, propertyId: archive },
        { title: 'Archive index', score: 100, propertyId: archive },
      ]);
      const token = signToken(app, t);

      const onShop = await app.inject({
        method: 'GET',
        url: '/v1/seo/audits',
        headers: { ...authHeader(token), 'x-sparx-property-id': shop },
      });
      const titles = (onShop.json().data as { title: string }[]).map((r) => r.title).sort();

      // Before the fix this was all five, on every site of the business.
      expect(titles).toEqual(['A product', 'Shop about', 'Shop home']);
      expect(titles).not.toContain('Archive home');
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });

  it('gives each site its own average, which is the number that moved', async () => {
    // The tiles are computed from this list, so the scoping IS the score. Her shop
    // averaged 76 and the screen said 77 because another site's high-scoring pages
    // were in the mean.
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableSeo(t.tenantId);
      const shop = t.propertyId;
      const archive = await createSite(t, 'The Archive');
      await seed(t, [
        { title: 'Shop one', score: 60, propertyId: shop },
        { title: 'Shop two', score: 60, propertyId: shop },
        { title: 'Archive one', score: 100, propertyId: archive },
        { title: 'Archive two', score: 100, propertyId: archive },
      ]);
      const token = signToken(app, t);

      const mean = async (id: string) => {
        const res = await app.inject({
          method: 'GET',
          url: '/v1/seo/audits',
          headers: { ...authHeader(token), 'x-sparx-property-id': id },
        });
        const rows = res.json().data as { score: number }[];
        return rows.reduce((sum, r) => sum + r.score, 0) / rows.length;
      };

      expect(await mean(shop), 'her shop').toBe(60);
      expect(await mean(archive), 'the archive').toBe(100);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });

  it('scopes the checklist roll-up and the activity feed too', async () => {
    // Three reads feed this one screen — the tiles, "What to work on", and
    // "Recently checked". Scoping one and not the others is a screen that
    // disagrees with itself.
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableSeo(t.tenantId);
      const shop = t.propertyId;
      const archive = await createSite(t, 'The Archive');
      await seed(t, [
        { title: 'Shop one', score: 60, propertyId: shop },
        { title: 'Archive one', score: 100, propertyId: archive },
        { title: 'Archive two', score: 100, propertyId: archive },
      ]);
      const token = signToken(app, t);
      const here = { ...authHeader(token), 'x-sparx-property-id': shop };

      const checklist = await app.inject({
        method: 'GET',
        url: '/v1/seo/reports/checklist',
        headers: here,
      });
      expect(checklist.json().data.summary.pagesScored, 'pages behind the checklist').toBe(1);

      const activity = await app.inject({
        method: 'GET',
        url: '/v1/seo/reports/activity',
        headers: here,
      });
      const seen = (activity.json().data as { title: string }[]).map((r) => r.title);
      expect(seen).toEqual(['Shop one']);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });
});

/** A product, and which of the business's sites sell it. No links = every site. */
async function productOn(t: TestTenant, siteIds: string[]): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const tag = crypto.randomBytes(4).toString('hex');
    const row = await tx.product.create({
      data: {
        tenantId: t.tenantId,
        title: `P-${tag}`,
        handle: `p-${tag}`,
        status: 'active',
        ...(siteIds.length > 0
          ? { propertyLinks: { create: siteIds.map((propertyId) => ({ propertyId })) } }
          : {}),
      },
      select: { id: true },
    });
    return row.id;
  });
}

/** A stored scorecard for one real product. */
async function scoreProduct(
  t: TestTenant,
  productId: string,
  title: string,
  score: number
): Promise<void> {
  await withTenant({ tenantId: t.tenantId }, async (tx) => {
    await tx.seoAudit.create({
      data: {
        tenantId: t.tenantId,
        // NULL, like every product audit the indexer writes: the pin lives in the
        // junction table, not on this row.
        propertyId: null,
        entityType: 'product',
        entityId: productId,
        score,
        grade: score >= 70 ? 'good' : 'poor',
        title,
        path: `/products/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        card: { checks: [{ id: 'title', label: 'Title', category: 'basics', status: 'pass' }] },
        computedAt: new Date(),
      },
    });
  });
}

describe('an unpinned audit is not the same as an unpinned entity', () => {
  it('drops a product sold only on her OTHER site, and keeps the shared one', async () => {
    // The case that made her shop read 79 when it is 75: the audit row says NULL
    // for every product, so reading NULL as "shown everywhere" put her Sample
    // Sale's stock into her shop's average.
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableSeo(t.tenantId);
      const shop = t.propertyId;
      const sale = await createSite(t, 'Sample Sale');

      await scoreProduct(t, await productOn(t, [shop]), 'Sold in the shop', 60);
      await scoreProduct(t, await productOn(t, []), 'Sold everywhere', 60);
      await scoreProduct(t, await productOn(t, [sale]), 'Sale only', 100);
      await scoreProduct(t, await productOn(t, [shop, sale]), 'Sold in both', 60);

      const token = signToken(app, t);
      const titlesOn = async (id: string) => {
        const res = await app.inject({
          method: 'GET',
          url: '/v1/seo/audits',
          headers: { ...authHeader(token), 'x-sparx-property-id': id },
        });
        return (res.json().data as { title: string }[]).map((r) => r.title).sort();
      };

      expect(await titlesOn(shop), 'her shop').toEqual([
        'Sold everywhere',
        'Sold in both',
        'Sold in the shop',
      ]);
      // A product on SEVERAL sites belongs to each of them, which is exactly why
      // the pin cannot be one nullable column on the audit row.
      expect(await titlesOn(sale), 'her sample sale').toEqual([
        'Sale only',
        'Sold everywhere',
        'Sold in both',
      ]);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });

  it('moves the average, which is the number on the screen', async () => {
    // 60, 60, 60 on her shop. With the sale-only 100 wrongly included it is 70.
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableSeo(t.tenantId);
      const shop = t.propertyId;
      const sale = await createSite(t, 'Sample Sale');

      await scoreProduct(t, await productOn(t, [shop]), 'Sold in the shop', 60);
      await scoreProduct(t, await productOn(t, []), 'Sold everywhere', 60);
      await scoreProduct(t, await productOn(t, [sale]), 'Sale only', 100);
      await scoreProduct(t, await productOn(t, [shop, sale]), 'Sold in both', 60);

      const token = signToken(app, t);
      const res = await app.inject({
        method: 'GET',
        url: '/v1/seo/audits',
        headers: { ...authHeader(token), 'x-sparx-property-id': shop },
      });
      const rows = res.json().data as { score: number }[];
      expect(rows.reduce((sum, r) => sum + r.score, 0) / rows.length).toBe(60);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });

  it('counts the same pages behind the checklist and the activity feed', async () => {
    // Three reads, one screen. The checklist query used to carry its own copy of
    // the rule, so it went on counting the sale's stock after the list stopped.
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableSeo(t.tenantId);
      const shop = t.propertyId;
      const sale = await createSite(t, 'Sample Sale');

      await scoreProduct(t, await productOn(t, [shop]), 'Sold in the shop', 60);
      await scoreProduct(t, await productOn(t, [sale]), 'Sale only', 100);

      const token = signToken(app, t);
      const here = { ...authHeader(token), 'x-sparx-property-id': shop };

      const checklist = await app.inject({
        method: 'GET',
        url: '/v1/seo/reports/checklist',
        headers: here,
      });
      expect(checklist.json().data.summary.pagesScored, 'pages behind the checklist').toBe(1);

      const activity = await app.inject({
        method: 'GET',
        url: '/v1/seo/reports/activity',
        headers: here,
      });
      expect((activity.json().data as { title: string }[]).map((r) => r.title)).toEqual([
        'Sold in the shop',
      ]);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });
});

describe('the checklist speaks with one voice', () => {
  /** One audit row carrying one check, with the wording and date given. */
  async function card(
    t: TestTenant,
    opts: { label: string; category: string; status: string; computedAt: Date }
  ): Promise<void> {
    await withTenant({ tenantId: t.tenantId }, async (tx) => {
      await tx.seoAudit.create({
        data: {
          tenantId: t.tenantId,
          propertyId: t.propertyId,
          entityType: 'builder_page',
          entityId: crypto.randomUUID(),
          score: 50,
          grade: 'poor',
          title: 'A page',
          path: `/p-${crypto.randomUUID().slice(0, 8)}`,
          card: {
            checks: [
              {
                id: 'title-length',
                label: opts.label,
                category: opts.category,
                status: opts.status,
              },
            ],
          },
          computedAt: opts.computedAt,
        },
      });
    });
  }

  it('shows a reworded check once, in its newest wording, over every page', async () => {
    // A stored card keeps the words the checks had on the day that page was
    // scored, and a page is re-scored only when it is saved or scanned. So a
    // site holds cards from several versions of the rules at once, and grouping
    // on the WORDS split one check into two rows: the plain-English pass turned
    // thirteen checks into twenty-six, each counting only the pages that happen
    // to carry that wording.
    const t = await createTestTenant('owner');
    const app = await createApp();
    try {
      await enableSeo(t.tenantId);
      const old = new Date('2026-01-01T00:00:00.000Z');
      const recent = new Date('2026-09-01T00:00:00.000Z');
      await card(t, { label: 'Title length', category: 'meta', status: 'fail', computedAt: old });
      await card(t, {
        label: 'How long the title is',
        category: 'meta',
        status: 'pass',
        computedAt: recent,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/seo/reports/checklist',
        headers: { ...authHeader(signToken(app, t)), 'x-sparx-property-id': t.propertyId },
      });
      const checks = res.json().data.checks as {
        id: string;
        label: string;
        pagesScored: number;
        pagesPass: number;
        pagesFail: number;
      }[];

      const rows = checks.filter((c) => c.id === 'title-length');
      // Group on (id, label) instead and this is 2 — one row reading
      // "Title length, 1 of 1" above another reading "How long the title is,
      // 0 of 1", for a site with one check and two pages.
      expect(rows, 'one row per check, whatever it used to be called').toHaveLength(1);
      expect(rows[0]!.label, 'the wording the product uses today').toBe('How long the title is');
      expect(rows[0]!.pagesScored, 'every scored page, not just the recent ones').toBe(2);
      expect(rows[0]!.pagesPass).toBe(1);
      expect(rows[0]!.pagesFail).toBe(1);
    } finally {
      await app.close();
      await dropTestTenant(t.tenantId);
    }
  });
});
