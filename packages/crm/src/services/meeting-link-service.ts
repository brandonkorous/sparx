// meetingLinkService — a rep's personal booking link (docs/144 §12).
//
// Scheduling already books. What was missing was the CRM side of it: a link a
// rep can drop into a sales email whose booking lands on the contact's timeline
// instead of only in a calendar nobody else can see.
//
// DELIBERATELY THIN. This owns a slug, whose link it is, and the fact that a
// booking through it is a CRM event. It owns no availability, no duration, no
// buffers, no lead time and no cancellation policy — the SchedulingService owns
// all of that, and duplicating any of it here would give a business two places
// to change one thing and no way to tell which was live.
//
// `recordBooking` is the whole point of the table. Without it this is a prettier
// URL for something scheduling could already do.

import { CreateMeetingLinkInput, UpdateMeetingLinkInput } from '@sparx/crm-schemas';
import { withTenant } from '@sparx/db';
import type { CrmMeetingLink, Prisma } from '@sparx/db';

import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';

export interface ListMeetingLinksFilter {
  userId?: string;
  propertyId?: string | null;
  includeArchived?: boolean;
}

export async function list(
  ctx: ServiceContext,
  filter: ListMeetingLinksFilter = {}
): Promise<CrmMeetingLink[]> {
  const where: Prisma.CrmMeetingLinkWhereInput = {
    ...(filter.includeArchived ? {} : { archivedAt: null }),
    ...(filter.userId ? { userId: filter.userId } : {}),
    ...(filter.propertyId !== undefined
      ? filter.propertyId === null
        ? { propertyId: null }
        : { OR: [{ propertyId: null }, { propertyId: filter.propertyId }] }
      : {}),
  };
  return withTenant(ctx, (tx) => tx.crmMeetingLink.findMany({ where, orderBy: [{ name: 'asc' }] }));
}

export async function get(ctx: ServiceContext, id: string): Promise<CrmMeetingLink> {
  const link = await withTenant(ctx, (tx) => tx.crmMeetingLink.findUnique({ where: { id } }));
  if (!link) throw new CrmNotFoundError('CrmMeetingLink', id);
  return link;
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<CrmMeetingLink> {
  const input = CreateMeetingLinkInput.parse(rawInput);
  const userId = input.userId ?? ctx.userId;
  if (!userId) {
    throw new CrmValidationError('A booking link has to belong to somebody.');
  }

  return withTenant(ctx, async (tx) => {
    const service = await tx.schedulingService.findUnique({ where: { id: input.serviceId } });
    if (!service || service.deletedAt) {
      throw new CrmNotFoundError('SchedulingService', input.serviceId);
    }
    // A link to a service nobody can book online is a link to a dead end, and
    // the person who made it would not find out until a customer told them.
    if (!service.bookableOnline) {
      throw new CrmValidationError(
        `"${service.name}" is not offered for online booking, so a link to it would not work. Turn online booking on for it first.`
      );
    }

    return tx.crmMeetingLink.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: input.propertyId ?? service.propertyId,
        userId,
        serviceId: input.serviceId,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        isActive: input.isActive,
      },
    });
  });
}

export async function update(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<CrmMeetingLink> {
  const input = UpdateMeetingLinkInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const before = await tx.crmMeetingLink.findUnique({ where: { id } });
    if (!before) throw new CrmNotFoundError('CrmMeetingLink', id);

    return tx.crmMeetingLink.update({
      where: { id },
      data: {
        ...(input.serviceId !== undefined ? { serviceId: input.serviceId } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  });
}

/**
 * Retire a link.
 *
 * Archived, not deleted. The link is in sent emails and email signatures that
 * cannot be recalled, and a 404 tells the person clicking it nothing — an
 * archived link can still render "this booking link is no longer in use".
 */
export async function archive(ctx: ServiceContext, id: string): Promise<CrmMeetingLink> {
  return withTenant(ctx, async (tx) => {
    const before = await tx.crmMeetingLink.findUnique({ where: { id } });
    if (!before) throw new CrmNotFoundError('CrmMeetingLink', id);
    return tx.crmMeetingLink.update({
      where: { id },
      data: { archivedAt: new Date(), isActive: false },
    });
  });
}

/** What the public `/meet/<slug>` page needs to render the booking widget. */
export interface PublicMeetingLink {
  id: string;
  name: string;
  description: string | null;
  serviceId: string;
  hostName: string;
  durationMinutes: number;
  timezone: string | null;
  active: boolean;
}

/** Resolve a public slug. Returns an INACTIVE link rather than nothing, so the
 *  page can say what happened instead of showing a generic 404. */
export async function bySlug(
  ctx: ServiceContext,
  slug: string,
  propertyId: string | null = null
): Promise<PublicMeetingLink | null> {
  const row = await withTenant(ctx, (tx) =>
    tx.crmMeetingLink.findFirst({
      where: {
        slug,
        ...(propertyId ? { OR: [{ propertyId }, { propertyId: null }] } : {}),
      },
      include: {
        service: { select: { id: true, durationMinutes: true, deletedAt: true } },
        user: { select: { name: true, email: true } },
      },
      // A site-specific link wins over the tenant-wide one with the same slug.
      orderBy: { propertyId: { sort: 'desc', nulls: 'last' } },
    })
  );
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    serviceId: row.serviceId,
    hostName: row.user.name ?? row.user.email ?? '',
    durationMinutes: row.service.durationMinutes,
    timezone: null,
    active: row.isActive && row.archivedAt === null && row.service.deletedAt === null,
  };
}

/**
 * A booking came in through this link.
 *
 * Called by the public booking route AFTER scheduling has created the booking,
 * not instead of it — this adds the CRM meaning, it does not take the booking.
 *
 * The activity is what the whole feature exists for: it is why a rep's colleague
 * can look at a contact and see that a meeting was booked, rather than having to
 * ask whose calendar it went into.
 */
export async function recordBooking(
  ctx: ServiceContext,
  args: { linkId: string; bookingId: string; customerId: string | null; startAt: Date }
): Promise<void> {
  const link = await withTenant(ctx, async (tx) => {
    const found = await tx.crmMeetingLink.findUnique({
      where: { id: args.linkId },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!found) throw new CrmNotFoundError('CrmMeetingLink', args.linkId);

    await tx.booking.update({
      where: { id: args.bookingId },
      data: { meetingLinkId: found.id, source: 'meeting_link' },
    });

    await tx.crmMeetingLink.update({
      where: { id: found.id },
      data: { bookingCount: { increment: 1 } },
    });

    if (args.customerId) {
      await tx.crmActivity.create({
        data: {
          tenantId: ctx.tenantId,
          type: 'meeting.booked',
          customerId: args.customerId,
          description: `Booked ${found.name} with ${found.user.name ?? found.user.email ?? 'the team'} for ${args.startAt.toISOString().slice(0, 16).replace('T', ' ')}`,
          // The CUSTOMER did this, not a member of staff — they clicked the link.
          actorType: 'customer',
          occurredAt: new Date(),
          linkedEntityType: 'booking',
          linkedEntityId: args.bookingId,
          metadata: { meetingLinkId: found.id },
        },
      });
    }

    return found;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.meeting.booked',
    payload: { meetingLinkId: link.id, bookingId: args.bookingId, customerId: args.customerId },
    dedupeKey: `crm.meeting.booked:${args.bookingId}`,
  });
}
