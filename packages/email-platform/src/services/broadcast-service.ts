// broadcastService — segment-targeted marketing campaigns.
//
// A broadcast renders ONCE (authored template → branded email) and fans out to
// every segment member minus suppressions. Send + schedule both enqueue a
// per-recipient ScheduledSend with a pre-rendered "raw" body; the shared
// email-dispatch tick delivers them (immediately for send, at scheduledAt for
// schedule), so scheduling needs no separate worker. Cancel removes pending
// rows. Stats aggregate EmailEvent rows joined by the broadcast_id variable the
// webhook stamps back.

import { withTenant } from '@sparx/db';
import type { Broadcast, EmailTemplate } from '@sparx/db';
import { renderEmailTree, renderSections } from '@sparx/email';
import { bodyIsPersonalized, normalizeBody } from '@sparx/email-sections';
import type { BuilderNode } from '@sparx/builder-schemas';

import { writeAuditLog } from '../audit';
import { publishEmailEvent } from '../events';
import { EmailNotFoundError, EmailValidationError, type ServiceContext } from '../errors';
import { makeStaticResolver, type ResolveSectionData } from './template-service';
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

/** Resolve a published Builder email's body tree (+ its own subject/preheader) by
 *  id, or null when it hasn't been published (docs/52 §6). Injected by the caller
 *  (api-rest loads it from @sparx/builder's emailService) so this package keeps no
 *  @sparx/builder dependency — the same injection pattern as ResolveSectionData. */
export type ResolveBuilderEmail = (
  builderEmailId: string
) => Promise<{ tree: BuilderNode; subject: string; preheader: string | null } | null>;

const noBuilderEmailResolver: ResolveBuilderEmail = () => {
  throw new EmailValidationError('Designed-email broadcasts are not available from this caller.');
};

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

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<Broadcast> {
  const input = CreateBroadcastInput.parse(rawInput);
  const row = await withTenant(ctx, async (tx) => {
    const created = await tx.broadcast.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        subject: input.subject,
        preheader: input.preheader ?? null,
        templateId: input.templateId ?? null,
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
        ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
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

async function renderBody(
  ctx: ServiceContext,
  broadcast: Broadcast,
  resolveData: ResolveSectionData
): Promise<{ subject: string; html: string; text: string }> {
  if (!broadcast.templateId) {
    throw new EmailValidationError('Attach a template before sending.');
  }
  const template = await withTenant(ctx, (tx) =>
    tx.emailTemplate.findUnique({ where: { id: broadcast.templateId! } })
  );
  if (template?.source !== 'authored') {
    throw new EmailNotFoundError('EmailTemplate', broadcast.templateId);
  }
  // Render ONCE (no recipient) — broadcasts fan out the same body. Personalized
  // sections render empty here and omit themselves; per-recipient broadcasts
  // land with the personalization pipeline (docs/31 §7, P5).
  const { sections } = normalizeBody(template.body);
  const data = await resolveData(sections);
  const brand = (await resolveEmailBrand(ctx)) ?? undefined;
  const rendered = await renderSections(
    {
      sections,
      to: 'broadcast@example.com',
      subject: broadcast.subject,
      preheader: broadcast.preheader ?? undefined,
      data,
    },
    { brand }
  );
  return { subject: rendered.subject, html: rendered.html, text: rendered.text };
}

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
  resolveData: ResolveSectionData,
  resolveBuilderEmail: ResolveBuilderEmail
): Promise<Broadcast> {
  const broadcast = await get(ctx, id);
  if (broadcast.status !== 'draft' && broadcast.status !== 'scheduled') {
    throw new EmailValidationError(`Broadcast is already ${broadcast.status}.`);
  }

  const usingBuilderEmail = Boolean(broadcast.builderEmailId);
  if (!usingBuilderEmail && !broadcast.templateId) {
    throw new EmailValidationError('Attach a template or a designed email before sending.');
  }

  const [recipients, settings] = await Promise.all([
    expandRecipients(ctx, broadcast),
    getSettings(ctx),
  ]);

  // The body source decides the dispatch shape:
  //   · Builder email — render the published TREE once (static; docs/52 §6) → raw.
  //   · authored template — personalized sections defer per recipient (docs/31 §7);
  //     otherwise render once → raw.
  let personalized = false;
  let deferTemplateId: string | null = null;
  let body: { subject: string; html: string; text: string } | null = null;

  if (usingBuilderEmail) {
    const doc = await resolveBuilderEmail(broadcast.builderEmailId!);
    if (!doc) throw new EmailNotFoundError('BuilderEmail', broadcast.builderEmailId!);
    const brand = (await resolveEmailBrand(ctx)) ?? undefined;
    const rendered = await renderEmailTree(
      {
        tree: doc.tree,
        to: 'broadcast@example.com',
        subject: broadcast.subject,
        preheader: broadcast.preheader ?? undefined,
      },
      { brand }
    );
    body = { subject: rendered.subject, html: rendered.html, text: rendered.text };
  } else {
    const template = await withTenant(ctx, (tx) =>
      tx.emailTemplate.findUnique({ where: { id: broadcast.templateId! } })
    );
    if (template?.source !== 'authored') {
      throw new EmailNotFoundError('EmailTemplate', broadcast.templateId!);
    }
    personalized = bodyIsPersonalized(normalizeBody(template.body));
    deferTemplateId = template.id;
    body = personalized ? null : await renderBody(ctx, broadcast, resolveData);
  }

  const campaignTag = `bcast_${id}`;
  const from = buildFrom(settings.fromName, settings.fromAddress);
  const variables = { broadcast_id: id, campaign: campaignTag };

  const buildPayload = () =>
    personalized
      ? {
          defer: {
            templateId: deferTemplateId!,
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
  resolveData: ResolveSectionData = makeStaticResolver(ctx),
  resolveBuilderEmail: ResolveBuilderEmail = noBuilderEmailResolver
): Promise<Broadcast> {
  return enqueueAndMark(ctx, id, new Date(), 'sent', resolveData, resolveBuilderEmail);
}

export async function schedule(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown,
  resolveData: ResolveSectionData = makeStaticResolver(ctx),
  resolveBuilderEmail: ResolveBuilderEmail = noBuilderEmailResolver
): Promise<Broadcast> {
  const { scheduledAt } = ScheduleBroadcastInput.parse(rawInput);
  const dueAt = new Date(scheduledAt);
  if (dueAt.getTime() <= Date.now()) {
    throw new EmailValidationError('Scheduled time must be in the future.');
  }
  return enqueueAndMark(ctx, id, dueAt, 'scheduled', resolveData, resolveBuilderEmail);
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

// Re-export so callers don't need the EmailTemplate type to type a list row.
export type { EmailTemplate };
