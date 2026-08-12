// Picking + packing schemas (docs/146 Phase 4).
//
// The write contracts for generating a walk, confirming what came off a shelf,
// saying what did not, and verifying what went in the box.

import { z } from 'zod';

import { Uuid } from '@sparx/crm-schemas';

import { AllocationStrategy } from './inventory';

// ─── Vocabulary ──────────────────────────────────────────────────────────────

// `AllocationStrategy` lives in ./inventory — added there in Phase 2, because
// put-away suggests a shelf using the same preference and the column had to
// exist on Warehouse before picking shipped. Imported here rather than
// redeclared: two enums with the same name and the same four members is one edit
// away from being two enums with DIFFERENT members. Not re-exported either — the
// barrel already exports it from ./inventory, and the same name twice is an
// ambiguity error rather than a convenience.
//
//   fifo         oldest stock first, by when it landed on the shelf. The default,
//                and right for almost everything: it keeps stock turning and
//                stops a back-corner pallet ageing out.
//   fefo         nearest expiry first. Correct — and the only correct answer —
//                for anything with a date on it. Falls back to FIFO for items
//                that carry no lot.
//   nearest_bin  lowest pick sequence first: the shortest walk. Fastest, and it
//                will happily leave old stock where it is, so it suits durables
//                rather than food.
//   single_bin   prefer ONE shelf that can cover the whole line, even if it is
//                further away. Two shelves for four units is two chances to
//                mis-count; a warehouse that values accuracy over metres wants
//                this.
export const PickListKind = z.enum(['single', 'batch', 'wave']);
export type PickListKind = z.infer<typeof PickListKind>;

export const PickListStatus = z.enum(['draft', 'assigned', 'picking', 'picked', 'cancelled']);
export type PickListStatus = z.infer<typeof PickListStatus>;

export const PickLineStatus = z.enum(['pending', 'picked', 'short', 'skipped']);
export type PickLineStatus = z.infer<typeof PickLineStatus>;

/**
 * Why the units were not there.
 *
 * A closed list, because the whole value of recording a short pick is being able
 * to group it: "not_found on aisle C, forty times this month" is an action, and
 * forty rows of free text is a paragraph nobody reads. `other` plus a note is the
 * escape hatch that keeps the rest of the list honest.
 */
export const ShortPickReason = z.enum([
  // The shelf was empty, or the item simply was not there.
  'not_found',
  // It was there and it is not sellable.
  'damaged',
  // Something else is on that shelf — a put-away error upstream.
  'wrong_item',
  // Some were there, not enough. The commonest, and the one that most often
  // means the number was already wrong before today.
  'insufficient',
  // Physically unreachable right now — blocked aisle, top rack, no forklift.
  'inaccessible',
  'other',
]);
export type ShortPickReason = z.infer<typeof ShortPickReason>;

export const PackageStatus = z.enum(['open', 'packed', 'cancelled']);
export type PackageStatus = z.infer<typeof PackageStatus>;

// ─── Generating a walk ───────────────────────────────────────────────────────

export const GeneratePickListInput = z.object({
  /**
   * The orders to pick. One order is a `single` list unless told otherwise; more
   * than one has to say whether it is a batch or a wave.
   */
  orderIds: z.array(Uuid).min(1).max(200),
  /** Where from. Omitted, the orders' own allocation decides, and a set of orders
   *  that span locations is refused rather than silently split. */
  warehouseId: Uuid.optional(),
  kind: PickListKind.optional(),
  /** Overrides the warehouse's setting for THIS walk. Recorded on the list. */
  strategy: AllocationStrategy.optional(),
  assignedTo: z.string().trim().max(127).nullish(),
  note: z.string().trim().max(2000).optional(),
  /**
   * Include order lines that have no variant (free-text items) as unallocated
   * instructions. Off by default: there is no stock record to walk to, and a
   * line with no shelf on a directed pick list is a line people learn to skip.
   */
  includeUnstocked: z.boolean().optional(),
});
export type GeneratePickListInput = z.infer<typeof GeneratePickListInput>;

export const ListPickListsQuery = z.object({
  status: PickListStatus.optional(),
  kind: PickListKind.optional(),
  warehouseId: Uuid.optional(),
  assignedTo: z.string().trim().max(127).optional(),
  orderId: Uuid.optional(),
  /** Text match on the list number or an order number on it. */
  search: z.string().trim().max(120).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});
export type ListPickListsQuery = z.infer<typeof ListPickListsQuery>;

export const AssignPickListInput = z.object({
  /** Null hands it back to the pool. */
  assignedTo: z.string().trim().max(127).nullable(),
});
export type AssignPickListInput = z.infer<typeof AssignPickListInput>;

export const CancelPickListInput = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type CancelPickListInput = z.infer<typeof CancelPickListInput>;

// ─── Working the walk ────────────────────────────────────────────────────────

export const ConfirmPickInput = z.object({
  lineId: Uuid,
  /** How many came off the shelf. Omitted means all of them, which is what a
   *  picker tapping the big button means. */
  quantity: z.number().int().min(0).max(1_000_000).optional(),
  /**
   * The shelf it actually came off, when that is not the one on the instruction.
   * This is the whole reason picking improves the data: the sale guessed, the
   * picker knows, and saying so is what keeps the shelves describing the
   * building.
   */
  binId: Uuid.nullish(),
  /** Set by the scan path, never by the client. */
  verifiedByScan: z.boolean().optional(),
});
export type ConfirmPickInput = z.infer<typeof ConfirmPickInput>;

export const ShortPickInput = z.object({
  lineId: Uuid,
  /** How many were found. Zero is the common case. */
  quantity: z.number().int().min(0).max(1_000_000).optional(),
  reason: ShortPickReason,
  note: z.string().trim().max(1000).optional(),
  /**
   * Raise a count for the shelf so a human settles what is actually there.
   * Defaults ON, and that default is the point of the feature: a short pick is
   * the single best free signal that a number is wrong, and a workflow that lets
   * you dismiss it without looking wastes the signal.
   */
  raiseCount: z.boolean().optional(),
});
export type ShortPickInput = z.infer<typeof ShortPickInput>;

export const SkipPickInput = z.object({
  lineId: Uuid,
});
export type SkipPickInput = z.infer<typeof SkipPickInput>;

/** One trigger pull against an open walk: scan the item, and the line it belongs
 *  to is found and confirmed. */
export const ScanToPickInput = z.object({
  value: z.string().trim().min(1).max(256),
  idempotencyKey: z.string().trim().min(8).max(127),
  quantity: z.number().int().min(1).max(1_000_000).optional(),
  /** The shelf the picker is standing at, scanned first. Verifies they are in
   *  the right place before the item is accepted. */
  binId: Uuid.nullish(),
  deviceId: z.string().trim().max(64).nullish(),
  scannedAt: z.string().datetime().optional(),
});
export type ScanToPickInput = z.infer<typeof ScanToPickInput>;

// ─── The box ─────────────────────────────────────────────────────────────────

export const CreatePackageInput = z.object({
  orderId: Uuid,
  pickListId: Uuid.nullish(),
  packagingType: z.string().trim().max(32).optional(),
  weightGrams: z.number().int().min(0).max(10_000_000).nullish(),
  lengthMm: z.number().int().min(0).max(100_000).nullish(),
  widthMm: z.number().int().min(0).max(100_000).nullish(),
  heightMm: z.number().int().min(0).max(100_000).nullish(),
  note: z.string().trim().max(2000).optional(),
});
export type CreatePackageInput = z.infer<typeof CreatePackageInput>;

// No `.default()` anywhere above, so nothing to re-declare here — but the shape
// is spelled out rather than `.partial()`ed so it stays that way when somebody
// adds a defaulted field to the create input.
export const UpdatePackageInput = z.object({
  packagingType: z.string().trim().max(32).nullish(),
  weightGrams: z.number().int().min(0).max(10_000_000).nullish(),
  lengthMm: z.number().int().min(0).max(100_000).nullish(),
  widthMm: z.number().int().min(0).max(100_000).nullish(),
  heightMm: z.number().int().min(0).max(100_000).nullish(),
  note: z.string().trim().max(2000).nullish(),
});
export type UpdatePackageInput = z.infer<typeof UpdatePackageInput>;

/** Put units in the box by hand — the keyboard twin of a pack scan. */
export const PackItemInput = z.object({
  orderItemId: Uuid,
  /** The new total for this line in this box, not a delta. A pack bench corrects
   *  itself by typing the right number, not by working out the difference. */
  quantity: z.number().int().min(0).max(1_000_000),
});
export type PackItemInput = z.infer<typeof PackItemInput>;

export const ScanToPackInput = z.object({
  value: z.string().trim().min(1).max(256),
  idempotencyKey: z.string().trim().min(8).max(127),
  quantity: z.number().int().min(1).max(1_000_000).optional(),
  deviceId: z.string().trim().max(64).nullish(),
  scannedAt: z.string().datetime().optional(),
});
export type ScanToPackInput = z.infer<typeof ScanToPackInput>;

export const ClosePackageInput = z.object({
  weightGrams: z.number().int().min(0).max(10_000_000).nullish(),
  lengthMm: z.number().int().min(0).max(100_000).nullish(),
  widthMm: z.number().int().min(0).max(100_000).nullish(),
  heightMm: z.number().int().min(0).max(100_000).nullish(),
  packagingType: z.string().trim().max(32).nullish(),
  /**
   * Close a box whose contents do not match what was picked.
   *
   * Refusing outright would be wrong — a partial shipment is legitimate and
   * common — but it must be a DECISION rather than something that happens by
   * tapping through. Without this the mismatch is named in the error.
   */
  allowPartial: z.boolean().optional(),
});
export type ClosePackageInput = z.infer<typeof ClosePackageInput>;

export const ListPackagesQuery = z.object({
  orderId: Uuid.optional(),
  pickListId: Uuid.optional(),
  status: PackageStatus.optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});
export type ListPackagesQuery = z.infer<typeof ListPackagesQuery>;

// ─── Throughput ──────────────────────────────────────────────────────────────

export const PickThroughputQuery = z.object({
  /** ISO date-times. Defaults to the last 30 days. */
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  warehouseId: Uuid.optional(),
  pickedBy: z.string().trim().max(127).optional(),
});
export type PickThroughputQuery = z.infer<typeof PickThroughputQuery>;
