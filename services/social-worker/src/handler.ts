// Per-message handler. The worker consumes two events, both carrying just a tenant +
// post id:
//   · social.post.due       → publish that post's targets to their platforms (drainPost)
//   · social.metrics.collect → snapshot each published target's numbers (collectPostMetrics)
// Both are idempotent enough to redeliver: the drain re-attempts only still-pending
// targets, and a collect simply writes another snapshot, so returning 500 on a transient
// failure to trigger redelivery is safe.

import { z } from 'zod';
import type { Logger } from 'pino';

import { drainPost, type DrainOutcome } from './publish.js';
import { collectPostMetrics, type CollectOutcome } from './collect.js';

const PostRef = z.object({ postId: z.string().uuid() });

const SocialWorkerEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('social.post.due'), tenantId: z.string().uuid(), data: PostRef }),
  z.object({
    type: z.literal('social.metrics.collect'),
    tenantId: z.string().uuid(),
    data: PostRef,
  }),
]);
export type SocialWorkerEvent = z.infer<typeof SocialWorkerEvent>;

export function parseEvent(raw: unknown): SocialWorkerEvent | null {
  const result = SocialWorkerEvent.safeParse(raw);
  return result.success ? result.data : null;
}

export async function handle(
  event: SocialWorkerEvent,
  logger: Logger
): Promise<CollectOutcome | DrainOutcome> {
  if (event.type === 'social.metrics.collect') {
    return collectPostMetrics(event.tenantId, event.data.postId, logger);
  }
  return drainPost(event.tenantId, event.data.postId, logger);
}
