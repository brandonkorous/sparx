// A staff reply must reach the submitter's notification bell.
//
// `feedbackSubmission.userUnread` marks the THREAD, which is enough for the
// feedback list's own dot but cannot reach the bell — that reads per-user
// `notifications` rows. So the operator reply route writes one directly, via
// `writePlatformNotice`, in the SAME transaction as the message.
//
// That direct write is the narrow exception to "notification rows are derived,
// never inlined" (docs/124), justified on an OWNERSHIP axis: this is
// correspondence between sparx and the account holder, not an event in the
// tenant's business, so there is no rule anyone would author for it. These tests
// lock the three properties that argument rests on:
//
//   • the notice cannot be lost — a reply never lands without one;
//   • it is addressed to the SUBMITTER alone, never fanned out to staff by role
//     (that would publish one person's private thread to their colleagues);
//   • it carries entityType/entityId so a consumer can deep-link to the thread.
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

const OPERATOR_TOKEN = process.env.SPARX_INTERNAL_OPERATOR_TOKEN ?? '';
const OPERATOR_ID = '22222222-2222-2222-2222-222222222222';

describe('operator feedback reply — writes the submitter a notification', () => {
  let app: FastifyInstance;
  let tenant: TestTenant;
  let token: string;
  let submissionId: string;

  beforeAll(async () => {
    app = await createApp();
    tenant = await createTestTenant('owner');
    token = signToken(app, tenant);

    const created = await app.inject({
      method: 'POST',
      url: '/v1/me/feedback',
      headers: authHeader(token),
      payload: { category: 'problem', body: 'Totals are wrong with a discount.' },
    });
    submissionId = created.json().data.id as string;
  });

  afterAll(async () => {
    await app.close();
    await dropTestTenant(tenant.tenantId);
  });

  function staffReply(body: string) {
    return app.inject({
      method: 'POST',
      url: `/internal/operator/feedback/${tenant.tenantId}/${submissionId}/messages`,
      headers: {
        'x-sparx-internal-operator-token': OPERATOR_TOKEN,
        'x-sparx-operator-id': OPERATOR_ID,
      },
      payload: { body, authorName: 'Brandon' },
    });
  }

  function notices() {
    return withTenant({ tenantId: tenant.tenantId }, (tx) =>
      tx.notification.findMany({ where: { tenantId: tenant.tenantId } })
    );
  }

  it('writes no notification before anyone replies', async () => {
    expect(await notices()).toHaveLength(0);
  });

  it('writes exactly one notice, addressed to the submitter, on a staff reply', async () => {
    const res = await staffReply('Good catch — a fix is going out this week.');
    expect(res.statusCode).toBe(200);

    const rows = await notices();
    expect(rows).toHaveLength(1);

    const notice = rows[0]!;
    // Addressed to the ONE person who wrote in — never fanned out by role.
    expect(notice.userId).toBe(tenant.userId);
    expect(notice.kind).toBe('feedback.replied');
    expect(notice.readAt).toBeNull();
    // The deep-link payload: without these the bell announces something and
    // then makes the reader go find it.
    expect(notice.entityType).toBe('feedback');
    expect(notice.entityId).toBe(submissionId);
    // Account-level: a message from sparx belongs to no business module.
    expect(notice.module).toBeNull();
    expect(notice.body).toContain('a fix is going out');
  });

  it('marks the thread unread too — the list dot and the bell agree', async () => {
    const [submission] = await withTenant({ tenantId: tenant.tenantId }, (tx) =>
      tx.feedbackSubmission.findMany({ where: { id: submissionId } })
    );
    expect(submission?.userUnread).toBe(true);
  });

  it('writes one notice per reply, so a second answer is announced too', async () => {
    await staffReply('Shipped — please confirm it looks right on your end.');
    expect(await notices()).toHaveLength(2);
  });

  it('rejects an unauthenticated operator call without writing anything', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/internal/operator/feedback/${tenant.tenantId}/${submissionId}/messages`,
      payload: { body: 'no token' },
    });
    expect(res.statusCode).toBe(401);
    // Still two — the guard runs before any write.
    expect(await notices()).toHaveLength(2);
  });
});
