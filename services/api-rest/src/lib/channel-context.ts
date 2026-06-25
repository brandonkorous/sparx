import type { FastifyRequest } from 'fastify';
import { isModuleEnabled } from '@sparx/auth';
import { requireAuth } from '@sparx/api-core/auth';
import { moduleDisabled } from '@sparx/api-core/errors';

// Channels are part of the Commerce module (no separate fee — docs/106 §8), so
// the channel surface is gated on `commerce`.

export interface ChannelContext {
  tenantId: string;
  userId: string;
}

export function toChannelContext(request: FastifyRequest): ChannelContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

export async function requireChannelsModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'commerce');
  if (!enabled) throw moduleDisabled('commerce');
}
