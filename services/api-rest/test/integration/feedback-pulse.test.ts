// The non-intrusive sentiment pulse (docs/112-feedback.md §5). The server is the
// authority on WHEN to ask: a too-young account never sees it, suppressed routes
// (checkout/billing/onboarding/auth) never show it, and once shown/answered the
// per-user frequency cap silences it — with a longer back-off after repeated
// dismissals. These tests pin each branch of the eligibility decision plus the
// shown / dismissed / answered state writes.

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

const DAY_MS = 24 * 60 * 60 * 1000;

describe('feedback pulse — eligibility + interaction tracking', () => {
  let app: FastifyInstance;
  const cleanup: string[] = [];

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    await Promise.all(cleanup.map((id) => dropTestTenant(id)));
  });

  // A tenant whose owner registered `ageDays` ago, tracked for teardown.
  async function agedTenant(ageDays: number): Promise<{ t: TestTenant; token: string }> {
    const t = await createTestTenant('owner');
    cleanup.push(t.tenantId);
    if (ageDays > 0) {
      await withTenant({ tenantId: t.tenantId }, async (tx) => {
        await tx.user.update({
          where: { id: t.userId },
          data: { createdAt: new Date(Date.now() - ageDays * DAY_MS) },
        });
      });
    }
    return { t, token: signToken(app, t) };
  }

  async function setPulseState(t: TestTenant, data: Record<string, unknown>): Promise<void> {
    await withTenant({ tenantId: t.tenantId }, async (tx) => {
      await tx.feedbackPulseState.upsert({
        where: { userId_tenantId: { userId: t.userId, tenantId: t.tenantId } },
        create: { tenantId: t.tenantId, userId: t.userId, ...data },
        update: data,
      });
    });
  }

  function getPulse(token: string, route?: string) {
    const qs = route ? `?route=${encodeURIComponent(route)}` : '';
    return app.inject({
      method: 'GET',
      url: `/v1/me/feedback/pulse${qs}`,
      headers: authHeader(token),
    });
  }

  function recordEvent(token: string, payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/v1/me/feedback/pulse/event',
      headers: authHeader(token),
      payload,
    });
  }

  it('never prompts an account younger than the warm-up window', async () => {
    const { token } = await agedTenant(0); // just registered
    const res = await getPulse(token);
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toBeNull();
  });

  it('offers the sentiment prompt to a warmed-up account with no prior state', async () => {
    const { token } = await agedTenant(30);
    const res = await getPulse(token);
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data).not.toBeNull();
    expect(data.promptId).toBe('pulse-sentiment');
    expect(data.kind).toBe('sentiment');
    expect(typeof data.question).toBe('string');
    expect(data.question.length).toBeGreaterThan(0);
  });

  it('stays silent on suppressed routes even when otherwise eligible', async () => {
    const { token } = await agedTenant(30);
    for (const route of ['/commerce/checkout/abc', '/settings/billing', '/onboarding/step-2']) {
      const res = await getPulse(token, route);
      expect(res.json().data, route).toBeNull();
    }
    // …but a normal route is still eligible for the same user.
    expect((await getPulse(token, '/crm/customers')).json().data).not.toBeNull();
  });

  it('records "shown" and then honours the cooldown', async () => {
    const { token } = await agedTenant(30);
    const shown = await recordEvent(token, { action: 'shown' });
    expect(shown.statusCode).toBe(200);
    expect(shown.json().data.recorded).toBe(true);

    // Just shown → inside the 90-day cooldown → no re-prompt.
    expect((await getPulse(token)).json().data).toBeNull();
  });

  it('suppresses the pulse for someone who just submitted feedback', async () => {
    const { t, token } = await agedTenant(30);
    await setPulseState(t, { lastSubmittedAt: new Date() });
    expect((await getPulse(token)).json().data).toBeNull();
  });

  it('increments the dismissal streak and clears it on an answer', async () => {
    const { t, token } = await agedTenant(30);

    await recordEvent(token, { action: 'dismissed' });
    await recordEvent(token, { action: 'dismissed' });

    const afterDismiss = await withTenant({ tenantId: t.tenantId }, (tx) =>
      tx.feedbackPulseState.findUniqueOrThrow({
        where: { userId_tenantId: { userId: t.userId, tenantId: t.tenantId } },
      })
    );
    expect(afterDismiss.consecutiveDismissals).toBe(2);

    await recordEvent(token, { action: 'answered', sentiment: 4 });

    const afterAnswer = await withTenant({ tenantId: t.tenantId }, (tx) =>
      tx.feedbackPulseState.findUniqueOrThrow({
        where: { userId_tenantId: { userId: t.userId, tenantId: t.tenantId } },
      })
    );
    expect(afterAnswer.consecutiveDismissals).toBe(0);
    expect(afterAnswer.lastSentiment).toBe(4);
    expect(afterAnswer.lastSubmittedAt).not.toBeNull();
  });

  it('extends the cooldown to the back-off window after repeated dismissals', async () => {
    const { t, token } = await agedTenant(30);

    // Shown 100 days ago: past the 90-day cooldown, so with no dismissal streak
    // the user is eligible again.
    await setPulseState(t, {
      lastShownAt: new Date(Date.now() - 100 * DAY_MS),
      consecutiveDismissals: 0,
      lastSubmittedAt: null,
    });
    expect((await getPulse(token)).json().data).not.toBeNull();

    // Same 100-days-ago, but two dismissals push the cap to the 180-day back-off
    // — so 100 days is no longer enough and the pulse stays silent.
    await setPulseState(t, { consecutiveDismissals: 2 });
    expect((await getPulse(token)).json().data).toBeNull();
  });
});
