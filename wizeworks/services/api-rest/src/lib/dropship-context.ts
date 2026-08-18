import type { FastifyRequest } from 'fastify';
import { isModuleEnabled } from '@wizeworks/auth';
import { requireAuth } from '@wizeworks/api-core/auth';
import { moduleDisabled } from '@wizeworks/api-core/errors';

export interface DropshipContext {
  tenantId: string;
  userId: string;
}

export function toDropshipContext(request: FastifyRequest): DropshipContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

export async function requireDropshipModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'dropship');
  if (!enabled) throw moduleDisabled('dropship');
}
