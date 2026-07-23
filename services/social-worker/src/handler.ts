// Per-message handler: a `social.post.due` event → drain that post's targets to their
// platforms. The event carries only the post id + tenant; the drain loads everything
// it needs and is idempotent per target (a redelivery re-attempts only still-pending
// targets), so returning 500 on a transient failure to trigger redelivery is safe.

import { z } from 'zod';
import type { Logger } from 'pino';

import { drainPost, type DrainOutcome } from './publish.js';

const SocialPostDueEvent = z.object({
  type: z.literal('social.post.due'),
  tenantId: z.string().uuid(),
  data: z.object({ postId: z.string().uuid() }),
});
export type SocialPostDueEvent = z.infer<typeof SocialPostDueEvent>;

export function parseEvent(raw: unknown): SocialPostDueEvent | null {
  const result = SocialPostDueEvent.safeParse(raw);
  return result.success ? result.data : null;
}

export async function handle(event: SocialPostDueEvent, logger: Logger): Promise<DrainOutcome> {
  return drainPost(event.tenantId, event.data.postId, logger);
}
