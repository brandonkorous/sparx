'use server';

// Web Push subscription server actions (docs/69 A-6). The browser can't call
// api-rest directly (the JWT is server-only), so the client toggle funnels the
// PushSubscription JSON through these.

import { api } from '@/lib/api-rest-client';

interface SubscribeInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

export async function subscribePushAction(sub: SubscribeInput): Promise<void> {
  await api.post('/v1/staff/push-subscriptions', sub);
}

export async function unsubscribePushAction(endpoint: string): Promise<void> {
  await api.post('/v1/staff/push-subscriptions/unsubscribe', { endpoint });
}
