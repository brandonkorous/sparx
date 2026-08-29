// Remembering where a variant sat, so putting a choice back can put it back.
//
// `setOptions` replaces the whole lattice: every ProductOption row is deleted
// and recreated with fresh ids, and the ProductVariantOptionValue rows that
// recorded each variant's position cascade away with them. Live variants survive
// because the caller re-places them by id straight afterwards. A variant being
// RETIRED — because the value it sat on was removed — is not re-placed, and
// there is no new id to re-place it onto.
//
// So its coordinate was gone for good, while the delete's own confirm promised
// "you can bring them back". Bringing one back returned a version belonging to
// no combination: unreachable by any shopper, listed under "Versions with no
// place in the grid" while the grid offered to create a duplicate beside it
// (persona issue 305).
//
// This writes the coordinate down as TEXT before the cascade takes it, and reads
// it back when the lattice can hold it again. Text, not ids, because the ids are
// exactly what does not survive.
//
// It lives on `metadata`, which the schema reserves for the platform —
// `customFields` is the tenant's and must never be at risk from a platform
// feature writing a key that happens to collide.

import type { Prisma } from '@wizeworks/db';

const KEY = 'latticeCoordinate';

export interface RememberedPoint {
  option: string;
  value: string;
}

/** NUL as the separator, so an option named "Size|Color" cannot collide with a
 *  two-part key. Same reason the console's own coordinateKey uses it. */
function keyOf(option: string, value: string): string {
  return `${option.trim().toLowerCase()}\u0000${value.trim().toLowerCase()}`;
}

export function readRemembered(metadata: unknown): RememberedPoint[] | null {
  if (typeof metadata !== 'object' || metadata === null) return null;
  const held = (metadata as Record<string, unknown>)[KEY];
  if (!Array.isArray(held) || held.length === 0) return null;
  const points: RememberedPoint[] = [];
  for (const entry of held) {
    if (typeof entry !== 'object' || entry === null) return null;
    const point = entry as Record<string, unknown>;
    if (typeof point.option !== 'string' || typeof point.value !== 'string') return null;
    points.push({ option: point.option, value: point.value });
  }
  return points;
}

function withRemembered(metadata: unknown, points: RememberedPoint[]): Prisma.InputJsonValue {
  const base = typeof metadata === 'object' && metadata !== null ? { ...metadata } : {};
  return { ...base, [KEY]: points } as unknown as Prisma.InputJsonValue;
}

type Tx = Prisma.TransactionClient;

/**
 * Write down where every variant of this product currently sits.
 *
 * Called inside `setOptions`, before the options are deleted. A variant with no
 * assignments keeps whatever it already remembered — a product mid-restructure
 * has unplaced variants, and overwriting their memory with nothing is how the
 * fact this exists to keep would be lost on the very next save.
 */
export async function rememberCoordinates(tx: Tx, productId: string): Promise<void> {
  const variants = await tx.productVariant.findMany({
    where: { productId },
    select: {
      id: true,
      metadata: true,
      optionAssignments: {
        select: { optionValue: { select: { value: true, option: { select: { name: true } } } } },
      },
    },
  });

  for (const variant of variants) {
    if (variant.optionAssignments.length === 0) continue;
    const points = variant.optionAssignments.map((link) => ({
      option: link.optionValue.option.name,
      value: link.optionValue.value,
    }));
    await tx.productVariant.update({
      where: { id: variant.id },
      data: { metadata: withRemembered(variant.metadata, points) },
    });
  }
}

export interface NewValue {
  id: string;
  value: string;
  optionName: string;
}

/**
 * Put back every variant whose remembered coordinate the NEW lattice can hold.
 *
 * Called inside `setOptions`, after the options are recreated. Only ever places a
 * variant that currently has no assignments, and only when every point of its
 * remembered coordinate is present — a partial match is a different combination,
 * not this one.
 *
 * A RENAMED value deliberately does not match. The caller re-places live variants
 * by identity straight after this, and identity is what survives a rename; this
 * is for the case identity cannot reach — a value that went away and came back,
 * which mints a new id and leaves nothing to match on but the word.
 */
export async function restoreRememberedCoordinates(
  tx: Tx,
  productId: string,
  lattice: NewValue[]
): Promise<number> {
  if (lattice.length === 0) return 0;
  const byKey = new Map(lattice.map((entry) => [keyOf(entry.optionName, entry.value), entry.id]));
  const axes = new Set(lattice.map((entry) => entry.optionName.trim().toLowerCase()));

  const variants = await tx.productVariant.findMany({
    where: { productId },
    select: { id: true, metadata: true, optionAssignments: { select: { optionValueId: true } } },
  });

  let placed = 0;
  for (const variant of variants) {
    if (variant.optionAssignments.length > 0) continue;
    const remembered = readRemembered(variant.metadata);
    if (!remembered) continue;
    // It has to span the new lattice exactly once — the same rule
    // `assignOptionValues` enforces, and without it this would write a corrupt
    // half-coordinate nothing else in the system expects.
    if (remembered.length !== axes.size) continue;
    const ids = remembered.map((point) => byKey.get(keyOf(point.option, point.value)));
    if (ids.some((id) => id === undefined)) continue;

    await tx.productVariantOptionValue.createMany({
      data: (ids as string[]).map((optionValueId) => ({ variantId: variant.id, optionValueId })),
    });
    placed += 1;
  }
  return placed;
}
