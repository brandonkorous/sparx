// Product reviews end-to-end (the "reviews aren't working" bug). Three defects
// fixed, pinned here against real Postgres + RLS through the real HTTP routes:
//   • the product rating aggregate (averageRating / reviewCount) is recomputed
//     whenever the APPROVED set changes — so an approved review actually shows
//     up on the PDP instead of "no reviews yet" forever;
//   • a guest review submits WITHOUT a title (title is optional), and the
//     author's name is persisted as the review's display name;
//   • the public list endpoint returns only APPROVED reviews + the live summary.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { invalidateModuleCache } from '@wizeworks/auth';
import { reviewService } from '@wizeworks/commerce';
import { prisma, withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import { createTestTenant, dropTestTenant, type TestTenant } from '../helpers.js';

async function enableCommerce(tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: { modules: { commerce: { enabled: true } } } },
  });
  invalidateModuleCache();
}

async function tenantSlug(tenantId: string): Promise<string> {
  const row = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { slug: true },
  });
  return row.slug;
}

async function createActiveProduct(t: TestTenant, handle: string): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const p = await tx.product.create({
      data: { tenantId: t.tenantId, title: 'Reviewable Widget', handle, status: 'active' },
      select: { id: true },
    });
    return p.id;
  });
}

function productAggregate(t: TestTenant, productId: string) {
  return withTenant({ tenantId: t.tenantId }, (tx) =>
    tx.product.findUniqueOrThrow({
      where: { id: productId },
      select: { reviewCount: true, averageRating: true },
    })
  );
}

/** A second site under the tenant (`properties` is FORCE RLS, so tenant-scoped). */
async function createSite(t: TestTenant, name: string): Promise<{ id: string; slug: string }> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
    const row = await tx.property.create({
      data: { tenantId: t.tenantId, slug, name, isPrimary: false },
      select: { id: true, slug: true },
    });
    return row;
  });
}

async function propertySlug(t: TestTenant, propertyId: string): Promise<string> {
  const row = await withTenant({ tenantId: t.tenantId }, (tx) =>
    tx.property.findUniqueOrThrow({ where: { id: propertyId }, select: { slug: true } })
  );
  return row.slug;
}

/** Seed a review already stamped to a site (or the null shared bucket), pending.
 *  Created directly so the propertyId is exactly what the test dictates rather
 *  than whatever the public form resolves — the site attribution IS the thing
 *  under test. */
async function seedReview(
  t: TestTenant,
  productId: string,
  propertyId: string | null,
  rating: number
): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const r = await tx.productReview.create({
      data: {
        tenantId: t.tenantId,
        productId,
        propertyId,
        rating,
        title: '',
        body: 'A review body.',
        status: 'pending',
      },
      select: { id: true },
    });
    return r.id;
  });
}

/** The public PDP's rating fields for one site (docs/131 §4). */
async function pdpRating(
  app: FastifyInstance,
  handle: string,
  tenantSlugValue: string,
  siteSlug?: string
): Promise<{ averageRating: number | null; reviewCount: number }> {
  const q = `tenant=${tenantSlugValue}${siteSlug ? `&property=${siteSlug}` : ''}`;
  const res = await app.inject({
    method: 'GET',
    url: `/v1/public/commerce/products/${handle}?${q}`,
  });
  expect(res.statusCode).toBe(200);
  const data = res.json().data;
  return { averageRating: data.averageRating, reviewCount: data.reviewCount };
}

describe('product reviews — submit, moderate, aggregate, public list', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('guest review submits titleless, stays hidden until approved, then rolls up', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const slug = await tenantSlug(t.tenantId);
      const handle = `widget-${Date.now()}`;
      const productId = await createActiveProduct(t, handle);
      const ctx = { tenantId: t.tenantId, userId: t.userId };

      // Submit a guest review with NO title and NO email — both optional now.
      const submitRes = await app.inject({
        method: 'POST',
        url: `/v1/public/commerce/products/${handle}/reviews?tenant=${slug}`,
        payload: { rating: 5, authorName: 'Alex P.', body: 'Great quality, fast shipping.' },
      });
      expect(submitRes.statusCode).toBe(200);
      const reviewId = submitRes.json().data.reviewId as string;
      expect(submitRes.json().data.status).toBe('pending');

      // Persisted: author name → displayName, title → '' (not null).
      const stored = await withTenant({ tenantId: t.tenantId }, (tx) =>
        tx.productReview.findUniqueOrThrow({
          where: { id: reviewId },
          select: { displayName: true, title: true, status: true },
        })
      );
      expect(stored.displayName).toBe('Alex P.');
      expect(stored.title).toBe('');

      // Pending → not on the storefront, aggregate still zero.
      const beforeList = await app.inject({
        method: 'GET',
        url: `/v1/public/commerce/products/${handle}/reviews?tenant=${slug}`,
      });
      expect(beforeList.json().data.items).toHaveLength(0);
      expect(beforeList.json().data.summary.total).toBe(0);
      expect(await productAggregate(t, productId)).toMatchObject({
        reviewCount: 0,
        averageRating: null,
      });

      // Approve it — the aggregate must roll up and the review must appear.
      await reviewService.moderate(ctx, { reviewId, status: 'approved' });

      expect(await productAggregate(t, productId)).toMatchObject({
        reviewCount: 1,
        averageRating: 5,
      });
      const afterList = await app.inject({
        method: 'GET',
        url: `/v1/public/commerce/products/${handle}/reviews?tenant=${slug}`,
      });
      const data = afterList.json().data;
      expect(data.summary).toMatchObject({ total: 1, averageRating: 5 });
      expect(data.items).toHaveLength(1);
      expect(data.items[0]).toMatchObject({
        author: 'Alex P.',
        rating: 5,
        title: '',
        verifiedPurchase: false,
      });

      // Un-approve — drops back out of the rollup and the storefront list.
      await reviewService.moderate(ctx, { reviewId, status: 'rejected' });
      expect(await productAggregate(t, productId)).toMatchObject({
        reviewCount: 0,
        averageRating: null,
      });
      const goneList = await app.inject({
        method: 'GET',
        url: `/v1/public/commerce/products/${handle}/reviews?tenant=${slug}`,
      });
      expect(goneList.json().data.items).toHaveLength(0);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('averages multiple approved reviews and recomputes on delete', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const slug = await tenantSlug(t.tenantId);
      const handle = `widget-${Date.now()}-multi`;
      const productId = await createActiveProduct(t, handle);
      const ctx = { tenantId: t.tenantId, userId: t.userId };

      const submit = async (rating: number, name: string) => {
        const res = await app.inject({
          method: 'POST',
          url: `/v1/public/commerce/products/${handle}/reviews?tenant=${slug}`,
          payload: { rating, authorName: name, title: `${rating} stars`, body: 'A review body.' },
        });
        expect(res.statusCode).toBe(200);
        return res.json().data.reviewId as string;
      };

      const id5 = await submit(5, 'Alex');
      const id3 = await submit(3, 'Riley');
      await reviewService.moderate(ctx, { reviewId: id5, status: 'approved' });
      await reviewService.moderate(ctx, { reviewId: id3, status: 'approved' });

      // (5 + 3) / 2 = 4
      expect(await productAggregate(t, productId)).toMatchObject({
        reviewCount: 2,
        averageRating: 4,
      });

      // Deleting the 3-star approved review leaves just the 5-star.
      await reviewService.deleteReview(ctx, id3);
      expect(await productAggregate(t, productId)).toMatchObject({
        reviewCount: 1,
        averageRating: 5,
      });
      const list = await app.inject({
        method: 'GET',
        url: `/v1/public/commerce/products/${handle}/reviews?tenant=${slug}`,
      });
      expect(list.json().data.items).toHaveLength(1);
      expect(list.json().data.items[0]).toMatchObject({ rating: 5, title: '5 stars' });
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('Q&A lifecycle: submit → publish → answer surfaces on the storefront', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const slug = await tenantSlug(t.tenantId);
      const handle = `widget-${Date.now()}-qa`;
      const productId = await createActiveProduct(t, handle);
      const ctx = { tenantId: t.tenantId, userId: t.userId };

      // Guest asks a question via the public form endpoint.
      const ask = await app.inject({
        method: 'POST',
        url: `/v1/public/commerce/products/${handle}/questions?tenant=${slug}`,
        payload: { displayName: 'Dana W.', body: 'Does this fit the older model?' },
      });
      expect(ask.statusCode).toBe(200);
      const questionId = ask.json().data.questionId as string;

      // Pending → not visible on the storefront yet.
      const pending = await app.inject({
        method: 'GET',
        url: `/v1/public/commerce/products/${handle}/questions?tenant=${slug}`,
      });
      expect(pending.json().data).toHaveLength(0);

      // Publish + answer (these emit question.published / question.answered,
      // which would throw if the topics weren't wired into CommerceTopic).
      await reviewService.moderateQuestion(ctx, { questionId, status: 'published' });
      await reviewService.submitAnswer(ctx, {
        questionId,
        body: 'Yes — it fits both the older and 2024 models.',
        isOfficial: true,
      });

      const published = await app.inject({
        method: 'GET',
        url: `/v1/public/commerce/products/${handle}/questions?tenant=${slug}`,
      });
      const data = published.json().data;
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        body: 'Does this fit the older model?',
        displayName: 'Dana W.',
      });
      expect(data[0].answers).toHaveLength(1);
      expect(data[0].answers[0]).toMatchObject({ isOfficial: true });
      expect(productId).toBeTruthy();
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  // docs/131 §4 — the per-site rating rollup. One product listed on TWO of a
  // tenant's businesses, reviewed differently on each. The PDP star average must
  // be the average of THAT site's reviews (plus the shared/legacy null bucket),
  // never the tenant-wide blend across sibling businesses — the exact leak the
  // ProductReviewRollup table closes. The tenant-wide product.average_rating is
  // deliberately the "wrong answer" here (3), so an assertion of the per-site
  // figure fails the moment the read path reverts to reading the column.
  it('PDP shows each site its own rating, shared null bucket counts on both', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const tSlug = await tenantSlug(t.tenantId);
      const handle = `widget-${Date.now()}-persite`;
      const productId = await createActiveProduct(t, handle);
      const ctx = { tenantId: t.tenantId, userId: t.userId };

      // Primary = Bob's Parts (seeded by createTestTenant); add Savory Donuts.
      const partsSlug = await propertySlug(t, t.propertyId);
      const donuts = await createSite(t, 'Savory Donuts');

      // 5★ on Parts, 1★ on Donuts, and a 3★ legacy review with no site (the
      // shared bucket every storefront counts). Tenant-wide blend = (5+1+3)/3 = 3.
      const idParts = await seedReview(t, productId, t.propertyId, 5);
      const idDonuts = await seedReview(t, productId, donuts.id, 1);
      const idLegacy = await seedReview(t, productId, null, 3);
      await reviewService.moderate(ctx, { reviewId: idParts, status: 'approved' });
      await reviewService.moderate(ctx, { reviewId: idDonuts, status: 'approved' });
      await reviewService.moderate(ctx, { reviewId: idLegacy, status: 'approved' });

      // Tenant-wide column is the blend — the value the PDP must NOT show per-site.
      expect(await productAggregate(t, productId)).toMatchObject({
        reviewCount: 3,
        averageRating: 3,
      });

      // Parts sees its own 5★ + the shared 3★ → (5+3)/2 = 4 over 2 reviews.
      expect(await pdpRating(app, handle, tSlug, partsSlug)).toEqual({
        averageRating: 4,
        reviewCount: 2,
      });
      // The primary-site default (no ?property) resolves to Parts — same figure.
      expect(await pdpRating(app, handle, tSlug)).toEqual({
        averageRating: 4,
        reviewCount: 2,
      });
      // Donuts sees its own 1★ + the shared 3★ → (1+3)/2 = 2 over 2 reviews.
      expect(await pdpRating(app, handle, tSlug, donuts.slug)).toEqual({
        averageRating: 2,
        reviewCount: 2,
      });

      // Deleting the Donuts review drops Donuts to just the shared 3★; Parts is
      // untouched — the rollup is rewritten per (product, site), not globally.
      await reviewService.deleteReview(ctx, idDonuts);
      expect(await pdpRating(app, handle, tSlug, donuts.slug)).toEqual({
        averageRating: 3,
        reviewCount: 1,
      });
      expect(await pdpRating(app, handle, tSlug, partsSlug)).toEqual({
        averageRating: 4,
        reviewCount: 2,
      });
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});
