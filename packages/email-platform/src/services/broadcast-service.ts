// broadcastService — segment-targeted marketing campaigns.
//
// A broadcast renders a published Builder email (docs/52) and fans out to every
// segment member minus suppressions. Static / per-send bodies render ONCE → a
// "raw" payload; a per-recipient body (recipient/order/cart/loyalty bindings)
// defers, rendering per recipient at dispatch. Send + schedule both enqueue a
// per-recipient ScheduledSend; the shared email-dispatch tick delivers them
// (immediately for send, at scheduledAt for schedule), so scheduling needs no
// separate worker. Cancel removes pending rows. Stats aggregate EmailEvent rows
// joined by the broadcast_id variable the webhook stamps back.

import { withTenant } from '@sparx/db';
import type { Broadcast } from '@sparx/db';
import { renderEmailTree } from '@sparx/email';
import { treeIsEmailPersonalized, type BuilderNode } from '@sparx/builder-schemas';

import { writeAuditLog } from '../audit';
import { publishEmailEvent } from '../events';
import { EmailNotFoundError, EmailValidationError, type ServiceContext } from '../errors';
import { noEmailDataResolver, type ResolveEmailData } from './builder-email-service';
import {
  CreateBroadcastInput,
  ScheduleBroadcastInput,
  UpdateBroadcastInput,
} from '../schemas/broadcasts';
import { resolveEmailBrand } from './brand-service';
import { get as getSettings } from './settings-service';

const FALLBACK_FROM = 'Sparx <noreply@sparx.email>';

function buildFrom(fromName: string | null, fromAddress: string | null): string {
  if (!fromAddress) return process.env.SPARX_EMAIL_FROM ?? FALLBACK_FROM;
  return fromName ? `${fromName} <${fromAddress}>` : fromAddress;
}

/** The published body of a Builder email (docs/52 §6). Read straight from the
 *  shared `builder_emails` table (RLS-scoped) — no @sparx/builder dependency, the
 *  same way this service reads broadcasts / templates / segments. Null when the
 *  email doesn't exist or hasn't been published. */
async function loadPublishedBuilderEmail(
  ctx: ServiceContext,
  builderEmailId: string
): Promise<{ tree: BuilderNode; subject: string; preheader: string | null } | null> {
  const row = await withTenant(ctx, (tx) =>
    tx.builderEmail.findUnique({ where: { id: builderEmailId } })
  );
  if (row?.publishedTree == null) return null;
  return {
    tree: row.publishedTree as unknown as BuilderNode,
    subject: row.subject,
    preheader: row.preheader,
  };
}

export async function list(ctx: ServiceContext): Promise<Broadcast[]> {
  return withTenant(ctx, (tx) =>
    tx.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
  );
}

export async function get(ctx: ServiceContext, id: string): Promise<Broadcast> {
  const row = await withTenant(ctx, (tx) => tx.broadcast.findUnique({ where: { id } }));
  if (!row) throw new EmailNotFoundError('Broadcast', id);
  return row;
}

export async function create(
  ctx: ServiceContext,
  rawInput: unknown,
  // The site this broadcast is sent on behalf of (docs/49 Phase 7) — the active
  // site, resolved at the route. null = the tenant's primary brand.
  propertyId: string | null = null
): Promise<Broadcast> {
  const input = CreateBroadcastInput.parse(rawInput);
  const row = await withTenant(ctx, async (tx) => {
    const created = await tx.broadcast.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId,
        name: input.name,
        subject: input.subject,
        preheader: input.preheader ?? null,
        builderEmailId: input.builderEmailId ?? null,
        segmentId: input.segmentId ?? null,
        status: 'draft',
        createdById: ctx.userId ?? null,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'email.broadcast.created',
      entityType: 'Broadcast',
      entityId: created.id,
      diff: { after: { name: created.name } },
    });
    return created;
  });
  await publishEmailEvent({
    tenantId: ctx.tenantId,
    topic: 'email.broadcast.created',
    payload: { broadcastId: row.id },
    dedupeKey: `email.broadcast.created:${row.id}`,
  });
  return row;
}

export async function update(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<Broadcast> {
  const input = UpdateBroadcastInput.parse(rawInput);
  const existing = await get(ctx, id);
  if (existing.status !== 'draft') {
    throw new EmailValidationError('Only draft broadcasts can be edited.');
  }
  return withTenant(ctx, (tx) =>
    tx.broadcast.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        ...(input.preheader !== undefined ? { preheader: input.preheader } : {}),
        ...(input.builderEmailId !== undefined ? { builderEmailId: input.builderEmailId } : {}),
        ...(input.segmentId !== undefined ? { segmentId: input.segmentId } : {}),
      },
    })
  );
}

/** Estimated audience size (segment members). The actual send additionally
 *  removes suppressed addresses. */
export async function estimateRecipients(
  ctx: ServiceContext,
  segmentId: string | null
): Promise<{ count: number }> {
  if (!segmentId) return { count: 0 };
  const count = await withTenant(ctx, (tx) => tx.segmentMember.count({ where: { segmentId } }));
  return { count };
}

// ── Send / schedule ──────────────────────────────────────────────────────

interface Recipient {
  email: string;
  customerId: string | null;
}

async function expandRecipients(ctx: ServiceContext, broadcast: Broadcast): Promise<Recipient[]> {
  if (!broadcast.segmentId) return [];
  return withTenant(ctx, async (tx) => {
    const [members, suppressions] = await Promise.all([
      tx.segmentMember.findMany({
        where: { segmentId: broadcast.segmentId! },
        select: { customerId: true, customer: { select: { email: true, doNotContact: true } } },
      }),
      tx.emailSuppression.findMany({
        where: { scope: { in: ['marketing', 'all'] } },
        select: { email: true },
      }),
    ]);
    const blocked = new Set(suppressions.map((s) => s.email.toLowerCase()));
    const seen = new Set<string>();
    const out: Recipient[] = [];
    for (const m of members) {
      const email = m.customer.email?.toLowerCase();
      if (!email || m.customer.doNotContact || blocked.has(email) || seen.has(email)) continue;
      seen.add(email);
      out.push({ email, customerId: m.customerId });
    }
    return out;
  });
}

async function enqueueAndMark(
  ctx: ServiceContext,
  id: string,
  dueAt: Date,
  finalStatus: 'sent' | 'scheduled',
  resolveEmailData: ResolveEmailData
): Promise<Broadcast> {
  const broadcast = await get(ctx, id);
  if (broadcast.status !== 'draft' && broadcast.status !== 'scheduled') {
    throw new EmailValidationError(`Broadcast is already ${broadcast.status}.`);
  }

  if (!broadcast.builderEmailId) {
    throw new EmailValidationError('Attach a designed email before sending.');
  }

  const [recipients, settings] = await Promise.all([
    expandRecipients(ctx, broadcast),
    getSettings(ctx),
  ]);

  const doc = await loadPublishedBuilderEmail(ctx, broadcast.builderEmailId);
  if (!doc) throw new EmailNotFoundError('BuilderEmail', broadcast.builderEmailId);

  // The body decides the dispatch shape (docs/52 §6):
  //   · per-recipient binding (recipient/order/cart/loyalty) → defer; the dispatch
  //     tick reloads the published tree, resolves THIS recipient's data, renders.
  //   · static / per-send (products/promotion/posts) → resolve once, render once,
  //     fan the same body out as `raw`.
  const personalized = treeIsEmailPersonalized(doc.tree);
  let body: { subject: string; html: string; text: string } | null = null;
  if (!personalized) {
    // Render once, in THIS broadcast's site brand (docs/49 Phase 7) — the site's
    // brand_override merged over the tenant brand; null property → primary brand.
    const [data, brand] = await Promise.all([
      resolveEmailData(doc.tree),
      resolveEmailBrand(ctx, broadcast.propertyId),
    ]);
    const rendered = await renderEmailTree(
      {
        tree: doc.tree,
        to: 'broadcast@example.com',
        subject: broadcast.subject,
        preheader: broadcast.preheader ?? undefined,
        data,
      },
      { brand: brand ?? undefined }
    );
    body = { subject: rendered.subject, html: rendered.html, text: rendered.text };
  }

  const campaignTag = `bcast_${id}`;
  const from = buildFrom(settings.fromName, settings.fromAddress);
  const variables = { broadcast_id: id, campaign: campaignTag };

  const buildPayload = () =>
    personalized
      ? {
          defer: {
            builderEmailId: broadcast.builderEmailId!,
            subject: broadcast.subject,
            ...(broadcast.preheader ? { preheader: broadcast.preheader } : {}),
          },
          from,
          variables,
        }
      : {
          raw: {
            subject: body!.subject,
            html: body!.html,
            text: body!.text,
            templateId: campaignTag,
          },
          from,
          variables,
        };

  const updated = await withTenant(ctx, async (tx) => {
    if (recipients.length > 0) {
      await tx.scheduledSend.createMany({
        data: recipients.map((r) => ({
          tenantId: ctx.tenantId,
          // Carry the broadcast's site so the deferred (personalized) render at the
          // dispatch tick brands per-site too (docs/49 Phase 7).
          propertyId: broadcast.propertyId,
          broadcastId: id,
          recipient: r.email,
          customerId: r.customerId,
          dueAt,
          status: 'pending',
          dedupeKey: `bcast:${id}:${r.email}`,
          payload: buildPayload(),
        })),
        skipDuplicates: true,
      });
    }
    const row = await tx.broadcast.update({
      where: { id },
      data: {
        status: finalStatus,
        recipientCount: recipients.length,
        campaignTag,
        ...(finalStatus === 'sent' ? { sentAt: new Date() } : { scheduledAt: dueAt }),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: finalStatus === 'sent' ? 'email.broadcast.sent' : 'email.broadcast.scheduled',
      entityType: 'Broadcast',
      entityId: id,
      diff: { after: { recipients: recipients.length } },
    });
    return row;
  });

  await publishEmailEvent({
    tenantId: ctx.tenantId,
    topic: finalStatus === 'sent' ? 'email.broadcast.sent' : 'email.broadcast.scheduled',
    payload: { broadcastId: id, recipients: recipients.length },
    dedupeKey: `email.broadcast.${finalStatus}:${id}`,
  });

  return updated;
}

export async function sendNow(
  ctx: ServiceContext,
  id: string,
  resolveEmailData: ResolveEmailData = noEmailDataResolver
): Promise<Broadcast> {
  return enqueueAndMark(ctx, id, new Date(), 'sent', resolveEmailData);
}

export async function schedule(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown,
  resolveEmailData: ResolveEmailData = noEmailDataResolver
): Promise<Broadcast> {
  const { scheduledAt } = ScheduleBroadcastInput.parse(rawInput);
  const dueAt = new Date(scheduledAt);
  if (dueAt.getTime() <= Date.now()) {
    throw new EmailValidationError('Scheduled time must be in the future.');
  }
  return enqueueAndMark(ctx, id, dueAt, 'scheduled', resolveEmailData);
}

export async function cancel(ctx: ServiceContext, id: string): Promise<Broadcast> {
  const broadcast = await get(ctx, id);
  if (broadcast.status !== 'scheduled') {
    throw new EmailValidationError('Only scheduled broadcasts can be cancelled.');
  }
  return withTenant(ctx, async (tx) => {
    await tx.scheduledSend.deleteMany({ where: { broadcastId: id, status: 'pending' } });
    const row = await tx.broadcast.update({ where: { id }, data: { status: 'cancelled' } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'email.broadcast.cancelled',
      entityType: 'Broadcast',
      entityId: id,
      diff: null,
    });
    return row;
  });
}

export interface BroadcastStats {
  accepted: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
}

export async function stats(ctx: ServiceContext, id: string): Promise<BroadcastStats> {
  await get(ctx, id);
  const rows = await withTenant(ctx, (tx) =>
    tx.emailEvent.groupBy({ by: ['type'], where: { broadcastId: id }, _count: { _all: true } })
  );
  const base: BroadcastStats = {
    accepted: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    complained: 0,
    unsubscribed: 0,
  };
  for (const r of rows) {
    if (r.type in base) base[r.type as keyof BroadcastStats] = r._count._all;
  }
  return base;
}
