// A DECISION THAT CHANGES NOTHING IS NOT RECORDED AS A DECISION.
//
// Sell › Reviews opens on the WAITING queue, and its empty state tells a shop
// with nothing waiting to switch the filter to All. There, every published review
// carried a green tick reading "Publish it". Pressing it looked like nothing —
// the row already said Published — but the service re-stamped `moderatedAt` and
// appended a second `approved` entry to the moderation log, so her own history of
// that review said she approved it twice, three weeks apart (issue 640).
//
// `moderate` already asked "did the status actually move?" TWICE, for the rating
// roll-up and for the event, and its own comment said so out loud. The three
// writes above them never asked. 111 of the 129 reviews on this platform are
// already published, so that tick was on six rows in seven.
//
// These run against real Postgres through the service every client shares.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { invalidateModuleCache } from '@wizeworks/auth';
import { reviewService } from '@wizeworks/commerce';
import { prisma, withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import { createTestTenant, dropTestTenant, type TestTenant } from '../helpers.js';

async function enableCommerce(tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: { modules: { commerce: { enabled: true } } } },
  });
  invalidateModuleCache();
}

async function createActiveProduct(t: TestTenant): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const handle = `moderated-${crypto.randomBytes(4).toString('hex')}`;
    const p = await tx.product.create({
      data: { tenantId: t.tenantId, title: 'The Everyday Tee', handle, status: 'active' },
      select: { id: true },
    });
    return p.id;
  });
}

/** A review already sitting in `pending`, as a customer's would be. */
async function submitReview(t: TestTenant, productId: string, rating: number): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const row = await tx.productReview.create({
      data: {
        tenantId: t.tenantId,
        productId,
        rating,
        title: 'Holds its shape after a hot wash',
        body: 'I bought the M in Clay to wear under things and it is what I put on first.',
        displayName: 'Tessa Wren',
        status: 'pending',
      },
      select: { id: true },
    });
    return row.id;
  });
}

/** What her record of this review says: the decisions, and when the last was. */
async function historyOf(
  t: TestTenant,
  reviewId: string
): Promise<{ entries: string[]; moderatedAt: Date | null; note: string | null }> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const log = await tx.reviewModerationLog.findMany({
      where: { reviewId },
      orderBy: { createdAt: 'asc' },
      select: { action: true },
    });
    const review = await tx.productReview.findUniqueOrThrow({
      where: { id: reviewId },
      select: { moderatedAt: true, moderationNote: true },
    });
    return {
      entries: log.map((l) => l.action),
      moderatedAt: review.moderatedAt,
      note: review.moderationNote,
    };
  });
}

describe('a moderation decision that changes nothing', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('is not written down when the review is already published', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId, userId: t.userId };
      const reviewId = await submitReview(t, await createActiveProduct(t), 5);

      const first = await reviewService.moderate(ctx, { reviewId, status: 'approved' });
      expect(first.changed, 'the real decision').toBe(true);
      const after = await historyOf(t, reviewId);
      expect(after.entries).toEqual(['approved']);

      // The press that used to lie. Her record must not move.
      const again = await reviewService.moderate(ctx, { reviewId, status: 'approved' });
      expect(again.changed, 'pressing Publish on a published review').toBe(false);

      const unchanged = await historyOf(t, reviewId);
      expect(unchanged.entries, 'no second approval in her history').toEqual(['approved']);
      expect(unchanged.moderatedAt?.getTime(), 'when she decided, which is not today').toBe(
        after.moderatedAt?.getTime()
      );
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('is written down when the note is the thing that changed', async () => {
    // Same status, new reason. That IS a decision, and it stays recorded.
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId, userId: t.userId };
      const reviewId = await submitReview(t, await createActiveProduct(t), 4);

      await reviewService.moderate(ctx, { reviewId, status: 'approved' });
      const result = await reviewService.moderate(ctx, {
        reviewId,
        status: 'approved',
        moderationNote: 'Checked with her: she really did buy it.',
      });

      expect(result.changed).toBe(true);
      const history = await historyOf(t, reviewId);
      expect(history.entries).toEqual(['approved', 'approved']);
      expect(history.note).toBe('Checked with her: she really did buy it.');
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('leaves the ordinary path alone', async () => {
    // The guard must not cost the real decisions anything: hiding a published
    // review still writes the row, the log entry and the rating roll-up.
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId, userId: t.userId };
      const productId = await createActiveProduct(t);
      const reviewId = await submitReview(t, productId, 5);

      await reviewService.moderate(ctx, { reviewId, status: 'approved' });
      const rolled = await withTenant({ tenantId: t.tenantId }, (tx) =>
        tx.product.findUniqueOrThrow({
          where: { id: productId },
          select: { reviewCount: true, averageRating: true },
        })
      );
      expect(rolled).toMatchObject({ reviewCount: 1, averageRating: 5 });

      const hidden = await reviewService.moderate(ctx, { reviewId, status: 'rejected' });
      expect(hidden.changed).toBe(true);
      expect((await historyOf(t, reviewId)).entries).toEqual(['approved', 'rejected']);
      expect(
        await withTenant({ tenantId: t.tenantId }, (tx) =>
          tx.product.findUniqueOrThrow({
            where: { id: productId },
            select: { reviewCount: true, averageRating: true },
          })
        )
      ).toMatchObject({ reviewCount: 0, averageRating: null });
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });

  it('counts what moved when several are decided at once', async () => {
    // "Shown (3)" over three rows that were already shown is what this replaces.
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId, userId: t.userId };
      const productId = await createActiveProduct(t);
      const already = await submitReview(t, productId, 5);
      const waiting = await submitReview(t, productId, 4);
      await reviewService.moderate(ctx, { reviewId: already, status: 'approved' });

      const mixed = await reviewService.moderateMany(ctx, {
        reviewIds: [already, waiting],
        status: 'approved',
      });
      expect(mixed, 'one moved, one was already there').toEqual({ count: 1, unchanged: 1 });

      const none = await reviewService.moderateMany(ctx, {
        reviewIds: [already, waiting],
        status: 'approved',
      });
      expect(none, 'nothing left to do').toEqual({ count: 0, unchanged: 2 });
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});

describe('the same rule for a customer question', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('does not re-record showing a question that is already shown', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId, userId: t.userId };
      const productId = await createActiveProduct(t);
      const questionId = await withTenant({ tenantId: t.tenantId }, async (tx) => {
        const row = await tx.productQuestion.create({
          data: {
            tenantId: t.tenantId,
            productId,
            body: 'I am 6ft 2 with long arms. Do the sleeves run long?',
            displayName: 'Tomas Villalobos',
            status: 'pending',
          },
          select: { id: true },
        });
        return row.id;
      });

      expect(
        (await reviewService.moderateQuestion(ctx, { questionId, status: 'published' })).changed
      ).toBe(true);
      expect(
        (await reviewService.moderateQuestion(ctx, { questionId, status: 'published' })).changed
      ).toBe(false);

      const entries = await withTenant({ tenantId: t.tenantId }, (tx) =>
        tx.auditLog.count({
          where: { entityType: 'ProductQuestion', entityId: questionId },
        })
      );
      expect(entries, 'one showing, one entry').toBe(1);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});
