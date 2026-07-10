// Resource setup CRUD (staff / assets / tables / spaces / equipment). Soft-delete
// so historical bookings keep a valid resource reference.

import type { Prisma } from '@sparx/db';
import { withTenant, type SchedulingResource } from '@sparx/db';
import type { CreateResourceInput, UpdateResourceInput } from '@sparx/scheduling-schemas';

import { ResourceNotFoundError } from './errors';

export async function createResource(
  tenantId: string,
  input: CreateResourceInput
): Promise<SchedulingResource> {
  return withTenant({ tenantId }, (tx) =>
    tx.schedulingResource.create({
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
      },
    })
  );
}

export async function updateResource(
  tenantId: string,
  input: UpdateResourceInput
): Promise<SchedulingResource> {
  const { id, settings, ...rest } = input;
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.schedulingResource.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new ResourceNotFoundError(id);
    return tx.schedulingResource.update({
      where: { id },
      data: {
        ...rest,
        ...(settings !== undefined ? { settings: settings as Prisma.InputJsonValue } : {}),
      },
    });
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
  opts: { kind?: string; locationId?: string; activeOnly?: boolean } = {}
): Promise<SchedulingResource[]> {
  return withTenant({ tenantId }, (tx) =>
    tx.schedulingResource.findMany({
      where: {
        deletedAt: null,
        ...(opts.kind ? { kind: opts.kind } : {}),
        ...(opts.locationId ? { locationId: opts.locationId } : {}),
        ...(opts.activeOnly ? { isActive: true } : {}),
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
