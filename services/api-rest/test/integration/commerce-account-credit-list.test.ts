// Account-credit balances list read — the server side the workbench balances
// table leans on, exercised against real Postgres + RLS through the real HTTP
// route: GET /v1/commerce/account-credit.
//   • sorts on a server WHITELIST (customer name via the relation, balance,
//     updatedAt) and rejects an off-list column with a 422 rather than
//     interpolating it into an orderBy;
//   • pages with skip/take and reports a real total for the pager;
//   • defaults to `balanceCents desc` when no sort param is passed.

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

/** A customer holding `balanceCents` of store credit, in USD. */
async function seedCredit(
  t: TestTenant,
  opts: { firstName: string; lastName: string; email: string; balanceCents: number }
): Promise<void> {
  await withTenant({ tenantId: t.tenantId }, async (tx) => {
    const customer = await tx.customer.create({
      data: {
        tenantId: t.tenantId,
        firstName: opts.firstName,
        lastName: opts.lastName,
        email: opts.email,
      },
      select: { id: true },
    });
    await tx.accountCredit.create({
      data: {
        tenantId: t.tenantId,
        customerId: customer.id,
        currency: 'USD',
        balanceCents: opts.balanceCents,
      },
    });
  });
}

describe('commerce account-credit balances list', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sorts on the customer name whitelist and rejects an off-list column', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const token = signToken(app, t);
      // Balances deliberately DON'T match name order, so a name sort can't be
      // mistaken for the default balance sort.
      await seedCredit(t, {
        firstName: 'Zoe',
        lastName: 'Zimmer',
        email: 'zoe@example.test',
        balanceCents: 100,
      });
      await seedCredit(t, {
        firstName: 'Ada',
        lastName: 'Adams',
        email: 'ada@example.test',
        balanceCents: 900,
      });
      await seedCredit(t, {
        firstName: 'Mel',
        lastName: 'Mbeki',
        email: 'mel@example.test',
        balanceCents: 500,
      });

      const byName = await app.inject({
        method: 'GET',
        url: '/v1/commerce/account-credit?sort_by=lastName&order=asc',
        headers: authHeader(token),
      });
      expect(byName.statusCode).toBe(200);
      expect(
        (byName.json().data as { customer: { lastName: string } | null }[]).map(
          (r) => r.customer?.lastName
        )
      ).toEqual(['Adams', 'Mbeki', 'Zimmer']);
      expect(byName.json().meta.total).toBe(3);

      // An off-whitelist column is rejected, never interpolated into the orderBy.
      const bad = await app.inject({
        method: 'GET',
        url: '/v1/commerce/account-credit?sort_by=customerId;DROP',
        headers: authHeader(token),
      });
      expect(bad.statusCode).toBe(422);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('pages with skip/take and a real total, defaulting to balance descending', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const token = signToken(app, t);
      // Five balances, ascending, so a default (balance-desc) sort is unambiguous.
      await seedCredit(t, {
        firstName: 'A',
        lastName: 'One',
        email: 'a@example.test',
        balanceCents: 100,
      });
      await seedCredit(t, {
        firstName: 'B',
        lastName: 'Two',
        email: 'b@example.test',
        balanceCents: 200,
      });
      await seedCredit(t, {
        firstName: 'C',
        lastName: 'Three',
        email: 'c@example.test',
        balanceCents: 300,
      });
      await seedCredit(t, {
        firstName: 'D',
        lastName: 'Four',
        email: 'd@example.test',
        balanceCents: 400,
      });
      await seedCredit(t, {
        firstName: 'E',
        lastName: 'Five',
        email: 'e@example.test',
        balanceCents: 500,
      });

      // No sort param → historic default of balanceCents desc, first window of two.
      const first = await app.inject({
        method: 'GET',
        url: '/v1/commerce/account-credit?take=2&skip=0',
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
        url: '/v1/commerce/account-credit?take=2&skip=2',
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
});
