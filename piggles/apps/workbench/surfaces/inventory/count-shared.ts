// The handful of constants and one parser the count-session files share.

/** Registry module for these surfaces, so the brand's empty-state artwork is
 *  this app's own picture rather than the generic one. */
export const COUNT_MODULE = 'inventory';

/** Centred and capped — a count torn onto a second monitor is 2000px wide, and
 *  uncapped the difference column drifts a foot from the item it belongs to. */
export const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

/** Applying is worth stopping for once the corrections get large. Both terms
 *  matter: the money value catches a costly swing, the unit count catches a big
 *  swing in items whose cost was never entered (so their value reads as zero). */
export const BIG_VARIANCE_UNITS = 50;

/** A counted quantity is a whole number of things, or nothing yet. */
export function parseQty(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}
