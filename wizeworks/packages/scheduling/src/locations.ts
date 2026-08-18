// Business locations — CRUD for the physical places a business serves from
// (docs/79 §21, docs/131 §4).
//
// WHY THIS FILE EXISTS. `scheduling_locations` and its site junction shipped with
// the schema, a seeded 'Main location' row, and FKs from resources, services,
// bookings and availability exceptions — but no CRUD anywhere. So a tenant could
// never add a second place, never name the one they had, and the junction that says
// which sites serve from a location had neither a writer nor a reader. Everything
// downstream was built to reference a location that nobody could manage.
//
// A location is a PLACE, so the row is tenant-owned and the site scope is a
// junction: one premises can host two businesses. EMPTY links = every site, the
// same Model B default the rest of the platform uses.

import { withTenant, type BusinessLocation } from '@wizeworks/db';
import type { Prisma } from '@wizeworks/db';
import {
  CreateLocation,
  UpdateLocationInput,
  type CreateLocationInput,
  type LocationAddress,
} from '@wizeworks/scheduling-schemas';

import { LocationInUseError, LocationNotFoundError } from './errors';

/** A location as every caller sees it — the row plus its site scope, which lives
 *  in a junction and would otherwise need a second round trip at every call site. */
export interface LocationRow {
  id: string;
  name: string;
  address: LocationAddress;
  timezone: string;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
  /** The sites that serve from here. EMPTY = every site. */
  propertyIds: string[];
  /** What is attached, so the UI can warn before switching one off and can
   *  explain why a delete is refused. */
  counts: { resources: number; services: number; bookings: number };
  createdAt: string;
  updatedAt: string;
}

type LocationWithScope = BusinessLocation & {
  siteLinks: { propertyId: string }[];
  _count: { resources: number; services: number; bookings: number };
};

const INCLUDE = {
  siteLinks: { select: { propertyId: true } },
  _count: { select: { resources: true, services: true, bookings: true } },
} satisfies Prisma.BusinessLocationInclude;

function serialize(row: LocationWithScope): LocationRow {
  return {
    id: row.id,
    name: row.name,
    // The column is JSONB and pre-CRUD rows were written with `{}` — parse rather
    // than cast, so a hand-edited or legacy shape degrades to an empty address
    // instead of reaching the UI as something it cannot render.
    address: parseAddress(row.address),
    timezone: row.timezone,
    lat: row.lat,
    lng: row.lng,
    isActive: row.isActive,
    propertyIds: row.siteLinks.map((l) => l.propertyId),
    counts: {
      resources: row._count.resources,
      services: row._count.services,
      bookings: row._count.bookings,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseAddress(value: unknown): LocationAddress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string' && v !== '') out[key] = v;
  }
  return out;
}

export async function listLocations(
  tenantId: string,
  opts: { activeOnly?: boolean; propertyIds?: string[] } = {}
): Promise<LocationRow[]> {
  const rows = await withTenant({ tenantId }, (tx) =>
    tx.businessLocation.findMany({
      where: {
        ...(opts.activeOnly ? { isActive: true } : {}),
        // Site scope (Model B): a location with NO links serves every site — a
        // single premises, or a tenant that has never split them. One WITH links
        // shows only where it is linked. Undefined = unscoped (`?property=all`).
        ...(opts.propertyIds
          ? {
              OR: [
                { siteLinks: { none: {} } },
                { siteLinks: { some: { propertyId: { in: opts.propertyIds } } } },
              ],
            }
          : {}),
      },
      include: INCLUDE,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    })
  );
  return rows.map(serialize);
}

export async function getLocation(tenantId: string, id: string): Promise<LocationRow> {
  const row = await withTenant({ tenantId }, (tx) =>
    tx.businessLocation.findFirst({ where: { id }, include: INCLUDE })
  );
  if (!row) throw new LocationNotFoundError(id);
  return serialize(row);
}

export async function createLocation(tenantId: string, rawInput: unknown): Promise<LocationRow> {
  const input: CreateLocationInput = CreateLocation.parse(rawInput);
  const row = await withTenant({ tenantId }, (tx) =>
    tx.businessLocation.create({
      data: {
        tenantId,
        name: input.name,
        address: input.address,
        timezone: input.timezone,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        isActive: input.isActive,
        // No rows = serves every site, so an empty list writes nothing.
        ...(input.propertyIds.length > 0
          ? { siteLinks: { create: input.propertyIds.map((propertyId) => ({ propertyId })) } }
          : {}),
      },
      include: INCLUDE,
    })
  );
  return serialize(row);
}

export async function updateLocation(tenantId: string, rawInput: unknown): Promise<LocationRow> {
  const input = UpdateLocationInput.parse(rawInput);
  const { id, propertyIds, address, ...rest } = input;
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.businessLocation.findFirst({ where: { id }, select: { id: true } });
    if (!existing) throw new LocationNotFoundError(id);

    if (propertyIds !== undefined) {
      // Replace-all: the caller sends the full set it wants, so a site dropped
      // from the list is unlinked.
      await tx.businessLocationProperty.deleteMany({ where: { locationId: id } });
      if (propertyIds.length > 0) {
        await tx.businessLocationProperty.createMany({
          data: propertyIds.map((propertyId) => ({ locationId: id, propertyId })),
          skipDuplicates: true,
        });
      }
    }

    const row = await tx.businessLocation.update({
      where: { id },
      data: {
        ...rest,
        ...(address !== undefined ? { address } : {}),
      },
      include: INCLUDE,
    });
    return serialize(row);
  });
}

/**
 * Remove a location outright.
 *
 * Refused while any booking points at it. The FK is SET NULL, so deleting would
 * succeed and quietly strip the place off completed appointments — history a
 * business needs and cannot reconstruct. Resources and services are different:
 * they are CONFIGURATION, they simply become unassigned, and the owner can
 * re-file them. Availability exceptions cascade, which is right — a blackout on a
 * place that no longer exists is meaningless.
 *
 * The always-available alternative is `isActive: false`, which is what the error
 * tells the owner to do.
 */
export async function deleteLocation(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const row = await tx.businessLocation.findFirst({
      where: { id },
      select: { id: true, _count: { select: { bookings: true } } },
    });
    if (!row) throw new LocationNotFoundError(id);
    if (row._count.bookings > 0) throw new LocationInUseError(row._count.bookings);
    await tx.businessLocation.delete({ where: { id } });
  });
}
