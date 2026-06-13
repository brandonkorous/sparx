// Module toggle handlers — the dependency graph wired through the real routes.
//
// Pins the billing-critical behaviors of /v1/tenant/modules:
//   • REQUIRES: enabling B2B auto-enables (and so bills) Commerce; disabling
//     Commerce while B2B is on is blocked.
//   • BUNDLED_FREE: invoicing is "Included" (derived on, no flag) for any
//     B2B/Commerce tenant, and the gate (`requireInvoicingModule`) passes for
//     them without an explicit purchase.
//
// DB-backed (mirrors crm-routes.test.ts): provision a tenant, drive the routes
// with app.inject, assert the persisted + derived state.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { invalidateModuleCache } from '@sparx/auth';
import { createApp } from '../../src/app.js';
import { authHeader, signToken, createTestTenant, dropTestTenant } from '../helpers.js';

interface ModuleRow {
  slug: string;
  enabled: boolean;
  source: 'explicit' | 'bundled' | 'off';
  includedBy: string[];
  requiredBy: string[];
}

describe('tenant module toggles — dependency graph', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // The gate caches enable-state for 60s; reset so flips land immediately.
    invalidateModuleCache();
  });

  /** Look a module row up by slug, asserting it's present (the GET returns the
   *  full set, so a miss is a real failure — and this keeps strict index access
   *  happy without non-null assertions). */
  function pick(rows: ModuleRow[], slug: string): ModuleRow {
    const row = rows.find((r) => r.slug === slug);
    if (!row) throw new Error(`module "${slug}" missing from response`);
    return row;
  }

  async function getModules(token: string): Promise<ModuleRow[]> {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/tenant/modules',
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    return res.json().data as ModuleRow[];
  }

  async function patchModule(token: string, slug: string, enabled: boolean) {
    return app.inject({
      method: 'PATCH',
      url: `/v1/tenant/modules/${slug}`,
      headers: authHeader(token),
      payload: { enabled },
    });
  }

  it('enabling B2B auto-enables (bills) Commerce and bundles invoicing free', async () => {
    const t = await createTestTenant('owner');
    try {
      const token = signToken(app, t);

      const res = await patchModule(token, 'b2b', true);
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toMatchObject({ slug: 'b2b', enabled: true });

      const mods = await getModules(token);
      // B2B + its paid requirement Commerce are both explicitly on (billable).
      expect(pick(mods, 'b2b')).toMatchObject({ enabled: true, source: 'explicit' });
      expect(pick(mods, 'commerce')).toMatchObject({ enabled: true, source: 'explicit' });
      // Invoicing is Included — derived on with no flag of its own, never billed.
      expect(pick(mods, 'invoicing')).toMatchObject({ enabled: true, source: 'bundled' });
      expect(pick(mods, 'invoicing').includedBy).toEqual(
        expect.arrayContaining(['b2b', 'commerce'])
      );
      // Commerce is locked: B2B requires it.
      expect(pick(mods, 'commerce').requiredBy).toContain('b2b');
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('blocks disabling Commerce while B2B is on', async () => {
    const t = await createTestTenant('owner');
    try {
      const token = signToken(app, t);
      await patchModule(token, 'b2b', true);
      invalidateModuleCache();

      const res = await patchModule(token, 'commerce', false);
      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.message).toMatch(/b2b/);

      // Commerce stayed on.
      const mods = await getModules(token);
      expect(pick(mods, 'commerce').enabled).toBe(true);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('allows disabling Commerce once B2B is off', async () => {
    const t = await createTestTenant('owner');
    try {
      const token = signToken(app, t);
      await patchModule(token, 'b2b', true);
      invalidateModuleCache();
      await patchModule(token, 'b2b', false);
      invalidateModuleCache();

      const off = await patchModule(token, 'commerce', false);
      expect(off.statusCode).toBe(200);

      const mods = await getModules(token);
      expect(pick(mods, 'commerce').enabled).toBe(false);
      // With both providers off, invoicing falls back to off too.
      expect(pick(mods, 'invoicing')).toMatchObject({ enabled: false, source: 'off' });
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('a tenant with neither provider sees invoicing off (standalone purchase territory)', async () => {
    const t = await createTestTenant('owner');
    try {
      const token = signToken(app, t);
      const mods = await getModules(token);
      expect(pick(mods, 'invoicing')).toMatchObject({ enabled: false, source: 'off' });
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('the invoicing gate passes for a bundled B2B tenant (no explicit purchase)', async () => {
    const t = await createTestTenant('owner');
    try {
      const token = signToken(app, t);
      await patchModule(token, 'b2b', true);
      invalidateModuleCache();

      // requireInvoicingModule must NOT 404 — invoicing is derived-on via B2B.
      const res = await app.inject({
        method: 'GET',
        url: '/v1/invoicing/documents',
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(200);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('bulk PUT auto-adds Commerce when B2B is selected', async () => {
    const t = await createTestTenant('owner');
    try {
      const token = signToken(app, t);
      const res = await app.inject({
        method: 'PUT',
        url: '/v1/tenant/modules',
        headers: authHeader(token),
        payload: { modules: { b2b: true, cms: true } },
      });
      expect(res.statusCode).toBe(200);
      const rows = res.json().data as ModuleRow[];
      expect(pick(rows, 'b2b').enabled).toBe(true);
      expect(pick(rows, 'commerce').enabled).toBe(true); // auto-added requirement
      expect(pick(rows, 'invoicing').source).toBe('bundled');
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});
