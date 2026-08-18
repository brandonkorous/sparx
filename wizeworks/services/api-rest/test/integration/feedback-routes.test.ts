// In-product feedback — the tenant-facing surface (docs/112-feedback.md):
// a logged-in user files submissions, lists + reads their OWN threads, replies,
// and sees an unread flag once WizeWorks staff respond. These lock the contract:
//   • staff-only columns (internal_tags / assignee_staff_id / submitter_*) NEVER
//     appear in a tenant-facing response;
//   • the soft rate-limit returns a friendly 429 over the cap;
//   • RLS + the explicit userId filter keep one user's feedback invisible to
//     another tenant — by id, by list, and on reply.
//
// Mirrors rls-isolation.test.ts: real Postgres, real RLS, fixtures clean up via
// tenant cascade.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import {
  type TestTenant,
  authHeader,
  createTestTenant,
  dropTestTenant,
  signToken,
} from '../helpers.js';

// A WizeWorks-staff id lives outside the tenant schema (no FK) — any uuid works.
const STAFF_ID = '11111111-1111-1111-1111-111111111111';

describe('feedback — submissions, threads, unread, rate-limit, isolation', () => {
  let app: FastifyInstance;
  let alice: TestTenant;
  let bob: TestTenant;
  let aliceToken: string;
  let bobToken: string;
  let primaryId: string;

  beforeAll(async () => {
    app = await createApp();
    alice = await createTestTenant('owner');
    bob = await createTestTenant('owner');
    aliceToken = signToken(app, alice);
    bobToken = signToken(app, bob);
  });

  afterAll(async () => {
    await app.close();
    await dropTestTenant(alice.tenantId);
    await dropTestTenant(bob.tenantId);
  });

  function submit(token: string, payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/v1/me/feedback',
      headers: authHeader(token),
      payload,
    });
  }

  it('starts empty — no submissions, zero unread', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/me/feedback',
      headers: authHeader(aliceToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items).toEqual([]);
    expect(res.json().data.unreadCount).toBe(0);
  });

  it('files a submission (201) and never leaks staff-only fields', async () => {
    const res = await submit(aliceToken, {
      category: 'idea',
      subject: 'Add dark mode',
      body: 'A dark theme would be easier on the eyes at night.',
    });
    expect(res.statusCode).toBe(201);
    const { data } = res.json();
    primaryId = data.id;

    expect(data.category).toBe('idea');
    expect(data.subject).toBe('Add dark mode');
    expect(data.source).toBe('button'); // schema default
    expect(data.status).toBe('new'); // schema default
    expect(data.sentiment).toBeNull();
    expect(data.userUnread).toBe(false);
    expect(data.attachmentAssetIds).toEqual([]);

    // The triage/identity columns are admin-owned — they must not reach a tenant.
    expect(data.assigneeStaffId).toBeUndefined();
    expect(data.internalTags).toBeUndefined();
    expect(data.submitterEmail).toBeUndefined();
    expect(data.submitterName).toBeUndefined();
  });

  it('lists the new submission with a zero message count', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/me/feedback',
      headers: authHeader(aliceToken),
    });
    expect(res.statusCode).toBe(200);
    const item = res.json().data.items.find((i: { id: string }) => i.id === primaryId);
    expect(item).toBeTruthy();
    expect(item.messageCount).toBe(0);
    expect(item.status).toBe('new');
  });

  it('returns one submission with an (empty) thread by id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/me/feedback/${primaryId}`,
      headers: authHeader(aliceToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(primaryId);
    expect(res.json().data.messages).toEqual([]);
  });

  it('accepts a user reply and surfaces it in the thread + message count', async () => {
    const reply = await app.inject({
      method: 'POST',
      url: `/v1/me/feedback/${primaryId}/messages`,
      headers: authHeader(aliceToken),
      payload: { body: 'One more thing — please remember my choice.' },
    });
    expect(reply.statusCode).toBe(201);
    expect(reply.json().data.authorKind).toBe('user');
    expect(reply.json().data.body).toContain('remember my choice');

    const thread = await app.inject({
      method: 'GET',
      url: `/v1/me/feedback/${primaryId}`,
      headers: authHeader(aliceToken),
    });
    expect(thread.json().data.messages).toHaveLength(1);
    expect(thread.json().data.messages[0].authorKind).toBe('user');

    const list = await app.inject({
      method: 'GET',
      url: '/v1/me/feedback',
      headers: authHeader(aliceToken),
    });
    const item = list.json().data.items.find((i: { id: string }) => i.id === primaryId);
    expect(item.messageCount).toBe(1);
  });

  it('rejects invalid bodies (422 VALIDATION_ERROR)', async () => {
    const empty = await submit(aliceToken, { category: 'idea', body: '' });
    expect(empty.statusCode).toBe(422);
    expect(empty.json().error.code).toBe('VALIDATION_ERROR');

    const badCategory = await submit(aliceToken, { category: 'rant', body: 'hello' });
    expect(badCategory.statusCode).toBe(422);

    const badSentiment = await submit(aliceToken, {
      category: 'praise',
      body: 'great',
      sentiment: 9,
    });
    expect(badSentiment.statusCode).toBe(422);
  });

  it('flags unread when staff respond and clears it when the thread is opened', async () => {
    const created = await submit(aliceToken, {
      category: 'question',
      body: 'How do I export a CSV?',
    });
    const unreadId = created.json().data.id;

    // Simulate the admin app posting a staff reply (the loop state staff would set).
    await withTenant({ tenantId: alice.tenantId }, async (tx) => {
      await tx.feedbackMessage.create({
        data: {
          tenantId: alice.tenantId,
          submissionId: unreadId,
          authorKind: 'staff',
          authorId: STAFF_ID,
          authorName: 'Sparx Team',
          body: 'Open the table’s ⋯ menu → Export.',
        },
      });
      await tx.feedbackSubmission.update({
        where: { id: unreadId },
        data: { userUnread: true, lastResponseAt: new Date(), status: 'answered' },
      });
    });

    const before = await app.inject({
      method: 'GET',
      url: '/v1/me/feedback/unread-count',
      headers: authHeader(aliceToken),
    });
    expect(before.json().data.count).toBe(1);

    // Opening the thread is the read receipt.
    const open = await app.inject({
      method: 'GET',
      url: `/v1/me/feedback/${unreadId}`,
      headers: authHeader(aliceToken),
    });
    expect(open.json().data.userUnread).toBe(false);
    expect(
      open.json().data.messages.some((m: { authorKind: string }) => m.authorKind === 'staff')
    ).toBe(true);

    const after = await app.inject({
      method: 'GET',
      url: '/v1/me/feedback/unread-count',
      headers: authHeader(aliceToken),
    });
    expect(after.json().data.count).toBe(0);
  });

  it('returns a friendly 429 once the hourly cap is hit', async () => {
    const rick = await createTestTenant('owner');
    try {
      const rickToken = signToken(app, rick);
      // Seed exactly the cap (20) within the window, then the next one is blocked.
      await withTenant({ tenantId: rick.tenantId }, async (tx) => {
        await tx.feedbackSubmission.createMany({
          data: Array.from({ length: 20 }, (_, i) => ({
            tenantId: rick.tenantId,
            userId: rick.userId,
            category: 'idea',
            body: `bulk ${i}`,
          })),
        });
      });

      const blocked = await submit(rickToken, { category: 'idea', body: 'the 21st' });
      expect(blocked.statusCode).toBe(429);
      expect(blocked.json().error.code).toBe('RATE_LIMITED');
      expect(blocked.json().error.message).toMatch(/sent a lot of feedback/i);
    } finally {
      await dropTestTenant(rick.tenantId);
    }
  });

  it('does not let another tenant see, fetch, or reply on a submission (404 not 200)', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/v1/me/feedback',
      headers: authHeader(bobToken),
    });
    expect(list.json().data.items.map((i: { id: string }) => i.id)).not.toContain(primaryId);

    const fetch = await app.inject({
      method: 'GET',
      url: `/v1/me/feedback/${primaryId}`,
      headers: authHeader(bobToken),
    });
    expect(fetch.statusCode).toBe(404);

    const reply = await app.inject({
      method: 'POST',
      url: `/v1/me/feedback/${primaryId}/messages`,
      headers: authHeader(bobToken),
      payload: { body: 'sneaking in' },
    });
    expect(reply.statusCode).toBe(404);
  });
});
