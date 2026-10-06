// Service records for a trade account's fleet (sparx persona issue 086).
//
// The /b2b page promises that a fleet account books service from the portal, that
// "service history records against the vehicle in the fleet profile", and that
// "parts from an order link to the service record". A booking already had the
// columns for all of it (`companyId`, `assetRef`, `partsLinked`) and nothing ever
// wrote them. This file is the one place that says what goes in them:
//
//   · `assetRef` is the fleet vehicle's STABLE id plus a snapshot of what the
//     vehicle was at the time. The id is what ties the visit to the vehicle's
//     history; the snapshot is what the record still says if the vehicle is later
//     renamed or sold off the fleet.
//   · `partsLinked` is a line from one of the account's orders, frozen: the order
//     (id and number, so the record links back to it), the line, and what was
//     bought. A part is never typed in by hand here, so it always names a real
//     order.
//
// Pure functions only: the portal route, the staff routes and the tests all read
// the same rules.

import { vehicleDescription, vehicleLabel, type FleetVehicle } from '@wizeworks/commerce-schemas';

/** What a booking remembers about the vehicle it was for. */
export interface VehicleSnapshot {
  /** The fleet vehicle's stable id: what the vehicle's history is keyed on. */
  vehicleId: string;
  /** What the business calls it ("Unit 12"), or null when it has no name. */
  name: string | null;
  /** The whole name a person reads: "Unit 12, 2019 Ram 3500 6.7L Cummins". */
  label: string;
  /** The vehicle without its name: "2019 Ram 3500 6.7L Cummins". */
  description: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  engine: string | null;
  vin: string | null;
  nodePath: string[];
}

type SnapshotSource = Pick<
  FleetVehicle,
  'id' | 'label' | 'year' | 'make' | 'model' | 'vin' | 'nodePath'
>;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Freeze a fleet vehicle onto a booking. A vehicle picked from the shop's fitment
 *  list carries its make, model and engine in `nodePath` (make first); a vehicle
 *  typed by hand carries its make and model in their own fields. */
export function vehicleSnapshot(v: SnapshotSource): VehicleSnapshot {
  const path = v.nodePath.map((p) => p.trim()).filter(Boolean);
  const description = vehicleDescription(v);
  return {
    vehicleId: v.id,
    name: text(v.label),
    label: vehicleLabel(v),
    description: description || null,
    year: v.year ?? null,
    make: path[0] ?? text(v.make),
    model: path[1] ?? text(v.model),
    engine: path.length > 2 ? path.slice(2).join(' ') : null,
    vin: text(v.vin),
    nodePath: path,
  };
}

/** The vehicle a stored booking was for, or null. A snapshot with no vehicle id
 *  (an older free-form `assetRef`) is not tied to any fleet vehicle, so it is not
 *  read as one: guessing which vehicle it meant would file the visit under the
 *  wrong truck. */
export function readVehicleSnapshot(value: unknown): VehicleSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const vehicleId = text(v.vehicleId);
  if (!vehicleId) return null;
  const nodePath = Array.isArray(v.nodePath)
    ? v.nodePath.filter((p): p is string => typeof p === 'string')
    : [];
  return {
    vehicleId,
    name: text(v.name),
    label: text(v.label) ?? text(v.name) ?? 'Vehicle',
    description: text(v.description),
    year: typeof v.year === 'number' ? v.year : null,
    make: text(v.make),
    model: text(v.model),
    engine: text(v.engine),
    vin: text(v.vin),
    nodePath,
  };
}

/** One part on a service record, as stored and as read. */
export interface ServiceRecordPart {
  orderId: string | null;
  orderItemId: string | null;
  orderNumber: string | null;
  variantId: string | null;
  sku: string | null;
  title: string;
  quantity: number;
}

/** A line of one of the account's orders that can be linked. */
export interface LinkableOrderLine {
  id: string;
  variantId: string | null;
  productId: string | null;
  sku: string;
  name: string;
  quantity: number;
}

export interface LinkableOrder {
  id: string;
  orderNumber: string;
  items: LinkableOrderLine[];
}

/** A ticked line and how many of it went into the visit. */
export interface PartPick {
  orderItemId: string;
  quantity: number;
}

/** A pick that cannot be linked. The message is said to the person as it is. */
export class PartLinkError extends Error {
  override name = 'PartLinkError';
}

/** The stored shape of a linked part: exactly the keys the booking schema keeps. */
export interface StoredPart {
  orderId: string;
  orderItemId: string;
  orderNumber: string;
  productId?: string;
  variantId?: string;
  sku: string;
  title: string;
  quantity: number;
}

/**
 * Turn ticked order lines into the parts stored on a booking.
 *
 * `orders` must be the account's OWN orders: a line that is not on one of them is
 * refused, which is what stops a part from another customer's order being filed
 * against this account's truck. The same line ticked twice is added up, and no
 * line can claim more than its order had.
 */
export function buildLinkedParts(picks: PartPick[], orders: LinkableOrder[]): StoredPart[] {
  const lineById = new Map<string, { order: LinkableOrder; line: LinkableOrderLine }>();
  for (const order of orders) {
    for (const line of order.items) lineById.set(line.id, { order, line });
  }

  const totals = new Map<string, number>();
  for (const pick of picks) {
    if (!lineById.has(pick.orderItemId)) {
      throw new PartLinkError(
        'One of those parts is not on an order from this account. Reload the list and pick again.'
      );
    }
    totals.set(pick.orderItemId, (totals.get(pick.orderItemId) ?? 0) + pick.quantity);
  }

  const parts: StoredPart[] = [];
  for (const [orderItemId, quantity] of totals) {
    const { order, line } = lineById.get(orderItemId)!;
    if (quantity > line.quantity) {
      throw new PartLinkError(
        `Order ${order.orderNumber} has ${line.quantity} of ${line.name}, so no more than ${line.quantity} can go on this visit.`
      );
    }
    parts.push({
      orderId: order.id,
      orderItemId: line.id,
      orderNumber: order.orderNumber,
      ...(line.productId ? { productId: line.productId } : {}),
      ...(line.variantId ? { variantId: line.variantId } : {}),
      sku: line.sku,
      title: line.name,
      quantity,
    });
  }
  return parts;
}

/** The parts stored on a booking, read tolerantly: anything that is not a part is
 *  skipped rather than taking the record down with it. */
export function readLinkedParts(value: unknown): ServiceRecordPart[] {
  if (!Array.isArray(value)) return [];
  const parts: ServiceRecordPart[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, unknown>;
    const sku = text(p.sku);
    const title = text(p.title) ?? text(p.description) ?? sku;
    if (!title) continue;
    parts.push({
      orderId: text(p.orderId),
      orderItemId: text(p.orderItemId),
      orderNumber: text(p.orderNumber),
      variantId: text(p.variantId),
      sku,
      title,
      quantity: typeof p.quantity === 'number' && p.quantity > 0 ? p.quantity : 1,
    });
  }
  return parts;
}

/** The booking columns a service record is read from. */
export interface ServiceRecordRow {
  id: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  status: string;
  notes: string | null;
  staffNotes: string | null;
  assetRef: unknown;
  partsLinked: unknown;
  service: { name: string };
}

export interface ServiceRecord {
  id: string;
  serviceName: string;
  status: string;
  startAt: string;
  endAt: string;
  timezone: string;
  notes: string | null;
  /** Only on the staff read: the private team note never reaches the buyer. */
  staffNotes?: string | null;
  vehicle: VehicleSnapshot | null;
  parts: ServiceRecordPart[];
}

export function toServiceRecord(row: ServiceRecordRow, opts: { staff: boolean }): ServiceRecord {
  return {
    id: row.id,
    serviceName: row.service.name,
    status: row.status,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    timezone: row.timezone,
    notes: row.notes,
    ...(opts.staff ? { staffNotes: row.staffNotes } : {}),
    vehicle: readVehicleSnapshot(row.assetRef),
    parts: readLinkedParts(row.partsLinked),
  };
}

/** The booking columns `toServiceRecord` needs, as a Prisma select. */
export const SERVICE_RECORD_SELECT = {
  id: true,
  startAt: true,
  endAt: true,
  timezone: true,
  status: true,
  notes: true,
  staffNotes: true,
  assetRef: true,
  partsLinked: true,
  service: { select: { name: true } },
} as const;
