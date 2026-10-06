// The release re-syncs system automations through the SAME reconcile the daily
// CronJob runs, with `?only=seeds`.
//
// A release that changed a seed used to reach tenants only at 02:07 the next
// night: until then the business got a task for an order only the buyer's
// approver should sign, and the approver got no email. The release now calls
// this route once its containers are up. What is pinned here:
//
//   1. `?only=seeds` runs the seed reconcile and NOT the campaign scan, which
//      stays on its daily clock.
//   2. The daily call, with no query, still runs both.
//   3. The answer is the reconcile's own summary, which the release prints.
//   4. Nobody without the cron token gets in.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
const SUMMARY = {
  modules: [{ module: 'b2b', tenants: 3, seeded: 27, skipped: 0 }],
  tenantsSeeded: 3,
  tenantsSkipped: 0,
};

vi.mock('./runtime.js', () => ({
  reconcileSeeds: () => {
    calls.push('seeds');
    return Promise.resolve(SUMMARY);
  },
  scanCampaigns: () => {
    calls.push('campaigns');
    return Promise.resolve({ tenants: 1, entered: 0, failed: 0 });
  },
  runTick: () => Promise.resolve({}),
  ingest: () => Promise.resolve(),
}));

const { handleReconcileRequest } = await import('./server.js');

function call(url: string, token = process.env.SPARX_INTERNAL_CRON_TOKEN) {
  const req = {
    url,
    method: 'POST',
    headers: token ? { 'x-sparx-internal-cron-token': token } : {},
  } as unknown as IncomingMessage;
  const out = { status: 0, body: '' };
  const res = {
    set statusCode(code: number) {
      out.status = code;
    },
    setHeader: () => undefined,
    end: (body?: string) => {
      out.body = body ?? '';
    },
  } as unknown as ServerResponse;
  return handleReconcileRequest(req, res).then(() => out);
}

beforeEach(() => {
  calls.length = 0;
});

describe('the reconcile route', () => {
  it('re-syncs only the seeds when the release asks', async () => {
    const out = await call('/internal/cron/reconcile-seeds?only=seeds');
    expect(out.status).toBe(200);
    expect(calls).toEqual(['seeds']);
    expect(JSON.parse(out.body)).toEqual(SUMMARY);
  });

  it('still runs the campaign scan on the daily call', async () => {
    const out = await call('/internal/cron/reconcile-seeds');
    expect(out.status).toBe(200);
    expect(calls).toEqual(['seeds', 'campaigns']);
    expect(JSON.parse(out.body)).toMatchObject({ ...SUMMARY, campaigns: { tenants: 1 } });
  });

  it('refuses a caller without the cron token', async () => {
    const out = await call('/internal/cron/reconcile-seeds?only=seeds', '');
    expect(out.status).toBe(403);
    expect(calls).toEqual([]);
  });
});
