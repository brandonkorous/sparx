// Product reviews end-to-end (the "reviews aren't working" bug). Three defects
// fixed, pinned here against real Postgres + RLS through the real HTTP routes:
//   • the product rating aggregate (averageRating / reviewCount) is recomputed
//     whenever the APPROVED set changes — so an approved review actually shows
//     up on the PDP instead of "no reviews yet" forever;
//   • a guest review submits WITHOUT a title (title is optional), and the
//     author's name is persisted as the review's display name;
//   • the public list endpoint returns only APPROVED reviews + the live summary.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { invalidateModuleCache } from '@sparx/auth';
import { reviewService } from '@sparx/commerce';
import { prisma, withTenant } from '@sparx/db';
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
});
