// Bridge between Fastify auth context and the chat services' TenantContext.
//
// Mirrors crm-context.ts: staff routes derive a tenant-scoped context from the
// JWT (toChatContext) after requireChatModule; the public storefront routes
// resolve the tenant from the `?tenant=<slug>` query param instead (no staff
// identity), with chat-module activation enforced the same way.

import type { FastifyRequest } from 'fastify';
import type { TenantContext } from '@sparx/db';
import { isModuleEnabled } from '@sparx/auth';
import { requireAuth } from '@sparx/api-core/auth';
import { moduleDisabled } from '@sparx/api-core/errors';

import { z } from 'zod';

import { resolveTenantId } from './public-commerce-context.js';
import { resolvePublicPropertyId } from './property.js';

export function toChatContext(request: FastifyRequest): TenantContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

/** 404 (via MODULE_DISABLED) if the caller's tenant hasn't activated chat. */
export async function requireChatModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'chat');
  if (!enabled) throw moduleDisabled('chat');
}

/** Resolve `?tenant=<slug>` → tenantId and assert chat is active. The public
 *  storefront widget identifies its tenant by slug on every call.
 *
 *  Also resolves WHICH SITE the widget is embedded on (docs/131 §3.7), via the
 *  same `?property=<slug>` the rest of the public storefront reads use. Without
 *  it every visitor conversation landed on the tenant's primary site, so the
 *  donut shop's chats appeared in the machine shop's inbox and were answered in
 *  the machine shop's voice. */
export async function publicChatContext(
  request: FastifyRequest
): Promise<{ tenantId: string; propertyId: string; ctx: TenantContext }> {
  const tenantId = await resolveTenantId(request);
  const enabled = await isModuleEnabled(tenantId, 'chat');
  if (!enabled) throw moduleDisabled('chat');
  const { property } = PublicSiteQuery.parse(request.query);
  const propertyId = await resolvePublicPropertyId(tenantId, property);
  return { tenantId, propertyId, ctx: { tenantId } };
}

const PublicSiteQuery = z
  .object({ property: z.string().min(1).max(63).optional() })
  // The widget sends other params (tenant, …) and must not 400 on them.
  .passthrough();

/** The anonymous-ownership token a widget echoes back on every public call. */
export function readChatToken(request: FastifyRequest): string | undefined {
  const token = request.headers['x-chat-token'];
  return typeof token === 'string' ? token : undefined;
}
