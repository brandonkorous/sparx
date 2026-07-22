// The moderation TABLE reads — the server side the workbench reviews/questions
// tables lean on, exercised against real Postgres + RLS through the real HTTP
// routes: GET /v1/commerce/reviews and GET /v1/commerce/questions.
//   • each sorts on a server WHITELIST (reviews: createdAt/rating/status;
//     questions: createdAt/status) and rejects an off-list column with a 422
//     rather than interpolating it into an orderBy;
//   • each pages a status-filtered set with skip/take and reports a real total;
//   • each defaults to `createdAt desc` when no sort param is passed.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { invalidateModuleCache } from '@sparx/auth';
import { prisma, withTenant } from '@sparx/db';
import { createApp } from '../../src/app.js';
import {
  authHeader,
  signToken,
  createTestTenant,
  dropTestTenant,
  type TestTenant,
} from '../helpers.js';

async function enableCommerce(tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: { modules: { commerce: { enabled: true } } } },
  });
  invalidateModuleCache();
}

async function createProduct(t: TestTenant, handle: string): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const p = await tx.product.create({
      data: { tenantId: t.tenantId, title: 'Reviewable Widget', handle, status: 'active' },
      select: { id: true },
    });
    return p.id;
  });
}

async function seedReview(
  t: TestTenant,
  productId: string,
  opts: { rating: number; status: string; body: string; createdAt: Date }
): Promise<void> {
  await withTenant({ tenantId: t.tenantId }, (tx) =>
    tx.productReview.create({
      data: {
        tenantId: t.tenantId,
        productId,
        rating: opts.rating,
        title: '',
        body: opts.body,
        status: opts.status,
        createdAt: opts.createdAt,
      },
    })
  );
}

async function seedQuestion(
  t: TestTenant,
  productId: string,
  opts: { status: string; body: string; createdAt: Date }
): Promise<void> {
  await withTenant({ tenantId: t.tenantId }, (tx) =>
    tx.productQuestion.create({
      data: {
        tenantId: t.tenantId,
        productId,
        body: opts.body,
        status: opts.status,
        createdAt: opts.createdAt,
      },
    })
  );
}

describe('commerce moderation table lists — reviews', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sorts on the rating whitelist and rejects an off-list column', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const token = signToken(app, t);
      const productId = await createProduct(t, `widget-${Date.now()}-rev-sort`);

      const base = Date.now();
      // Ratings deliberately out of created order, so a rating sort can't be
      // mistaken for the default createdAt sort.
      await seedReview(t, productId, {
        rating: 3,
        status: 'pending',
        body: 'Three',
        createdAt: new Date(base - 3000),
      });
      await seedReview(t, productId, {
        rating: 5,
        status: 'pending',
        body: 'Five',
        createdAt: new Date(base - 2000),
      });
      await seedReview(t, productId, {
        rating: 1,
        status: 'pending',
        body: 'One',
        createdAt: new Date(base - 1000),
      });

      const byRating = await app.inject({
        method: 'GET',
        url: '/v1/commerce/reviews?sort_by=rating&order=asc',
        headers: authHeader(token),
      });
      expect(byRating.statusCode).toBe(200);
      expect((byRating.json().data as { rating: number }[]).map((r) => r.rating)).toEqual([
        1, 3, 5,
      ]);
      expect(byRating.json().meta.total).toBe(3);

      // No sort param → historic default of createdAt desc (newest first).
      const byDefault = await app.inject({
        method: 'GET',
        url: '/v1/commerce/reviews',
        headers: authHeader(token),
      });
      expect((byDefault.json().data as { body: string }[]).map((r) => r.body)).toEqual([
        'One',
        'Five',
        'Three',
      ]);

      // An off-whitelist column is rejected, never interpolated into the orderBy.
      const bad = await app.inject({
        method: 'GET',
        url: '/v1/commerce/reviews?sort_by=body;DROP',
        headers: authHeader(token),
      });
      expect(bad.statusCode).toBe(422);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('pages a status-filtered set with skip/take and a real total', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const token = signToken(app, t);
      const productId = await createProduct(t, `widget-${Date.now()}-rev-page`);

      const base = Date.now();
      // Three pending, two already approved — only the pending ones should page.
      for (let i = 0; i < 3; i++) {
        await seedReview(t, productId, {
          rating: 4,
          status: 'pending',
          body: `Pending ${String(i)}`,
          createdAt: new Date(base - i * 1000),
        });
      }
      for (let i = 0; i < 2; i++) {
        await seedReview(t, productId, {
          rating: 4,
          status: 'approved',
          body: `Approved ${String(i)}`,
          createdAt: new Date(base - (10 + i) * 1000),
        });
      }

      const first = await app.inject({
        method: 'GET',
        url: '/v1/commerce/reviews?status=pending&take=2&skip=0',
        headers: authHeader(token),
      });
      expect(first.statusCode).toBe(200);
      expect(first.json().meta.total).toBe(3);
      expect(first.json().data).toHaveLength(2);

      const second = await app.inject({
        method: 'GET',
        url: '/v1/commerce/reviews?status=pending&take=2&skip=2',
        headers: authHeader(token),
      });
      expect(second.json().meta.total).toBe(3);
      expect(second.json().data).toHaveLength(1);
      expect(
        (second.json().data as { status: string }[]).every((r) => r.status === 'pending')
      ).toBe(true);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});

describe('commerce moderation table lists — questions', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sorts on the createdAt whitelist and rejects an off-list column', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const token = signToken(app, t);
      const productId = await createProduct(t, `widget-${Date.now()}-q-sort`);

      const base = Date.now();
      await seedQuestion(t, productId, {
        status: 'pending',
        body: 'Oldest',
        createdAt: new Date(base - 3000),
      });
      await seedQuestion(t, productId, {
        status: 'pending',
        body: 'Middle',
        createdAt: new Date(base - 2000),
      });
      await seedQuestion(t, productId, {
        status: 'pending',
        body: 'Newest',
        createdAt: new Date(base - 1000),
      });

      const asc = await app.inject({
        method: 'GET',
        url: '/v1/commerce/questions?sort_by=createdAt&order=asc',
        headers: authHeader(token),
      });
      expect(asc.statusCode).toBe(200);
      expect((asc.json().data as { body: string }[]).map((r) => r.body)).toEqual([
        'Oldest',
        'Middle',
        'Newest',
      ]);
      expect(asc.json().meta.total).toBe(3);

      // `rating` is on the REVIEW whitelist, not the question one — must 422 here.
      const bad = await app.inject({
        method: 'GET',
        url: '/v1/commerce/questions?sort_by=rating',
        headers: authHeader(token),
      });
      expect(bad.statusCode).toBe(422);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('pages a status-filtered set with skip/take and a real total', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const token = signToken(app, t);
      const productId = await createProduct(t, `widget-${Date.now()}-q-page`);

      const base = Date.now();
      for (let i = 0; i < 3; i++) {
        await seedQuestion(t, productId, {
          status: 'pending',
          body: `Pending ${String(i)}`,
          createdAt: new Date(base - i * 1000),
        });
      }
      for (let i = 0; i < 2; i++) {
        await seedQuestion(t, productId, {
          status: 'published',
          body: `Published ${String(i)}`,
          createdAt: new Date(base - (10 + i) * 1000),
        });
      }

      const first = await app.inject({
        method: 'GET',
        url: '/v1/commerce/questions?status=pending&take=2&skip=0',
        headers: authHeader(token),
      });
      expect(first.statusCode).toBe(200);
      expect(first.json().meta.total).toBe(3);
      expect(first.json().data).toHaveLength(2);

      const second = await app.inject({
        method: 'GET',
        url: '/v1/commerce/questions?status=pending&take=2&skip=2',
        headers: authHeader(token),
      });
      expect(second.json().meta.total).toBe(3);
      expect(second.json().data).toHaveLength(1);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});
