// What a customer is owed on a booking confirmation, besides the time: WHERE it
// happens and WHO it is with (docs/79 §10, issue 107).
//
// It lives in one place because the same two facts go out on three surfaces that
// must not disagree — the confirmation panel on the site, the `.ics` a phone
// keeps, and the confirmation email. A business whose own details differ between
// the screen and the calendar entry is the failure this module exists to avoid.
//
// The place also carries the TIMEZONE, which is the zone a booking's times should
// be read in. `createBooking` used to stamp `UTC` whenever a caller did not say,
// and the public website never says — so every booking made from a site read
// seven hours out in the owner's own diary (issue 108). The place is the honest
// source: an appointment happens where the business is.

import { withTenant, type TxClient } from '@wizeworks/db';

/** A place, in the forms the three surfaces need. */
export interface BookingPlace {
  /** What the business calls it — "Halo & Hem", "Midtown". */
  name: string;
  /** The postal address on one line, or EMPTY when none is on file. Empty is a
   *  real answer for a market stall or a mobile groomer, and it is the reason a
   *  customer-facing "where" can be null rather than a name that locates nothing. */
  address: string;
  /** Name + address — what a calendar entry's LOCATION should read. */
  line: string;
  timezone: string;
}

function str(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** The address on one line, in the order a person writes an envelope. */
export function formatAddressLine(address: unknown): string {
  if (!address || typeof address !== 'object' || Array.isArray(address)) return '';
  const parts = address as Record<string, unknown>;
  const town = [str(parts, 'city'), str(parts, 'region')].filter(Boolean).join(', ');
  const postal = str(parts, 'postalCode');
  return [
    str(parts, 'line1'),
    str(parts, 'line2'),
    [town, postal].filter(Boolean).join(' '),
    str(parts, 'country'),
  ]
    .filter(Boolean)
    .join(', ');
}

function toPlace(row: { name: string; address: unknown; timezone: string }): BookingPlace {
  const address = formatAddressLine(row.address);
  return {
    name: row.name,
    address,
    line: [row.name, address].filter(Boolean).join(', '),
    timezone: row.timezone,
  };
}

const PLACE_SELECT = { name: true, address: true, timezone: true } as const;

/**
 * Where a booking happens: its own location, else the one its service is filed
 * under, else — when the business has exactly ONE place — that place.
 *
 * The last step is what makes this useful in practice: a one-chair salon never
 * picks a location anywhere, so `location_id` is null on every row, and a strict
 * reading would leave every confirmation silent about an address the business
 * has already typed in. With two or more places and none chosen we return null
 * rather than guess — sending somebody to the wrong branch is worse than saying
 * nothing.
 */
export async function findBookingPlaceTx(
  tx: TxClient,
  where: { locationId?: string | null; serviceId?: string | null }
): Promise<BookingPlace | null> {
  if (where.locationId) {
    const own = await tx.businessLocation.findUnique({
      where: { id: where.locationId },
      select: PLACE_SELECT,
    });
    if (own) return toPlace(own);
  }
  if (where.serviceId) {
    const service = await tx.schedulingService.findUnique({
      where: { id: where.serviceId },
      select: { location: { select: PLACE_SELECT } },
    });
    if (service?.location) return toPlace(service.location);
  }
  const active = await tx.businessLocation.findMany({
    where: { isActive: true },
    select: PLACE_SELECT,
    take: 2,
  });
  return active.length === 1 ? toPlace(active[0]!) : null;
}

/**
 * The place each of these services happens at — the same rule as
 * `findBookingPlaceTx` minus the booking, resolved for a whole list in two
 * queries rather than three per service. A booking page asks about every service
 * a site offers, so this is the read path's shape.
 */
export async function findServicePlaces(
  tenantId: string,
  serviceIds: string[]
): Promise<Map<string, BookingPlace>> {
  const out = new Map<string, BookingPlace>();
  if (serviceIds.length === 0) return out;
  await withTenant({ tenantId }, async (tx) => {
    const [services, active] = await Promise.all([
      tx.schedulingService.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, locationId: true },
      }),
      tx.businessLocation.findMany({
        where: { isActive: true },
        select: { id: true, ...PLACE_SELECT },
      }),
    ]);
    const byId = new Map(active.map((l) => [l.id, toPlace(l)]));
    const onlyOne = active.length === 1 ? toPlace(active[0]!) : null;
    for (const service of services) {
      const place = (service.locationId ? byId.get(service.locationId) : null) ?? onlyOne;
      if (place) out.set(service.id, place);
    }
  });
  return out;
}

export async function findBookingPlace(
  tenantId: string,
  where: { locationId?: string | null; serviceId?: string | null }
): Promise<BookingPlace | null> {
  return withTenant({ tenantId }, (tx) => findBookingPlaceTx(tx, where));
}

/** The place as a CUSTOMER should be told it — null when all that is known is
 *  the business's own name, which tells someone who has never been here nothing. */
export function customerFacingPlace(place: BookingPlace | null): string | null {
  return place?.address ? place.line : null;
}

/** "Nia", "Nia and Dara", "Nia, Dara and Sam" — never a bare comma list. */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]!}`;
}

/** Who the booking is with — the PEOPLE on it, ignoring rooms, chairs and kit.
 *  Null when nobody is assigned or the booking only holds a table. */
export async function findBookingHosts(
  tenantId: string,
  resourceIds: string[]
): Promise<string | null> {
  if (resourceIds.length === 0) return null;
  const rows = await withTenant({ tenantId }, (tx) =>
    tx.schedulingResource.findMany({
      where: { id: { in: resourceIds }, kind: 'staff', deletedAt: null },
      select: { name: true },
      orderBy: { name: 'asc' },
    })
  );
  return joinNames(rows.map((r) => r.name)) || null;
}
