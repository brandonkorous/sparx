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

import { withTenant } from '@wizeworks/db';
import type { EmailSettings } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { publishEmailEvent } from '../events';
import type { ServiceContext } from '../errors';
import { UpdateEmailSettingsInput } from '../schemas/settings';
import { buildTenantFrom } from './platform-sender';

export interface EmailSettingsView {
  tenantId: string;
  propertyId: string;
  fromName: string | null;
  fromAddress: string | null;
  replyTo: string | null;
  physicalAddress: string | null;
  defaultSendingDomainId: string | null;
  /**
   * The exact `From` header a send from this site will carry — the SAME string
   * `buildTenantFrom` gives the mailer, resolved here rather than guessed again
   * downstream.
   *
   * A console that re-derived the unconfigured fallback for itself named a
   * domain the platform does not send from, and dropped the sender NAME
   * entirely — so an owner read "noreply@piggles.email" on the screen and her
   * customers received "Piggles <noreply@sparx.email>". The sender name is the
   * one part of an email a recipient actually reads, so it is not something a
   * second implementation gets to have an opinion about.
   */
  resolvedFrom: string;
}

function toView(
  tenantId: string,
  propertyId: string,
  row: EmailSettings | null,
  resolvedFrom: string
): EmailSettingsView {
  return {
    tenantId,
    propertyId,
    fromName: row?.fromName ?? null,
    fromAddress: row?.fromAddress ?? null,
    replyTo: row?.replyTo ?? null,
    physicalAddress: row?.physicalAddress ?? null,
    defaultSendingDomainId: row?.defaultSendingDomainId ?? null,
    resolvedFrom,
  };
}

/** The `From` a send would carry with these fields — the view's `resolvedFrom`. */
function senderFor(tenantId: string, row: EmailSettings | null): Promise<string> {
  return buildTenantFrom(tenantId, row?.fromName ?? null, row?.fromAddress ?? null);
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
  const { siteId, row } = await withTenant(ctx, async (tx) => {
    const resolved =
      propertyId ??
      (await tx.property.findFirst({ where: { isPrimary: true }, select: { id: true } }))?.id;
    // A tenant with no primary site has no business to send as. All-nulls sends
    // as the platform, which is the same result an unconfigured site gives.
    if (!resolved) return { siteId: '', row: null };
    // No fallback to a SIBLING site, deliberately. An unset site yields all-null
    // fields and buildFrom() drops to the platform sender.
    return {
      siteId: resolved,
      row: await tx.emailSettings.findUnique({
        where: { tenantId_propertyId: { tenantId: ctx.tenantId, propertyId: resolved } },
      }),
    };
  });
  // Outside withTenant: buildTenantFrom reads the non-RLS `tenants` dispatch row
  // on the plain client, which has no tenant context to borrow.
  return toView(ctx.tenantId, siteId, row, await senderFor(ctx.tenantId, row));
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

  return toView(ctx.tenantId, propertyId, row, await senderFor(ctx.tenantId, row));
}
