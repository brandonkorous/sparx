// Resource setup CRUD (staff / assets / tables / spaces / equipment). Soft-delete
// so historical bookings keep a valid resource reference.

import type { Prisma } from '@wizeworks/db';
import { withTenant, type SchedulingResource } from '@wizeworks/db';
import type { CreateResourceInput, UpdateResourceInput } from '@wizeworks/scheduling-schemas';

import { ResourceNotFoundError } from './errors';
import { addToRoster, renameOnRoster } from './roster';

export async function createResource(
  tenantId: string,
  input: CreateResourceInput
): Promise<SchedulingResource> {
  return withTenant({ tenantId }, async (tx) => {
    const created = await tx.schedulingResource.create({
      data: {
        tenantId,
        kind: input.kind,
        userId: input.userId ?? null,
        locationId: input.locationId ?? null,
        name: input.name,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        color: input.color ?? null,
        timezone: input.timezone,
        exclusive: input.exclusive,
        capacity: input.capacity,
        capacityMin: input.capacityMin ?? null,
        capacityMax: input.capacityMax ?? null,
        skillTags: input.skillTags,
        bookableOnline: input.bookableOnline,
        isActive: input.isActive,
        settings: (input.settings ?? {}) as Prisma.InputJsonValue,
        // Model B site scope. An EMPTY list writes no rows, which is what makes the
        // resource work every site — the same "no rows = everywhere" default products,
        // categories and collections use.
        ...(input.propertyIds.length > 0
          ? { siteLinks: { create: input.propertyIds.map((propertyId) => ({ propertyId })) } }
          : {}),
      },
    });
    // A staff resource is a PERSON, and a business has one roster (issue 120).
    await addToRoster(tx, tenantId, created);
    return created;
  });
}

export async function updateResource(
  tenantId: string,
  input: UpdateResourceInput
): Promise<SchedulingResource> {
  // `propertyIds` is a junction, not a column — it must never reach `data`, and an
  // OMITTED one means "leave the scope alone" rather than "clear it".
  const { id, settings, propertyIds, ...rest } = input;
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.schedulingResource.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new ResourceNotFoundError(id);
    if (propertyIds !== undefined) {
      // Replace-all: the caller sends the full set it wants, so a site removed from
      // the list is unlinked. Delete-then-create inside the same tenant transaction.
      await tx.schedulingResourceProperty.deleteMany({ where: { resourceId: id } });
      if (propertyIds.length > 0) {
        await tx.schedulingResourceProperty.createMany({
          data: propertyIds.map((propertyId) => ({ resourceId: id, propertyId })),
          skipDuplicates: true,
        });
      }
    }
    const updated = await tx.schedulingResource.update({
      where: { id },
      data: {
        ...rest,
        ...(settings !== undefined ? { settings: settings as Prisma.InputJsonValue } : {}),
      },
    });
    // Renaming the bookable thing renames the person, while the two still agree.
    if (updated.kind === 'staff') {
      await renameOnRoster(tx, id, existing.name, updated.name);
    }
    return updated;
  });
}

/** The sites a resource is scoped to — empty means it works every site. Read
 *  separately from the row itself so `SchedulingResource` stays the plain model the
 *  rest of the package passes around. */
export async function getResourcePropertyIds(tenantId: string, id: string): Promise<string[]> {
  return withTenant({ tenantId }, async (tx) => {
    const links = await tx.schedulingResourceProperty.findMany({
      where: { resourceId: id },
      select: { propertyId: true },
    });
    return links.map((l) => l.propertyId);
  });
}

/** Site scope for MANY resources at once — one query for a list response, rather
 *  than one per row. Resources with no links are absent from the map (= everywhere). */
export async function getResourcePropertyIdsFor(
  tenantId: string,
  ids: string[]
): Promise<Map<string, string[]>> {
  if (ids.length === 0) return new Map();
  return withTenant({ tenantId }, async (tx) => {
    const links = await tx.schedulingResourceProperty.findMany({
      where: { resourceId: { in: ids } },
      select: { resourceId: true, propertyId: true },
    });
    const byResource = new Map<string, string[]>();
    for (const l of links) {
      const list = byResource.get(l.resourceId) ?? [];
      list.push(l.propertyId);
      byResource.set(l.resourceId, list);
    }
    return byResource;
  });
}

export async function getResource(tenantId: string, id: string): Promise<SchedulingResource> {
  return withTenant({ tenantId }, async (tx) => {
    const res = await tx.schedulingResource.findFirst({ where: { id, deletedAt: null } });
    if (!res) throw new ResourceNotFoundError(id);
    return res;
  });
}

export async function listResources(
  tenantId: string,
  opts: { kind?: string; locationId?: string; activeOnly?: boolean; propertyIds?: string[] } = {}
): Promise<SchedulingResource[]> {
  return withTenant({ tenantId }, (tx) =>
    tx.schedulingResource.findMany({
      where: {
        deletedAt: null,
        ...(opts.kind ? { kind: opts.kind } : {}),
        ...(opts.locationId ? { locationId: opts.locationId } : {}),
        ...(opts.activeOnly ? { isActive: true } : {}),
        // Site scope (Model B, docs/49 §3): a resource with NO `siteLinks` works
        // every site (shared — e.g. an owner who covers both businesses), so it
        // always shows; one WITH links shows only on the sites it is linked to. So
        // a multi-site tenant's calendar lanes / resource pickers stop listing the
        // other business's staff and bays, while single-site tenants (no link rows)
        // are unaffected. Undefined = unscoped (an unrestricted `?property=all`).
        ...(opts.propertyIds
          ? {
              OR: [
                { siteLinks: { none: {} } },
                { siteLinks: { some: { propertyId: { in: opts.propertyIds } } } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    })
  );
}

// Paginated/searchable variant for the dashboard's Resources list page — kept
// separate from `listResources()` above (other callers depend on it returning
// a bare, unpaginated array) rather than changing that function's shape.
export async function listResourcesPaged(
  tenantId: string,
  opts: {
    q?: string;
    kind?: string;
    locationId?: string;
    activeOnly?: boolean;
    take?: number;
    skip?: number;
  } = {}
): Promise<{ items: SchedulingResource[]; total: number }> {
  return withTenant({ tenantId }, async (tx) => {
    const where: Prisma.SchedulingResourceWhereInput = {
      deletedAt: null,
      ...(opts.kind ? { kind: opts.kind } : {}),
      ...(opts.locationId ? { locationId: opts.locationId } : {}),
      ...(opts.activeOnly ? { isActive: true } : {}),
      ...(opts.q
        ? {
            OR: [
              { name: { contains: opts.q, mode: 'insensitive' } },
              { description: { contains: opts.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      tx.schedulingResource.findMany({
        where,
        orderBy: { name: 'asc' },
        take: Math.min(opts.take ?? 50, 250),
        skip: opts.skip ?? 0,
      }),
      tx.schedulingResource.count({ where }),
    ]);
    return { items, total };
  });
}

export async function deleteResource(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const existing = await tx.schedulingResource.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new ResourceNotFoundError(id);
    await tx.schedulingResource.update({ where: { id }, data: { deletedAt: new Date() } });
  });
}

/** A resource a customer can pick when booking a `customer_choice` service (docs/79
 *  §7.5) — the public-safe subset (never internal fields). */
export interface BookableResource {
  id: string;
  name: string;
  kind: string;
  description: string | null;
  color: string | null;
  imageUrl: string | null;
}

interface RequirementLite {
  kind: string;
  skillTags: string[];
}

/** Parse a service's `resource_requirements` JSONB into the {kind, skillTags} pairs
 *  that decide eligibility. Empty/malformed → the default single staff role. */
function parseRequirements(raw: unknown): RequirementLite[] {
  if (!Array.isArray(raw)) return [];
  const out: RequirementLite[] = [];
  for (const r of raw) {
    if (r && typeof r === 'object') {
      const kind = (r as { kind?: unknown }).kind;
      const tags = (r as { skillTags?: unknown }).skillTags;
      if (typeof kind === 'string') {
        out.push({
          kind,
          skillTags: Array.isArray(tags)
            ? tags.filter((t): t is string => typeof t === 'string')
            : [],
        });
      }
    }
  }
  return out;
}

/** The specific resources a customer may pick for a service: online-bookable, active
 *  resources whose kind + skill tags satisfy at least one of the service's resource
 *  requirements (default: any staff resource). Powers the public "choose your person"
 *  picker AND the server-side guard that a chosen resource is actually eligible — so a
 *  visitor can't book an arbitrary or offline resource. Empty when the service is
 *  missing. */
export async function listBookableResourcesForService(
  tenantId: string,
  serviceId: string
): Promise<BookableResource[]> {
  return withTenant({ tenantId }, async (tx) => {
    const service = await tx.schedulingService.findFirst({
      where: { id: serviceId, deletedAt: null },
      select: { resourceRequirements: true },
    });
    if (!service) return [];
    const reqs = parseRequirements(service.resourceRequirements);
    const effective = reqs.length ? reqs : [{ kind: 'staff', skillTags: [] }];
    const resources = await tx.schedulingResource.findMany({
      where: { deletedAt: null, isActive: true, bookableOnline: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        kind: true,
        description: true,
        color: true,
        imageUrl: true,
        skillTags: true,
      },
    });
    return resources
      .filter((r) =>
        effective.some(
          (req) => r.kind === req.kind && req.skillTags.every((t) => r.skillTags.includes(t))
        )
      )
      .map(({ skillTags: _skillTags, ...safe }) => safe);
  });
}
