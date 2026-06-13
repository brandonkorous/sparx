// Per-site email: provisioning + the site override join, end-to-end on the real
// routes (docs/49 Phase 7b, docs/91 §6, §7). Proves:
//   1. Activating the `email` module provisions the 13 keyed, tenant-wide default
//      Builder emails — via the in-process activation consumer this api-rest
//      process registers (registerEmailProvisioningConsumer). Idempotent: a
//      re-activation adds no duplicates.
//   2. The per-site list (GET …/emails/site/:propertyId) shows the tenant defaults
//      until a site forks one, then shows the SITE's override in its place while
//      the tenant-wide default stays untouched.
//   3. "Customize for this site" is idempotent and an explicit property target
//      fails closed (404) on a foreign/unknown property id.
//
// createApp() does NOT wire the in-process consumers (index.ts main() does), so
// the suite resets the platform bus and registers the email provisioner itself,
// then drives module activation through the real /v1/tenant/modules route — whose
// publishPlatformEvent is awaited, so provisioning has completed by the time the
// 200 returns.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@sparx/db';
import { invalidateModuleCache } from '@sparx/auth';
import { resetPlatformBusForTesting } from '@sparx/crm';
import { createApp } from '../../src/app.js';
import { registerEmailProvisioningConsumer } from '../../src/lib/email-provisioning.js';
import { authHeader, signToken, createTestTenant, dropTestTenant } from '../helpers.js';

interface EmailDto {
  id: string;
  name: string;
  published: boolean;
}

describe('per-site email — provisioning + override join', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
    // Fresh bus, then subscribe the provisioner — createApp() doesn't (that's
    // index.ts main()). publishPlatformEvent dispatches to this same singleton.
    resetPlatformBusForTesting();
    registerEmailProvisioningConsumer();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    invalidateModuleCache();
  });

  /** A tenant with builder + email active and a primary site — the precondition
   *  for authoring per-site emails. Activation runs through the real route so the
   *  provisioning consumer fires. */
  async function setupTenant(): Promise<{ tenantId: string; token: string; propertyId: string }> {
    const t = await createTestTenant('owner');
    const token = signToken(app, t);

    // createTestTenant seeds no Property; author routes need a real primary site.
    const propertyId = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${t.tenantId}'`);
      const p = await tx.property.create({
        data: { tenantId: t.tenantId, slug: 'primary', name: 'Primary', isPrimary: true },
        select: { id: true },
      });
      return p.id;
    });

    const res = await app.inject({
      method: 'PUT',
      url: '/v1/tenant/modules',
      headers: authHeader(token),
      payload: { modules: { builder: true, email: true } },
    });
    expect(res.statusCode).toBe(200);
    invalidateModuleCache();
    return { tenantId: t.tenantId, token, propertyId };
  }

  /** The tenant-wide provisioned default keys, read RLS-scoped straight from the
   *  DB (the DTO doesn't surface `key`). */
  async function defaultKeys(tenantId: string): Promise<string[]> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      const rows = await tx.builderEmail.findMany({
        where: { propertyId: null, key: { not: null } },
        select: { key: true },
      });
      return rows.map((r) => r.key!);
    });
  }

  /** The (id, name) of the tenant-wide default for a key. */
  async function defaultRow(tenantId: string, key: string): Promise<{ id: string; name: string }> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      return tx.builderEmail.findFirstOrThrow({
        where: { propertyId: null, key },
        select: { id: true, name: true },
      });
    });
  }

  async function listTenant(token: string): Promise<EmailDto[]> {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/builder/emails',
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    return res.json().data.emails as EmailDto[];
  }

  async function listSite(token: string, propertyId: string): Promise<EmailDto[]> {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/builder/emails/site/${propertyId}`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    return res.json().data.emails as EmailDto[];
  }

  it('activating email provisions the 13 keyed defaults (published, idempotent)', async () => {
    const { tenantId, token } = await setupTenant();
    try {
      const keys = await defaultKeys(tenantId);
      expect(keys.length).toBe(13);
      expect(new Set(keys).size).toBe(13); // distinct

      // Surfaced through the tenant-wide catalog, every one published (send-ready).
      const emails = await listTenant(token);
      expect(emails.length).toBe(13);
      expect(emails.every((e) => e.published)).toBe(true);

      // Re-activation is a safe no-op — no duplicate rows.
      await app.inject({
        method: 'PATCH',
        url: '/v1/tenant/modules/email',
        headers: authHeader(token),
        payload: { enabled: false },
      });
      invalidateModuleCache();
      await app.inject({
        method: 'PATCH',
        url: '/v1/tenant/modules/email',
        headers: authHeader(token),
        payload: { enabled: true },
      });
      invalidateModuleCache();
      expect((await defaultKeys(tenantId)).length).toBe(13);
    } finally {
      await dropTestTenant(tenantId);
    }
  });

  it('a site override replaces the default in the site list, leaving the tenant default intact', async () => {
    const { tenantId, token, propertyId } = await setupTenant();
    try {
      const [key] = await defaultKeys(tenantId);
      if (!key) throw new Error('expected provisioned default keys');
      const base = await defaultRow(tenantId, key);

      // Before forking, the site sees the tenant default itself.
      const before = await listSite(token, propertyId);
      expect(before.length).toBe(13);
      expect(before.some((e) => e.id === base.id)).toBe(true);

      // Fork → a NEW per-site draft override (distinct id, not yet published).
      const forkRes = await app.inject({
        method: 'POST',
        url: `/v1/builder/emails/site/${propertyId}/customize`,
        headers: authHeader(token),
        payload: { key },
      });
      expect(forkRes.statusCode).toBe(200);
      const override = forkRes.json().data as EmailDto;
      expect(override.id).not.toBe(base.id);
      expect(override.published).toBe(false);

      // The site list now shows the override IN PLACE OF the default — same count,
      // the default's id gone, the override's id present under the same name.
      const after = await listSite(token, propertyId);
      expect(after.length).toBe(13);
      expect(after.some((e) => e.id === base.id)).toBe(false);
      const row = after.find((e) => e.name === base.name);
      expect(row?.id).toBe(override.id);

      // The tenant-wide default is untouched (it keeps sending until the site
      // publishes its override — getPublishedByKey's fallback).
      expect((await listTenant(token)).some((e) => e.id === base.id)).toBe(true);

      // Customizing again returns the SAME override (idempotent, no second row).
      const again = await app.inject({
        method: 'POST',
        url: `/v1/builder/emails/site/${propertyId}/customize`,
        headers: authHeader(token),
        payload: { key },
      });
      expect(again.statusCode).toBe(200);
      expect((again.json().data as EmailDto).id).toBe(override.id);
      expect((await listSite(token, propertyId)).length).toBe(13);
    } finally {
      await dropTestTenant(tenantId);
    }
  });

  it('an explicit foreign/unknown property target fails closed (404)', async () => {
    const { tenantId, token } = await setupTenant();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/builder/emails/site/00000000-0000-0000-0000-000000000000',
        headers: authHeader(token),
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await dropTestTenant(tenantId);
    }
  });
});
