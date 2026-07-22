// The inbox has to survive a busy account.
//
// These lock the failure that motivated the paging work. The bell lists rows and
// the badge counts them, and those were two different queries: the list was the
// newest N, the count was every unread row. On an account taking ~20 notices an
// hour a 30-row window covers about ninety minutes, so after a night the badge
// read "9+" while the panel showed the last hour and a half — and with no other
// view of them, the older unread rows were unreachable from the app entirely.
//
// So the properties worth holding are:
//   • `state=unread` never returns a read row, so the bell cannot contradict its
//     own badge;
//   • `unreadCount` stays absolute regardless of window or filter — it drives
//     the badge, which must not change meaning based on what is on screen;
//   • `before` walks strictly older with no repeats and no gaps, which is what
//     makes the whole backlog reachable a window at a time.
//
// Real Postgres, real RLS; fixtures clean up via tenant cascade.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { withTenant } from '@sparx/db';
import { createApp } from '../../src/app.js';
import {
  type TestTenant,
  authHeader,
  createTestTenant,
  dropTestTenant,
  signToken,
} from '../helpers.js';

/** Twelve hours at twenty an hour — a single overnight backlog. */
const TOTAL = 240;
/** How many of them have been dealt with, scattered through the run. */
const READ_EVERY = 4;

describe('GET /v1/notifications — paging a busy inbox', () => {
  let app: FastifyInstance;
  let tenant: TestTenant;
  let token: string;

  beforeAll(async () => {
    app = await createApp();
    tenant = await createTestTenant('owner');
    token = signToken(app, tenant);

    // One per row so createdAt is strictly decreasing and the keyset walk is
    // deterministic — ties on the cursor column are the one thing that could
    // legitimately drop or repeat a row.
    const base = Date.UTC(2026, 6, 1, 0, 0, 0);
    await withTenant({ tenantId: tenant.tenantId }, (tx) =>
      tx.notification.createMany({
        data: Array.from({ length: TOTAL }, (_, index) => ({
          tenantId: tenant.tenantId,
          userId: tenant.userId,
          kind: 'order.placed',
          title: `Order #${String(1000 + index)} came in`,
          module: index % 2 === 0 ? 'commerce' : 'invoicing',
          severity: 'info',
          createdAt: new Date(base + index * 60_000),
          readAt: index % READ_EVERY === 0 ? new Date(base) : null,
        })),
      })
    );
  });

  afterAll(async () => {
    await app.close();
    await dropTestTenant(tenant.tenantId);
  });

  function list(query: Record<string, string | number>) {
    const qs = new URLSearchParams(
      Object.entries(query).map(([key, value]) => [key, String(value)])
    );
    return app
      .inject({
        method: 'GET',
        url: `/v1/notifications?${qs.toString()}`,
        headers: authHeader(token),
      })
      .then((res) => {
        expect(res.statusCode).toBe(200);
        return res.json().data as {
          items: { id: string; createdAt: string; readAt: string | null; module: string | null }[];
          unreadCount: number;
        };
      });
  }

  const EXPECTED_UNREAD = TOTAL - Math.ceil(TOTAL / READ_EVERY);

  it('counts every unread row, not just the ones in the window', async () => {
    const page = await list({ state: 'unread', limit: 10 });
    expect(page.items).toHaveLength(10);
    // The whole point: the badge is absolute, the window is not.
    expect(page.unreadCount).toBe(EXPECTED_UNREAD);
    expect(page.unreadCount).toBeGreaterThan(page.items.length);
  });

  it('never returns a read row under state=unread, so the bell cannot contradict its badge', async () => {
    const page = await list({ state: 'unread', limit: 100 });
    expect(page.items).toHaveLength(100);
    expect(page.items.every((item) => item.readAt === null)).toBe(true);
  });

  it('keeps unreadCount absolute even when a filter narrows the list', async () => {
    const page = await list({ state: 'all', module: 'commerce', limit: 10 });
    expect(page.items.every((item) => item.module === 'commerce')).toBe(true);
    // Narrowing what is SHOWN must not change what the badge MEANS.
    expect(page.unreadCount).toBe(EXPECTED_UNREAD);
  });

  it('walks the whole backlog by cursor with no repeats and no gaps', async () => {
    const seen: string[] = [];
    let before: string | undefined;

    // Deliberately more rounds than needed, to prove it terminates rather than
    // looping on a boundary row.
    for (let round = 0; round < 20; round += 1) {
      const page: { items: { id: string; createdAt: string }[] } = await list({
        state: 'all',
        limit: 25,
        ...(before ? { before } : {}),
      });
      if (page.items.length === 0) break;
      seen.push(...page.items.map((item) => item.id));
      before = page.items[page.items.length - 1]!.createdAt;
    }

    expect(seen).toHaveLength(TOTAL);
    // No repeats — the failure offset paging produces once rows arrive mid-read.
    expect(new Set(seen).size).toBe(TOTAL);
  });

  it('returns rows newest-first and strictly older than the cursor', async () => {
    const first = await list({ state: 'all', limit: 25 });
    const times = first.items.map((item) => Date.parse(item.createdAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);

    const cursor = first.items[first.items.length - 1]!.createdAt;
    const second = await list({ state: 'all', limit: 25, before: cursor });
    expect(second.items.every((item) => Date.parse(item.createdAt) < Date.parse(cursor))).toBe(
      true
    );
  });

  it('rejects a malformed cursor rather than silently ignoring it', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/notifications?before=not-a-date',
      headers: authHeader(token),
    });
    // Silently dropping it would serve the NEWEST window to a reader who asked
    // for an older one — the same row shown twice, looking like a paging bug.
    // 422, not 400: this platform returns Zod validation failures as 422 (see
    // envelope.test.ts), and the point of the assertion is that it REJECTS.
    expect(res.statusCode).toBe(422);
  });
});
