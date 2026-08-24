// The roster — the person, and the businesses they work for.
//
// `StaffMember` LINKS, it does not absorb (docs/149 locked decision #2). `Member`
// keeps owning login and access; `SchedulingResource` keeps owning bookability
// and availability. Both links are plain uuids with no foreign key, so a tenant
// running staff with neither auth seats nor scheduling is a perfectly ordinary
// tenant rather than a special case.
//
// AND A STAFF MEMBER DOES NOT REQUIRE A LOGIN. The shop-floor tech who never
// opens the workbench still has hours, a rate and certifications, and is very
// often the person whose labour cost matters most.

import { withTenant, type TxClient } from '@wizeworks/db';
import { StaffMemberNotFoundError } from './errors.js';

export type EmploymentType = 'employee' | 'contractor' | 'volunteer';
export type StaffStatus = 'active' | 'onboarding' | 'suspended' | 'former';

export interface StaffMemberInput {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  employmentType?: EmploymentType;
  status?: StaffStatus;
  startedOn?: Date | null;
  endedOn?: Date | null;
  userId?: string | null;
  resourceId?: string | null;
  externalPayrollId?: string | null;
  color?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  /** Full replacement of the site links. The first is treated as primary unless
   *  one is flagged — a person always has somewhere their cost lands. */
  siteIds?: string[];
  primarySiteId?: string | null;
}

const DETAIL_INCLUDE = {
  siteLinks: true,
  payRates: { orderBy: { effectiveFrom: 'desc' } },
  certifications: { orderBy: { expiresOn: 'asc' } },
  documents: { orderBy: { createdAt: 'desc' } },
} as const;

export interface ListMembersQuery {
  status?: StaffStatus;
  propertyId?: string;
  /** Matches first or last name, case-insensitively. */
  search?: string;
  includeArchived?: boolean;
}

export async function listMembers(tenantId: string, query: ListMembersQuery = {}) {
  return withTenant({ tenantId }, (tx) =>
    tx.staffMember.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.includeArchived ? {} : { archivedAt: null }),
        ...(query.propertyId ? { siteLinks: { some: { propertyId: query.propertyId } } } : {}),
        ...(query.search
          ? {
              OR: [
                { firstName: { contains: query.search, mode: 'insensitive' as const } },
                { lastName: { contains: query.search, mode: 'insensitive' as const } },
                { jobTitle: { contains: query.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: DETAIL_INCLUDE,
      // Status first so the people who are actually here sort above the leavers,
      // then by surname — a roster is read the way a list of people is read.
      orderBy: [{ status: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    })
  );
}

export async function getMember(tenantId: string, id: string) {
  const member = await withTenant({ tenantId }, (tx) =>
    tx.staffMember.findFirst({ where: { id }, include: DETAIL_INCLUDE })
  );
  if (!member) throw new StaffMemberNotFoundError(id);
  return member;
}

export async function createMember(tenantId: string, input: StaffMemberInput, tx?: TxClient) {
  const run = async (client: TxClient) => {
    const member = await client.staffMember.create({
      data: {
        tenantId,
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        jobTitle: input.jobTitle ?? null,
        employmentType: input.employmentType ?? 'employee',
        status: input.status ?? 'active',
        startedOn: input.startedOn ?? null,
        endedOn: input.endedOn ?? null,
        userId: input.userId ?? null,
        resourceId: input.resourceId ?? null,
        externalPayrollId: input.externalPayrollId ?? null,
        color: input.color ?? null,
        photoUrl: input.photoUrl ?? null,
        notes: input.notes ?? null,
      },
    });
    await replaceSiteLinks(client, tenantId, member.id, input);
    return client.staffMember.findFirstOrThrow({
      where: { id: member.id },
      include: DETAIL_INCLUDE,
    });
  };
  return tx ? run(tx) : withTenant({ tenantId }, run);
}

export async function updateMember(
  tenantId: string,
  id: string,
  input: Partial<StaffMemberInput>,
  tx?: TxClient
) {
  const run = async (client: TxClient) => {
    const existing = await client.staffMember.findFirst({ where: { id } });
    if (!existing) throw new StaffMemberNotFoundError(id);

    await client.staffMember.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
        ...(input.employmentType !== undefined ? { employmentType: input.employmentType } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.startedOn !== undefined ? { startedOn: input.startedOn } : {}),
        ...(input.endedOn !== undefined ? { endedOn: input.endedOn } : {}),
        ...(input.userId !== undefined ? { userId: input.userId } : {}),
        ...(input.resourceId !== undefined ? { resourceId: input.resourceId } : {}),
        ...(input.externalPayrollId !== undefined
          ? { externalPayrollId: input.externalPayrollId }
          : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    if (input.siteIds !== undefined || input.primarySiteId !== undefined) {
      await replaceSiteLinks(client, tenantId, id, input);
    }
    return client.staffMember.findFirstOrThrow({ where: { id }, include: DETAIL_INCLUDE });
  };
  return tx ? run(tx) : withTenant({ tenantId }, run);
}

/**
 * Archive rather than delete.
 *
 * Their hours are in last year's profit figure. Deleting the person would leave
 * that number unexplainable — an expense filed against nobody — so the roster
 * hides them and the history keeps its subject. A genuine delete is available in
 * `deleteMember` for a record created by mistake.
 */
export async function archiveMember(tenantId: string, id: string) {
  return withTenant({ tenantId }, (tx) =>
    tx.staffMember.update({
      where: { id },
      data: { archivedAt: new Date(), status: 'former' },
      include: DETAIL_INCLUDE,
    })
  );
}

export async function restoreMember(tenantId: string, id: string) {
  return withTenant({ tenantId }, (tx) =>
    tx.staffMember.update({
      where: { id },
      data: { archivedAt: null, status: 'active' },
      include: DETAIL_INCLUDE,
    })
  );
}

/** A hard delete, for a record created in error. Cascades take their time,
 *  shifts and documents with them; derived wage expenses are NOT removed,
 *  because they are the finance module's rows and deleting spend is a decision
 *  the owner makes on the spending screen, not a side effect of tidying a roster. */
export async function deleteMember(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, (tx) => tx.staffMember.delete({ where: { id } }));
}

/**
 * Replace the site links wholesale.
 *
 * Exactly one link is primary whenever there is at least one link — the primary
 * is where a cost lands when a time entry names no site, so "none of them" would
 * quietly send that person's wages to the unattributed bucket forever.
 */
async function replaceSiteLinks(
  client: TxClient,
  tenantId: string,
  staffMemberId: string,
  input: Partial<StaffMemberInput>
): Promise<void> {
  const siteIds = input.siteIds;
  if (siteIds === undefined) {
    if (input.primarySiteId === undefined) return;
    // Only the primary moved: flip the flags in place rather than rebuilding.
    const links = await client.staffMemberSite.findMany({ where: { staffMemberId } });
    for (const link of links) {
      await client.staffMemberSite.update({
        where: { id: link.id },
        data: { isPrimary: link.propertyId === input.primarySiteId },
      });
    }
    return;
  }

  await client.staffMemberSite.deleteMany({ where: { staffMemberId } });

  // NOBODY IS NOWHERE. An empty list means every business, never none.
  //
  // The roster is read site-scoped (`siteLinks: { some: ... }`), so a person
  // with no links matches nothing and disappears from the very screen they were
  // just added to. That is not a corner case: an owner with ONE business is
  // never shown the site picker at all — there is no choice to make — so their
  // form sends an empty list every time, and every person they added vanished
  // on save while still existing everywhere else in the product.
  const ids = siteIds.length > 0 ? siteIds : await everySite(client);
  if (ids.length === 0) return;

  const primary =
    input.primarySiteId && ids.includes(input.primarySiteId) ? input.primarySiteId : ids[0];
  await client.staffMemberSite.createMany({
    data: ids.map((propertyId) => ({
      tenantId,
      staffMemberId,
      propertyId,
      isPrimary: propertyId === primary,
    })),
  });
}

/** Every business this tenant runs, the main one first — so the person's cost
 *  lands there when a shift names none. */
async function everySite(client: TxClient): Promise<string[]> {
  const rows = await client.property.findMany({
    select: { id: true },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });
  return rows.map((row) => row.id);
}
