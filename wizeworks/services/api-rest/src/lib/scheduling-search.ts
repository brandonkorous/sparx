// Search signals for the Bookings and team records (persona issue 261).
//
// `@wizeworks/scheduling` and `@wizeworks/staff` cannot publish events (neither
// depends on `@wizeworks/events`), so every caller of their writes signals from
// here, after the service call has committed. The indexer reads each row back,
// so one upsert covers create, rename, archive, restore and delete alike.
//
// A bookable resource and a person on the team are one roster (issue 120): the
// scheduling package creates or renames the PERSON as a side effect of writing a
// staff resource, and the caller never sees that id. `signalResource` looks the
// person up, so a stylist added under Bookings is findable by name under the
// team too.

import { withTenant, type TxClient } from '@wizeworks/db';
import { indexEntity } from '@wizeworks/events';
import { bootstrapSchedulingDefaults } from '@wizeworks/scheduling';

interface Who {
  tenantId: string;
  actorId?: string | null;
}

/** Only the two fields the event carries; callers pass a whole auth context. */
function by(who: Who): { tenantId: string; actorId: string | null } {
  return { tenantId: who.tenantId, actorId: who.actorId ?? null };
}

export function signalSchedulingService(who: Who, id: string): Promise<void> {
  return indexEntity({ ...by(who), entityType: 'scheduling_service', recordId: id });
}

export function signalSchedulingLocation(who: Who, id: string): Promise<void> {
  return indexEntity({ ...by(who), entityType: 'scheduling_location', recordId: id });
}

export function signalBookingPolicy(who: Who, id: string): Promise<void> {
  return indexEntity({ ...by(who), entityType: 'booking_policy', recordId: id });
}

export function signalStaffMember(who: Who, id: string): Promise<void> {
  return indexEntity({ ...by(who), entityType: 'staff_member', recordId: id });
}

/** The resource, and the person on the roster it belongs to, if any. */
export async function signalResource(who: Who, resourceId: string): Promise<void> {
  await indexEntity({ ...by(who), entityType: 'scheduling_resource', recordId: resourceId });
  const person = await withTenant({ tenantId: who.tenantId }, (tx: TxClient) =>
    tx.staffMember.findFirst({ where: { resourceId }, select: { id: true } })
  );
  if (person) await signalStaffMember(who, person.id);
}

/**
 * Run the Bookings activation defaults and signal what they created.
 *
 * `bootstrapSchedulingDefaults` seeds a policy and a place only into an EMPTY
 * module and returns nothing, so the rows it made are the ones that exist now
 * where none did before. Counting first keeps the six-hourly reconcile from
 * re-signaling every tenant's places on every pass.
 */
export async function bootstrapSchedulingDefaultsIndexed(tenantId: string): Promise<void> {
  const before = await withTenant({ tenantId }, async (tx) => ({
    policies: await tx.bookingPolicy.count(),
    locations: await tx.businessLocation.count(),
  }));
  await bootstrapSchedulingDefaults(tenantId);
  if (before.policies > 0 && before.locations > 0) return;

  const seeded = await withTenant({ tenantId }, async (tx) => ({
    policies: before.policies > 0 ? [] : await tx.bookingPolicy.findMany({ select: { id: true } }),
    locations:
      before.locations > 0 ? [] : await tx.businessLocation.findMany({ select: { id: true } }),
  }));
  for (const row of seeded.policies) await signalBookingPolicy({ tenantId }, row.id);
  for (const row of seeded.locations) await signalSchedulingLocation({ tenantId }, row.id);
}
