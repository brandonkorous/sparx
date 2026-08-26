// activityService — the append-only event log (locked decision #3).
//
// `record()` is the single write path. Activities are never UPDATEd; edits
// to an existing note insert a new row with `correctsActivityId` pointing
// at the original. Both consumers (the Phase 2 Pub/Sub subscribers that
// auto-record from order/email/quote events) and humans (notes, calls,
// meetings via the dashboard) come through here, so the audit log and
// `crm.activity.recorded` event emission live in one place.

import { CreateActivityInput, ListActivitiesInput } from '@wizeworks/crm-schemas';
import { withTenant } from '@wizeworks/db';
import type { CrmActivity, Prisma } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import * as leadClock from './lead-clock';

export async function list(ctx: ServiceContext, rawFilter: unknown = {}): Promise<CrmActivity[]> {
  const filter = ListActivitiesInput.parse(rawFilter);
  return withTenant(ctx, (tx) =>
    tx.crmActivity.findMany({
      where: {
        ...(filter.customerId ? { customerId: filter.customerId } : {}),
        ...(filter.dealId ? { dealId: filter.dealId } : {}),
        ...(filter.companyId ? { companyId: filter.companyId } : {}),
        ...(filter.type ? { type: filter.type } : {}),
        ...(filter.since || filter.until
          ? {
              occurredAt: {
                ...(filter.since ? { gte: new Date(filter.since) } : {}),
                ...(filter.until ? { lte: new Date(filter.until) } : {}),
              },
            }
          : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: filter.limit,
    })
  );
}

/**
 * The activity types that mean somebody ACTUALLY GOT BACK TO THEM
 * (docs/152 D2).
 *
 * Deliberately narrow. A `note` is not on this list: writing something down
 * about a person is not answering them, and a clock that stopped on internal
 * activity would measure how busy the desk looks rather than whether the
 * customer heard anything. Neither are `email.opened` / `email.clicked` (that
 * is the customer acting, not us), `email.received` (they wrote to US, which
 * starts a clock rather than stopping one), or `call.missed` — a call nobody
 * answered is the opposite of a response.
 */
const RESPONSE_ACTIVITIES = new Set<string>([
  'email.sent',
  'email.replied',
  'call',
  'call.logged',
  'meeting',
  'meeting.booked',
  'ticket.replied',
]);

export async function record(ctx: ServiceContext, rawInput: unknown): Promise<CrmActivity> {
  const input = CreateActivityInput.parse(rawInput);
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

  const activity = await withTenant(ctx, async (tx) => {
    const created = await tx.crmActivity.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: input.customerId ?? null,
        dealId: input.dealId ?? null,
        companyId: input.companyId ?? null,
        type: input.type,
        description: input.description ?? null,
        actorId: input.actorId ?? ctx.userId ?? null,
        actorType: input.actorType,
        occurredAt,
        linkedEntityType: input.linkedEntityType ?? null,
        linkedEntityId: input.linkedEntityId ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        correctsActivityId: input.correctsActivityId ?? null,
      },
    });

    // Activities are themselves an audit trail; we still write a separate
    // audit_logs row when a human authored the activity so the audit log
    // remains the single forensic surface across modules. Auto-recorded
    // activities (from Pub/Sub consumers) skip the audit-log write — they
    // are already logged at the source event's audit row.
    if (input.actorType === 'staff' && ctx.userId) {
      await writeAuditLog({
        tx,
        tenantId: ctx.tenantId,
        actorId: ctx.userId,
        actorType: 'user',
        action: 'crm.activity.recorded',
        entityType: 'CrmActivity',
        entityId: created.id,
        diff: { after: { type: created.type } },
      });
    }

    return created;
  });

  // Stop the lead response clock, if this was a real response and one was
  // running. Best-effort and after the write: the activity is the record of
  // what happened, and a clock update failing must not lose it.
  if (input.customerId && RESPONSE_ACTIVITIES.has(input.type)) {
    try {
      await leadClock.stopLeadClock(ctx, { customerId: input.customerId, at: occurredAt });
    } catch {
      /* the timeline entry is the thing that matters */
    }
  }

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.activity.recorded',
    payload: {
      activityId: activity.id,
      type: activity.type,
      customerId: activity.customerId,
      dealId: activity.dealId,
      companyId: activity.companyId,
    },
    dedupeKey: `crm.activity.recorded:${activity.id}`,
    occurredAt,
  });

  return activity;
}
