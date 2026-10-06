// Repeat delivery — how often a SHOPPER may ask for a product again (issue 739).
//
// One fixed set of cadences, chosen by the owner per product and by the shopper
// per cart line. Fixed rather than free-form because every one of them has to
// read as a sentence a shopper says ("every 2 weeks"), has to be a schedule the
// renewal worker can run, and has to be something an owner can tick without
// inventing one. Weeks and months only: a daily repeat delivery is not a
// physical-goods errand, and a yearly one is a reminder rather than a standing
// order.
//
// Pure, so the console, the API and the shop all read the same rules and the
// same words. A cadence spelled two ways is how a product page offers "every 4
// weeks" and the cart says "monthly" about the same choice.

import { z } from 'zod';

export const RepeatUnit = z.enum(['week', 'month']);
export type RepeatUnit = z.infer<typeof RepeatUnit>;

export const RepeatCadence = z.object({
  intervalUnit: RepeatUnit,
  intervalCount: z.number().int().min(1).max(12),
});
export type RepeatCadence = z.infer<typeof RepeatCadence>;

/** Every cadence an owner may offer, in the order they are shown. */
export const REPEAT_CADENCE_CHOICES: readonly RepeatCadence[] = [
  { intervalUnit: 'week', intervalCount: 1 },
  { intervalUnit: 'week', intervalCount: 2 },
  { intervalUnit: 'week', intervalCount: 4 },
  { intervalUnit: 'month', intervalCount: 1 },
  { intervalUnit: 'month', intervalCount: 2 },
  { intervalUnit: 'month', intervalCount: 3 },
];

/** A stable key for a cadence: `2-week`. For form values and comparisons. */
export function cadenceKey(cadence: RepeatCadence): string {
  return `${String(cadence.intervalCount)}-${cadence.intervalUnit}`;
}

/** The inverse of `cadenceKey`, or null for anything that is not one of the
 *  offered choices. */
export function cadenceFromKey(key: string): RepeatCadence | null {
  return REPEAT_CADENCE_CHOICES.find((choice) => cadenceKey(choice) === key) ?? null;
}

export function isOfferedCadence(cadence: RepeatCadence): boolean {
  return cadenceFromKey(cadenceKey(cadence)) !== null;
}

/** "every week", "every 2 weeks", "every month", "every 3 months". */
export function cadenceWords(cadence: RepeatCadence): string {
  return cadence.intervalCount === 1
    ? `every ${cadence.intervalUnit}`
    : `every ${String(cadence.intervalCount)} ${cadence.intervalUnit}s`;
}

/** The same, for the start of a sentence or a button: "Every 2 weeks". */
export function cadenceLabel(cadence: RepeatCadence): string {
  const words = cadenceWords(cadence);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** What an owner saves on a product: offered choices only, each once, kept in
 *  the order shoppers see them. An empty list is "bought once only". */
export const ProductRepeatOptions = z
  .array(RepeatCadence)
  .max(REPEAT_CADENCE_CHOICES.length)
  .refine((list) => list.every(isOfferedCadence), {
    message: 'Choose from the delivery schedules on offer.',
  })
  .transform((list) =>
    REPEAT_CADENCE_CHOICES.filter((choice) =>
      list.some((picked) => cadenceKey(picked) === cadenceKey(choice))
    )
  );
export type ProductRepeatOptions = z.infer<typeof ProductRepeatOptions>;

/** Read a product's stored `repeatOptions` defensively: a row is JSON, and
 *  anything that is not an offered cadence is dropped rather than offered. */
export function readRepeatOptions(raw: unknown): RepeatCadence[] {
  if (!Array.isArray(raw)) return [];
  const parsed = raw
    .map((entry) => RepeatCadence.safeParse(entry))
    .filter((result) => result.success)
    .map((result) => result.data);
  return REPEAT_CADENCE_CHOICES.filter((choice) =>
    parsed.some((picked) => cadenceKey(picked) === cadenceKey(choice))
  );
}
