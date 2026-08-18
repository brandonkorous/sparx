// Regression guard for the verified-email gate under the non-owner DB role.
//
// `requireVerifiedEmail` used to read `users.email_verified` with the base
// Prisma client. api-rest connects as `sparx_app`, and the `users` table's RLS
// (ENABLE, NO FORCE) hides the row from that role, so the read returned null and
// the gate FALSELY blocked every verified user once onboarding was finished —
// breaking publish / domain purchase / email send / Stripe connect in local dev.
// The fix sources the flag from the session JWT `ev` claim instead.
//
// These tests run against the real local Postgres AS sparx_app (the helper sets
// `app.tenant_id` to create the user, proving RLS is in effect), so the first
// case below FAILS against the old base-client read and PASSES against the claim
// read. The gate is exercised through /v1/domains/purchase, which calls the gate
// right after the role check — its 403 carries the distinctive "Confirm your
// email" copy, so any other outcome means the request passed the gate.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import {
  type TestTenant,
  authHeader,
  createTestTenant,
  dropTestTenant,
  signToken,
} from '../helpers.js';

const VERIFY_MSG = 'Confirm your email';

describe('requireVerifiedEmail gate (RLS-safe via JWT claim)', () => {
  let app: FastifyInstance;
  let tenant: TestTenant;

  beforeAll(async () => {
    app = await createApp();
    tenant = await createTestTenant('owner');
  });

  afterAll(async () => {
    await dropTestTenant(tenant.tenantId);
    await app.close();
  });

  // `tenants` has no RLS (the dispatch table), so the base client can write it.
  async function setOnboardingFinished(finished: boolean): Promise<void> {
    await prisma.tenant.update({
      where: { id: tenant.tenantId },
      data: { settings: finished ? { onboarding: { finishedAt: new Date().toISOString() } } : {} },
    });
  }

  function purchase(token: string) {
    return app.inject({
      method: 'POST',
      url: '/v1/domains/purchase',
      headers: authHeader(token),
      // propertyId is intentionally bogus: a verified user clears the gate and
      // then fails further down (checkout-closed / not-found / validation) — all
      // of which are NOT the verify-email message we assert on.
      payload: { domain: 'regression-example.com', propertyId: 'prop_nonexistent' },
    });
  }

  function message(res: { json: () => { error?: { message?: string } } }): string {
    return res.json().error?.message ?? '';
  }

  it('allows a verified user even after onboarding is finished', async () => {
    // The keystone case: this is exactly what the base-client read broke.
    await setOnboardingFinished(true);
    const res = await purchase(signToken(app, tenant, 'owner', { emailVerified: true }));
    expect(message(res)).not.toContain(VERIFY_MSG);
  });

  it('blocks an unverified user once onboarding is finished', async () => {
    await setOnboardingFinished(true);
    const res = await purchase(signToken(app, tenant, 'owner', { emailVerified: false }));
    expect(res.statusCode).toBe(403);
    expect(message(res)).toContain(VERIFY_MSG);
  });

  it('exempts an unverified user while onboarding is unfinished', async () => {
    await setOnboardingFinished(false);
    const res = await purchase(signToken(app, tenant, 'owner', { emailVerified: false }));
    expect(message(res)).not.toContain(VERIFY_MSG);
  });
});
