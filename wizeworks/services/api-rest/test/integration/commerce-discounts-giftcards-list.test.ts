// Discounts + gift-cards list reads — the server side the workbench tables lean
// on, exercised against real Postgres + RLS through the real HTTP routes:
//   • GET /v1/commerce/discounts — sorts on a server WHITELIST and rejects an
//     off-list column rather than interpolating it;
//   • GET /v1/commerce/gift-cards — the paging upgrade: skip/take with a real
//     total (it used to return a bare array with only `take`), a sort whitelist,
//     and the same off-list rejection.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { invalidateModuleCache } from '@wizeworks/auth';
import { prisma, withTenant } from '@wizeworks/db';
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

async function seedDiscount(
  t: TestTenant,
  opts: {
    name: string;
    code?: string | null;
    type?: string;
    valueCents?: number | null;
    valuePercent?: number | null;
    status?: string;
  }
): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const row = await tx.discount.create({
      data: {
        tenantId: t.tenantId,
        name: opts.name,
        code: opts.code ?? null,
        type: opts.type ?? 'percent',
        valueCents: opts.valueCents ?? null,
        valuePercent: opts.valuePercent ?? null,
        status: opts.status ?? 'active',
      },
      select: { id: true },
    });
    return row.id;
  });
}

async function seedGiftCard(
  t: TestTenant,
  opts: { code: string; balanceCents: number; status?: string; recipientName?: string }
): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const row = await tx.giftCard.create({
      data: {
        tenantId: t.tenantId,
        code: opts.code,
        initialBalanceCents: opts.balanceCents,
        balanceCents: opts.balanceCents,
        currency: 'USD',
        status: opts.status ?? 'active',
        recipientName: opts.recipientName ?? null,
      },
      select: { id: true },
    });
    return row.id;
  });
}

describe('commerce discounts + gift cards list', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sorts discounts on the whitelist and rejects an off-list column', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const token = signToken(app, t);
      await seedDiscount(t, { name: 'Zebra sale', code: 'ZEBRA', valuePercent: 10 });
      await seedDiscount(t, { name: 'Apple sale', code: 'APPLE', valuePercent: 20 });
      await seedDiscount(t, { name: 'Mango sale', code: null, valuePercent: 15 });

      const byName = await app.inject({
        method: 'GET',
        url: '/v1/commerce/discounts?sort_by=name&order=asc',
        headers: authHeader(token),
      });
      expect(byName.statusCode).toBe(200);
      expect((byName.json().data as { name: string }[]).map((r) => r.name)).toEqual([
        'Apple sale',
        'Mango sale',
        'Zebra sale',
      ]);
      // The list reports a real total for the pager.
      expect(byName.json().meta.total).toBe(3);

      // An off-whitelist column is rejected, never interpolated into the orderBy.
      const bad = await app.inject({
        method: 'GET',
        url: '/v1/commerce/discounts?sort_by=priority;DROP',
        headers: authHeader(token),
      });
      expect(bad.statusCode).toBe(422);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('pages gift cards with skip/take and a real total', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const token = signToken(app, t);
      // Five cards, ascending balances so a balance sort is unambiguous.
      await seedGiftCard(t, { code: 'GC-100', balanceCents: 100 });
      await seedGiftCard(t, { code: 'GC-200', balanceCents: 200 });
      await seedGiftCard(t, { code: 'GC-300', balanceCents: 300 });
      await seedGiftCard(t, { code: 'GC-400', balanceCents: 400 });
      await seedGiftCard(t, { code: 'GC-500', balanceCents: 500 });

      // First window of two, sorted by balance descending.
      const first = await app.inject({
        method: 'GET',
        url: '/v1/commerce/gift-cards?sort_by=balanceCents&order=desc&take=2&skip=0',
        headers: authHeader(token),
      });
      expect(first.statusCode).toBe(200);
      expect(first.json().meta.total).toBe(5);
      expect((first.json().data as { balanceCents: number }[]).map((r) => r.balanceCents)).toEqual([
        500, 400,
      ]);

      // Next window continues where the first left off — no overlap, same total.
      const second = await app.inject({
        method: 'GET',
        url: '/v1/commerce/gift-cards?sort_by=balanceCents&order=desc&take=2&skip=2',
        headers: authHeader(token),
      });
      expect(second.json().meta.total).toBe(5);
      expect((second.json().data as { balanceCents: number }[]).map((r) => r.balanceCents)).toEqual(
        [300, 200]
      );
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('searches gift cards and rejects an off-list sort column', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const token = signToken(app, t);
      await seedGiftCard(t, { code: 'GIFT-AAA', balanceCents: 100, recipientName: 'Ada Byron' });
      await seedGiftCard(t, { code: 'GIFT-BBB', balanceCents: 200, recipientName: 'Grace Hopper' });

      // Recipient-name search (case-insensitive contains).
      const search = await app.inject({
        method: 'GET',
        url: '/v1/commerce/gift-cards?q=grace',
        headers: authHeader(token),
      });
      expect(search.statusCode).toBe(200);
      expect((search.json().data as { code: string }[]).map((r) => r.code)).toEqual(['GIFT-BBB']);
      expect(search.json().meta.total).toBe(1);

      // Off-list sort column rejected.
      const bad = await app.inject({
        method: 'GET',
        url: '/v1/commerce/gift-cards?sort_by=recipientEmail',
        headers: authHeader(token),
      });
      expect(bad.statusCode).toBe(422);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});
