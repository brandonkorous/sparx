// The lead response clock (docs/152 D2).
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
//
// A support desk has had a measurable promise since docs/144 §7.3. A new
// ENQUIRY has not, and that is the expensive gap: an unanswered support ticket
// is an unhappy customer, while an unanswered lead is a sale that went
// somewhere else, quietly, with nothing on any screen to say it happened.
//
// ── AND WHY IT BORROWS THE TICKET SLA'S CALENDAR ─────────────────────────────
//
// The first task of this slice was to check whether the existing SLA policies
// already reached a web lead. They reach one only if it opens a support request
// — a lead that becomes a contact or a deal has no clock. But those policies
// already own the hard part: timezone, weekly pattern, holidays, amber
// threshold, and a pure engine that counts BUSINESS minutes correctly across a
// clock change. So this borrows the calendar and adds one number, rather than
// standing up a second implementation of business-hours arithmetic for the two
// of them to disagree about.

import { withTenant } from '@wizeworks/db';

import type { ServiceContext } from '../errors';
import {
  addBusinessMinutes,
  readClock,
  type BusinessCalendar,
  type SlaClockView,
} from './sla-clock';

/** The policy that governs a new enquiry on this site: the site's own default,
 *  else the tenant-wide one. Null when the business has published no promise. */
async function leadPolicy(
  ctx: ServiceContext,
  propertyId: string | null
): Promise<{
  calendar: BusinessCalendar;
  minutes: number;
  warnAtPercent: number;
} | null> {
  const row = await withTenant(ctx, (tx) =>
    tx.ticketSlaPolicy.findFirst({
      where: {
        tenantId: ctx.tenantId,
        archivedAt: null,
        isDefault: true,
        leadResponseMinutes: { not: null },
        // The site's own promise wins; a tenant-wide policy (propertyId null)
        // is the fallback. Ordering puts the specific one first.
        ...(propertyId ? { OR: [{ propertyId }, { propertyId: null }] } : { propertyId: null }),
      },
      orderBy: { propertyId: { sort: 'asc', nulls: 'last' } },
      select: {
        timezone: true,
        businessHours: true,
        holidays: true,
        warnAtPercent: true,
        leadResponseMinutes: true,
      },
    })
  );
  if (!row?.leadResponseMinutes) return null;
  return {
    calendar: {
      timezone: row.timezone,
      // An empty array means 24/7, which is the schema's own reading of "the
      // business declared no hours" — so a malformed blob degrades to the same
      // thing rather than throwing on a capture path.
      windows: Array.isArray(row.businessHours)
        ? (row.businessHours as unknown as BusinessCalendar['windows'])
        : [],
      holidays: row.holidays.map((d) => d.toISOString().slice(0, 10)),
    },
    minutes: row.leadResponseMinutes,
    warnAtPercent: row.warnAtPercent,
  };
}

/**
 * Start the clock on a newly captured lead.
 *
 * Idempotent and one-way: it only ever writes a due date onto a contact that has
 * none and has not been answered. A lead that comes back through a second form
 * has not reset the promise the business made the first time.
 *
 * Silent when there is no policy — a business that has published no promise
 * about response times is in a normal state, not a broken one, and writing a
 * due date it never agreed to would put every one of its contacts in a queue it
 * did not ask for.
 */
export async function startLeadClock(
  ctx: ServiceContext,
  input: { customerId: string; propertyId: string | null; at?: Date }
): Promise<void> {
  const existing = await withTenant(ctx, (tx) =>
    tx.customer.findUnique({
      where: { id: input.customerId },
      select: { leadResponseDueAt: true, firstRespondedAt: true },
    })
  );
  if (!existing || existing.leadResponseDueAt || existing.firstRespondedAt) return;

  const policy = await leadPolicy(ctx, input.propertyId);
  if (!policy) return;

  const openedAt = input.at ?? new Date();
  const dueAt = addBusinessMinutes(openedAt, policy.minutes, policy.calendar);
  await withTenant(ctx, (tx) =>
    tx.customer.update({
      where: { id: input.customerId },
      data: { leadResponseDueAt: dueAt },
    })
  );
}

/**
 * Stop the clock: somebody got back to them.
 *
 * Called from the outbound touchpoints (a sent email, a logged call, a text) —
 * never from a note, because writing something down about a person is not
 * answering them, and a clock that stops on internal activity measures how busy
 * the desk looks rather than whether the customer heard anything.
 *
 * Only the FIRST response counts, so a long conversation does not keep
 * re-stamping the moment the promise was kept.
 */
export async function stopLeadClock(
  ctx: ServiceContext,
  input: { customerId: string; at?: Date }
): Promise<void> {
  await withTenant(ctx, (tx) =>
    tx.customer.updateMany({
      // The `firstRespondedAt: null` filter IS the idempotency — no read first,
      // and two touchpoints racing cannot move the timestamp.
      where: { id: input.customerId, firstRespondedAt: null },
      data: { firstRespondedAt: input.at ?? new Date() },
    })
  );
}

export interface WaitingLead {
  customerId: string;
  name: string | null;
  email: string | null;
  createdAt: Date;
  dueAt: Date;
  clock: SlaClockView;
}

/**
 * Who is still waiting, soonest deadline first.
 *
 * The whole point of the slice: a list a person can look at BEFORE the promise
 * is missed. Bounded, because a queue nobody can finish is not a queue.
 */
export async function leadsAwaitingResponse(
  ctx: ServiceContext,
  opts: { limit?: number; now?: Date } = {}
): Promise<WaitingLead[]> {
  const now = opts.now ?? new Date();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);

  const rows = await withTenant(ctx, (tx) =>
    tx.customer.findMany({
      where: {
        tenantId: ctx.tenantId,
        firstRespondedAt: null,
        leadResponseDueAt: { not: null },
        deletedAt: null,
      },
      orderBy: { leadResponseDueAt: 'asc' },
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
        leadResponseDueAt: true,
        propertyId: true,
      },
    })
  );
  if (rows.length === 0) return [];

  // One policy read for the warn threshold, not one per row.
  const warnByProperty = new Map<string, number>();
  const out: WaitingLead[] = [];
  for (const row of rows) {
    const key = row.propertyId ?? '';
    if (!warnByProperty.has(key)) {
      const policy = await leadPolicy(ctx, row.propertyId);
      warnByProperty.set(key, policy?.warnAtPercent ?? 80);
    }
    const dueAt = row.leadResponseDueAt;
    if (!dueAt) continue;
    const warnAt = new Date(
      row.createdAt.getTime() +
        (dueAt.getTime() - row.createdAt.getTime()) * ((warnByProperty.get(key) ?? 80) / 100)
    );
    const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || null;
    out.push({
      customerId: row.id,
      name,
      email: row.email,
      createdAt: row.createdAt,
      dueAt,
      clock: readClock(now, dueAt, warnAt, null),
    });
  }
  return out;
}

/** How many are waiting, and how many are already late. Two numbers rather than
 *  one, because "12 waiting" and "12 waiting, 4 of them late" are different
 *  mornings. */
export async function leadResponseCounts(
  ctx: ServiceContext,
  now: Date = new Date()
): Promise<{ waiting: number; late: number }> {
  return withTenant(ctx, async (tx) => {
    const [waiting, late] = await Promise.all([
      tx.customer.count({
        where: {
          tenantId: ctx.tenantId,
          firstRespondedAt: null,
          leadResponseDueAt: { not: null },
          deletedAt: null,
        },
      }),
      tx.customer.count({
        where: {
          tenantId: ctx.tenantId,
          firstRespondedAt: null,
          leadResponseDueAt: { lt: now },
          deletedAt: null,
        },
      }),
    ]);
    return { waiting, late };
  });
}
