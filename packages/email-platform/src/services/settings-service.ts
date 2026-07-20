// settingsService — per-SITE email settings (sender identity, CAN-SPAM footer
// address, brand fallback, default sending domain).
//
// EmailSettings is keyed `(tenantId, propertyId)` — one row per site, not per
// tenant (docs/131 §3.4). Reads return the row or a synthesized default (we
// don't create on read), and writes upsert. The full brand resolver
// (resolveBranding) that pulls storefront theme tokens lands with templates
// (P4); this surface owns the editable settings only.
//
// Every function takes an explicit `propertyId` rather than reading one off ctx:
// a caller that forgets to scope this should not compile, because the failure it
// produces — a plausible-looking email sent under the wrong business's name — is
// invisible in review and only surfaces in a customer's inbox.

import { withTenant } from '@sparx/db';
import type { EmailSettings } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishEmailEvent } from '../events';
import type { ServiceContext } from '../errors';
import { UpdateEmailSettingsInput } from '../schemas/settings';

export interface EmailSettingsView {
  tenantId: string;
  propertyId: string;
  fromName: string | null;
  fromAddress: string | null;
  replyTo: string | null;
  physicalAddress: string | null;
  defaultSendingDomainId: string | null;
}

function toView(
  tenantId: string,
  propertyId: string,
  row: EmailSettings | null
): EmailSettingsView {
  return {
    tenantId,
    propertyId,
    fromName: row?.fromName ?? null,
    fromAddress: row?.fromAddress ?? null,
    replyTo: row?.replyTo ?? null,
    physicalAddress: row?.physicalAddress ?? null,
    defaultSendingDomainId: row?.defaultSendingDomainId ?? null,
  };
}

/**
 * Read one site's settings.
 *
 * `propertyId` accepts null — and only READS do — for call paths that predate
 * per-site sends and genuinely carry no site (a broadcast with no property).
 * Those resolve to the tenant's primary, which is the same business the old
 * per-tenant row described. `update` deliberately does NOT accept null: editing
 * an identity without saying whose it is has no correct interpretation.
 */
export async function get(
  ctx: ServiceContext,
  propertyId: string | null
): Promise<EmailSettingsView> {
  return withTenant(ctx, async (tx) => {
    const siteId =
      propertyId ??
      (await tx.property.findFirst({ where: { isPrimary: true }, select: { id: true } }))?.id;
    // A tenant with no primary site has no business to send as. All-nulls sends
    // as the platform, which is the same result an unconfigured site gives.
    if (!siteId) return toView(ctx.tenantId, '', null);
    const row = await tx.emailSettings.findUnique({
      where: { tenantId_propertyId: { tenantId: ctx.tenantId, propertyId: siteId } },
    });
    // No fallback to a SIBLING site, deliberately. An unset site yields all-null
    // fields and buildFrom() drops to the platform sender.
    return toView(ctx.tenantId, siteId, row);
  });
}

export async function update(
  ctx: ServiceContext,
  propertyId: string,
  rawInput: unknown
): Promise<EmailSettingsView> {
  const input = UpdateEmailSettingsInput.parse(rawInput);

  const data = {
    ...(input.fromName !== undefined ? { fromName: input.fromName } : {}),
    ...(input.fromAddress !== undefined ? { fromAddress: input.fromAddress } : {}),
    ...(input.replyTo !== undefined ? { replyTo: input.replyTo } : {}),
    ...(input.physicalAddress !== undefined ? { physicalAddress: input.physicalAddress } : {}),
    ...(input.defaultSendingDomainId !== undefined
      ? { defaultSendingDomainId: input.defaultSendingDomainId }
      : {}),
  };

  const row = await withTenant(ctx, async (tx) => {
    const updated = await tx.emailSettings.upsert({
      where: { tenantId_propertyId: { tenantId: ctx.tenantId, propertyId } },
      create: { tenantId: ctx.tenantId, propertyId, ...data },
      update: data,
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'email.settings.updated',
      entityType: 'EmailSettings',
      // The SITE is the entity now — a tenant-id here would collapse both
      // businesses' identity edits onto one indistinguishable audit trail.
      entityId: propertyId,
      diff: { after: data },
    });
    return updated;
  });

  await publishEmailEvent({
    tenantId: ctx.tenantId,
    topic: 'email.settings.updated',
    payload: { propertyId, fields: Object.keys(data) },
    // propertyId belongs in the dedupe key: two sites edited in the same
    // millisecond are two distinct events, and without it one would be dropped
    // as a duplicate of the other.
    dedupeKey: `email.settings.updated:${ctx.tenantId}:${propertyId}:${row.updatedAt.toISOString()}`,
  });

  return toView(ctx.tenantId, propertyId, row);
}
