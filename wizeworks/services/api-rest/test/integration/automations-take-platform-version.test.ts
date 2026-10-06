// POST /v1/automations/:id/take-platform-version, through the real Fastify app.
//
// A seeded rule the business changed keeps their version on every re-sync, and
// the platform's newer one waits beside it. This route switches to it. Gated like
// its neighbors: an editor writes, a viewer cannot, and there is no module gate
// (automations are a platform capability, so a tenant with no modules on reaches
// it). The refusals are a 409 that says why, in a sentence the console prints.

import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  publishAutomation,
  updateAutomation,
  upsertSystemAutomation,
  type SystemAutomationSpec,
} from '@wizeworks/automation';
import { createApp } from '../../src/app.js';
import {
  authHeader,
  createTestTenant,
  dropTestTenant,
  signToken,
  type TestTenant,
} from '../helpers.js';

const EVENT_TRIGGER = { kind: 'event' as const, eventType: 'crm.customer.created' };
const STOP_ACTION = { type: 'platform.stop' as const, config: { reason: 'test' } };

const SEED: SystemAutomationSpec = {
  key: 'test.route-take-welcome',
  name: 'Welcome new customers',
  description: 'Say hello',
  trigger: EVENT_TRIGGER,
  conditions: { logic: 'AND', conditions: [] },
  actions: [STOP_ACTION],
  status: 'active',
};
const SEED_V2: SystemAutomationSpec = { ...SEED, description: 'Say hello, better' };

describe('take-platform-version route', () => {
  let app: FastifyInstance;
  const tenants: string[] = [];

  async function tenant(role: Parameters<typeof createTestTenant>[0] = 'owner') {
    const t = await createTestTenant(role);
    tenants.push(t.tenantId);
    return t;
  }

  /** The tenant's copy of SEED, reworded by them, with SEED_V2 held back. */
  async function heldBack(t: TestTenant): Promise<string> {
    const ctx = { tenantId: t.tenantId };
    const row = await upsertSystemAutomation(ctx, SEED);
    await updateAutomation(ctx, row.id, { description: 'Our own hello' });
    await publishAutomation(ctx, row.id);
    await upsertSystemAutomation(ctx, SEED_V2);
    return row.id;
  }

  function take(id: string, token?: string) {
    return app.inject({
      method: 'POST',
      url: `/v1/automations/${id}/take-platform-version`,
      ...(token ? { headers: authHeader(token) } : {}),
    });
  }

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    for (const id of tenants) await dropTestTenant(id).catch(() => undefined);
  });

  it('switches the rule for an editor on a tenant with no modules on', async () => {
    const t = await tenant('editor');
    const id = await heldBack(t);

    const before = await app.inject({
      method: 'GET',
      url: `/v1/automations/${id}`,
      headers: authHeader(signToken(app, t, 'editor')),
    });
    expect(before.json().data.platformDocument).toMatchObject({ description: 'Say hello, better' });

    const res = await take(id, signToken(app, t, 'editor'));
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({
      description: 'Say hello, better',
      name: 'Welcome new customers',
      status: 'active',
      platformUpdateAt: null,
      platformDocument: null,
    });
  });

  it('is closed to a viewer and to no one at all', async () => {
    const t = await tenant('viewer');
    const id = await heldBack(t);
    const viewer = await take(id, signToken(app, t, 'viewer'));
    expect(viewer.statusCode).toBe(403);
    expect((await take(id)).statusCode).toBe(401);
  });

  it('answers 409 with the reason for a rule the business made', async () => {
    const t = await tenant();
    const token = signToken(app, t);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/automations',
      headers: authHeader(token),
      payload: { name: 'Mine', trigger: EVENT_TRIGGER, actions: [STOP_ACTION] },
    });
    const mine = created.json<{ data: { id: string } }>().data;
    const res = await take(mine.id, token);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('AUTOMATION_PLATFORM_VERSION_UNAVAILABLE');
    expect(res.json().error.details.reason).toBe('not-seeded');
    expect(res.json().error.message).toMatch(/not set up for you/);
  });

  it('answers 409 "up-to-date" once taken, and 404 for a rule that does not exist', async () => {
    const t = await tenant();
    const token = signToken(app, t);
    const id = await heldBack(t);
    expect((await take(id, token)).statusCode).toBe(200);
    const again = await take(id, token);
    expect(again.statusCode).toBe(409);
    expect(again.json().error.details.reason).toBe('up-to-date');

    const missing = await take(crypto.randomUUID(), token);
    expect(missing.statusCode).toBe(404);
  });
});
