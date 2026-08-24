// A bookable PERSON is a person on the roster. There is only one roster.
//
// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
//
// A salon set two stylists up under Bookings, both marked Staff, and both showed
// by name on every booking form and every calendar column. The till's "who sold
// this" panel then told her: "Nobody is on your team yet. Add people under Your
// team, and they will appear here." Two statements, each true of its own table,
// and the screen was false about the business (issue 120).
//
// `scheduling_resources` (kind='staff') and `staff_members` were two tables
// holding one fact, and nothing ever wrote both. The data model always said they
// were one person — `StaffMember.resourceId` has pointed at the bookable
// resource since the module was designed, and its own header says the point of
// the record is to BE the person the other modules already point at. Only the
// write path was missing.
//
// So: creating a staff resource creates the person, and the two names stay in
// step while nobody has deliberately pulled them apart.
//
// ── WHY IT WRITES ANOTHER MODULE'S TABLE ────────────────────────────────────
//
// `StaffMember.resourceId` is a plain uuid with no foreign key, on purpose, so a
// tenant running staff without scheduling (or the reverse) is an ordinary tenant
// rather than a special case. That deliberate looseness means neither package
// depends on the other, and adding a dependency between two feature modules to
// carry one invariant would buy a cycle risk for nothing. Both already share one
// Prisma client, and the pairing is confined to this file.

import { withTenant, type TxClient } from '@wizeworks/db';

import { StaffMemberMissingError } from './errors';

/** The kind of resource that is a human being. The other kinds — a room, a bay,
 *  a machine — are things, and a thing does not go on the roster. */
const STAFF = 'staff';

/**
 * A typed name into the two columns the roster has.
 *
 * First token is the given name, the remainder the family name — a convention,
 * not a truth, so a single word goes entirely in `firstName` rather than being
 * invented a surname.
 */
function splitName(name: string): { firstName: string; lastName: string | null } {
  const trimmed = name.trim();
  const gap = trimmed.indexOf(' ');
  if (gap === -1) return { firstName: trimmed, lastName: null };
  return { firstName: trimmed.slice(0, gap), lastName: trimmed.slice(gap + 1).trim() || null };
}

function fullName(person: { firstName: string; lastName: string | null }): string {
  return [person.firstName, person.lastName].filter(Boolean).join(' ');
}

/**
 * Give a newly created staff resource its place on the roster.
 *
 * Idempotent: a resource that already has somebody pointing at it is left alone,
 * so this is safe to call from every create path and safe to re-run.
 *
 * Never throws into the caller's transaction over a name — a bookable resource
 * that could not be paired is still a working bookable resource, and failing the
 * booking setup because the roster complained would be the wrong trade.
 */
export async function addToRoster(
  tx: TxClient,
  tenantId: string,
  resource: { id: string; kind: string; name: string; color: string | null }
): Promise<void> {
  if (resource.kind !== STAFF) return;

  const already = await tx.staffMember.findFirst({
    where: { resourceId: resource.id },
    select: { id: true },
  });
  if (already) return;

  const { firstName, lastName } = splitName(resource.name);
  if (!firstName) return;

  const person = await tx.staffMember.create({
    data: {
      tenantId,
      firstName,
      lastName,
      resourceId: resource.id,
      // Their chip color on the schedule is the same chip. Null stays null: the
      // palette assigns one on first render, and copying a null across says the
      // same "nobody chose" the resource is saying.
      color: resource.color,
    },
    select: { id: true },
  });

  const sites = await rosterSites(tx, resource.id);
  if (sites.length > 0) {
    await tx.staffMemberSite.createMany({
      data: sites.map((site) => ({ tenantId, staffMemberId: person.id, ...site })),
    });
  }
}

/**
 * Which sites the new person works for, mirroring the resource they came from.
 *
 * The two tables read an empty list in OPPOSITE directions, and that is the trap
 * here: a resource with no site links works EVERY site, while a person with no
 * site links matches no site-scoped roster at all. So "everywhere" has to be
 * written out as every site rather than copied across as nothing — otherwise the
 * person exists and the roster that is filtered to a site cannot see them, which
 * is the same invisibility issue 120 is about.
 */
async function rosterSites(
  tx: TxClient,
  resourceId: string
): Promise<{ propertyId: string; isPrimary: boolean }[]> {
  const scoped = await tx.schedulingResourceProperty.findMany({
    where: { resourceId },
    select: { propertyId: true },
  });
  const ids =
    scoped.length > 0
      ? scoped.map((row) => row.propertyId)
      : (
          await tx.property.findMany({
            select: { id: true },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          })
        ).map((row) => row.id);
  // Their cost lands against the first one when a time entry names none of its
  // own; a person always has somewhere it lands.
  return ids.map((propertyId, index) => ({ propertyId, isPrimary: index === 0 }));
}

/**
 * Keep the person's name in step when the resource is renamed.
 *
 * ONLY while the two still agree. If somebody has edited the person under My
 * Team — given them a surname, corrected a spelling, recorded the name they
 * actually go by — those two records have been deliberately pulled apart, and a
 * rename in Bookings must not quietly undo it. Proving that intent is the same
 * discipline a backfill uses: change what nobody has touched, and nothing else.
 */
export async function renameOnRoster(
  tx: TxClient,
  resourceId: string,
  previousName: string,
  nextName: string
): Promise<void> {
  if (previousName === nextName) return;

  const person = await tx.staffMember.findFirst({
    where: { resourceId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!person || fullName(person) !== previousName) return;

  const { firstName, lastName } = splitName(nextName);
  if (!firstName) return;
  await tx.staffMember.update({ where: { id: person.id }, data: { firstName, lastName } });
}

/**
 * Offer somebody on the roster for appointments — the same pairing, from the
 * other side.
 *
 * This is the direction that makes the roster ONE roster rather than two lists
 * that happen to agree. Without it, My Team can name a person the booking form
 * has never heard of, and somebody has to type them in twice.
 *
 * Idempotent, and it REVIVES rather than duplicates: a person whose resource was
 * switched off gets that one back on, so a stylist who came off the rota and
 * later returned keeps their availability, their color and their history
 * instead of arriving as a stranger with the same name.
 */
export async function makeBookable(
  tx: TxClient,
  tenantId: string,
  person: { id: string; firstName: string; lastName: string | null; color: string | null },
  where: { locationId?: string | null; propertyIds?: string[] } = {}
): Promise<string> {
  const existing = await tx.staffMember.findFirst({
    where: { id: person.id },
    select: { resourceId: true },
  });
  const linked = existing?.resourceId
    ? await tx.schedulingResource.findFirst({
        where: { id: existing.resourceId, deletedAt: null },
        select: { id: true },
      })
    : null;

  if (linked) {
    await tx.schedulingResource.update({ where: { id: linked.id }, data: { isActive: true } });
    return linked.id;
  }

  const resource = await tx.schedulingResource.create({
    data: {
      tenantId,
      kind: STAFF,
      name: fullName(person),
      color: person.color,
      locationId: where.locationId ?? null,
      // No links means every site, the same "no rows = everywhere" default the
      // rest of the platform uses. A person who works both of an owner's
      // businesses is the ordinary case, not the exception.
      ...(where.propertyIds && where.propertyIds.length > 0
        ? { siteLinks: { create: where.propertyIds.map((propertyId) => ({ propertyId })) } }
        : {}),
    },
    select: { id: true },
  });
  await tx.staffMember.update({
    where: { id: person.id },
    data: { resourceId: resource.id },
  });
  return resource.id;
}

/**
 * Stop offering them for appointments. They stay on the roster, and the link
 * stays with them.
 *
 * Switched OFF rather than deleted, and deliberately: somebody who steps off the
 * rota for a season is not somebody who was never here, and their past bookings
 * still point at this resource. Turning it back on is one press.
 */
export async function stopBookable(tx: TxClient, staffMemberId: string): Promise<void> {
  const person = await tx.staffMember.findFirst({
    where: { id: staffMemberId },
    select: { resourceId: true },
  });
  if (!person?.resourceId) return;
  await tx.schedulingResource.updateMany({
    where: { id: person.resourceId },
    data: { isActive: false },
  });
}

/**
 * Which of these bookable records are actually on offer right now.
 *
 * The roster stores a LINK, and a link is not an answer: a person whose resource
 * has been switched off or removed still carries the id of it. Asking the
 * resource is the only way to say "bookable" without guessing, and a screen that
 * guessed would show an appointments toggle that does nothing.
 *
 * One query for a whole roster, not one per row.
 */
export async function bookableResourceIds(
  tenantId: string,
  resourceIds: string[]
): Promise<Set<string>> {
  const wanted = resourceIds.filter(Boolean);
  if (wanted.length === 0) return new Set();
  return withTenant({ tenantId }, async (tx) => {
    const rows = await tx.schedulingResource.findMany({
      where: { id: { in: wanted }, kind: STAFF, isActive: true, deletedAt: null },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  });
}

/** The bookable toggle on a person, as one call. Returns their resource id when
 *  they are on offer, and null when they are not. */
export async function setBookable(
  tenantId: string,
  staffMemberId: string,
  on: boolean,
  where: { locationId?: string | null; propertyIds?: string[] } = {}
): Promise<string | null> {
  return withTenant({ tenantId }, async (tx) => {
    const person = await tx.staffMember.findFirst({
      where: { id: staffMemberId },
      select: { id: true, firstName: true, lastName: true, color: true },
    });
    if (!person) throw new StaffMemberMissingError(staffMemberId);
    if (!on) {
      await stopBookable(tx, staffMemberId);
      return null;
    }
    return makeBookable(tx, tenantId, person, where);
  });
}
