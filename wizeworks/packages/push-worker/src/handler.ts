// Per-message handler: a `push.send` event → deliver a Web Push notification to
// every browser subscription the target staff user has registered.
//
// Failure handling per subscription:
//   • 404 / 410  → the subscription expired; delete the row (permanent).
//   • other 4xx  → permanent for that row; log + skip (don't redeliver).
//   • 5xx / net  → transient; throw so the whole message is redelivered. The SW
//                  collapses on `tag`, so a redelivered push replaces (not
//                  stacks) any already-shown notification — no double-notify.

import webpush, { WebPushError } from 'web-push';
import { z } from 'zod';
import { withTenant } from '@wizeworks/db';
import type { Logger } from 'pino';

import { env } from './env.js';

let vapidReady: boolean | null = null;

/** Configure VAPID once. Returns false if keys are unset (worker no-ops). */
export function configureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    vapidReady = true;
  } else {
    vapidReady = false;
  }
  return vapidReady;
}

const PushSendEvent = z.object({
  type: z.literal('push.send'),
  tenantId: z.string().uuid(),
  data: z.object({
    userId: z.string().uuid(),
    title: z.string().min(1).max(200),
    body: z.string().max(500),
    url: z.string().max(2048).optional(),
    tag: z.string().max(120).optional(),
  }),
});
export type PushSendEvent = z.infer<typeof PushSendEvent>;

export function parseEvent(raw: unknown): PushSendEvent | null {
  const result = PushSendEvent.safeParse(raw);
  return result.success ? result.data : null;
}

export interface PushOutcome {
  sent: number;
  expired: number;
  failed: number;
  skipped?: boolean;
}

export async function handle(event: PushSendEvent, logger: Logger): Promise<PushOutcome> {
  if (!configureVapid()) {
    logger.warn('VAPID keys unset — acking push.send without delivery');
    return { sent: 0, expired: 0, failed: 0, skipped: true };
  }

  const ctx = { tenantId: event.tenantId };
  const subs = await withTenant(ctx, (tx) =>
    tx.pushSubscription.findMany({
      where: { userId: event.data.userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    })
  );
  if (subs.length === 0) return { sent: 0, expired: 0, failed: 0 };

  const payload = JSON.stringify({
    title: event.data.title,
    body: event.data.body,
    url: event.data.url ?? '/',
    tag: event.data.tag,
  });

  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];
  let transientError: unknown = null;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 600 }
        );
        sent++;
      } catch (err) {
        if (err instanceof WebPushError) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            expiredIds.push(s.id);
          } else if (err.statusCode >= 400 && err.statusCode < 500) {
            failed++;
            logger.warn(
              { statusCode: err.statusCode, endpoint: s.endpoint },
              'push permanently rejected'
            );
          } else {
            failed++;
            transientError = err;
          }
        } else {
          failed++;
          transientError = err;
        }
      }
    })
  );

  if (expiredIds.length > 0) {
    await withTenant(ctx, (tx) =>
      tx.pushSubscription.deleteMany({ where: { id: { in: expiredIds } } })
    );
  }

  if (transientError) {
    throw transientError instanceof Error
      ? transientError
      : new Error('transient push delivery failure', { cause: transientError });
  }

  return { sent, expired: expiredIds.length, failed };
}
