// Units of measure (docs/146 Phase 6.1–6.3).
//
// Buy a case, stock each, sell a pair. The write contracts for the units a
// business measures in, what each one means for a given item, and the ONE pure
// function every screen uses to say a quantity out loud.
//
// ── The rule the whole feature rests on ──────────────────────────────────────
//
// A quantity is stored in BASE units, always — on-hand, every movement, every
// document line. A unit of measure is a way of ENTERING and DISPLAYING it, never
// a second way of storing it. Everything here converts at the edges and hands
// base units inward.

import { z } from 'zod';

import { Uuid } from '@sparx/crm-schemas';

// ─── Vocabulary ──────────────────────────────────────────────────────────────

/**
 * What kind of thing a unit measures.
 *
 * Not enforced against the conversion factor — a variant's own conversions are
 * what decide arithmetic. It exists so a picker can group a long list, and so a
 * future same-dimension conversion has something to check before it multiplies
 * litres by kilograms.
 */
export const UomDimension = z.enum(['count', 'weight', 'volume', 'length', 'area']);
export type UomDimension = z.infer<typeof UomDimension>;

/**
 * A unit code as it appears on a document line: EA, CS, BX, PR, KG.
 *
 * Upper-cased on write, because "4 CS" and "4 cs" are the same unit and two rows
 * claiming to be it is how a report ends up with two lines for one thing.
 */
export const UomCode = z
  .string()
  .trim()
  .min(1, 'A unit needs a short code')
  .max(12, 'Keep the code to 12 characters — it has to fit on a document line')
  .regex(/^[A-Za-z0-9/-]+$/, 'Use letters, numbers, a slash or a dash')
  .transform((v) => v.toUpperCase());

/**
 * How many base units are in one of a unit.
 *
 * An integer of at least one, and that is a design decision rather than a
 * limitation: a fractional factor makes on-hand fractional, and an inventory
 * system that can hold 4.999999 of something cannot reconcile. Goods that
 * genuinely divide get a SMALLER base unit — stock grams, and sell a 500 g bag
 * as a unit of 500.
 */
export const UnitsPerUom = z
  .number()
  .int('A unit has to contain a whole number of the base unit')
  .min(1, 'A unit contains at least one of the base unit')
  .max(1_000_000, 'That is larger than any pack we can sensibly count');

// ─── Writes ──────────────────────────────────────────────────────────────────

export const CreateUnitOfMeasureInput = z.object({
  code: UomCode,
  name: z.string().trim().min(1).max(60),
  /** Left off, the plural is the name with an "s" — right for boxes and cases,
   *  wrong for inches, which is why it can be given. */
  pluralName: z.string().trim().min(1).max(60).optional(),
  dimension: UomDimension.optional(),
});
export type CreateUnitOfMeasureInput = z.infer<typeof CreateUnitOfMeasureInput>;

export const UpdateUnitOfMeasureInput = z.object({
  code: UomCode.optional(),
  name: z.string().trim().min(1).max(60).optional(),
  pluralName: z.string().trim().min(1).max(60).optional(),
  dimension: UomDimension.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUnitOfMeasureInput = z.infer<typeof UpdateUnitOfMeasureInput>;

/** One conversion for one item: "a case of THIS is twelve". */
export const VariantUomConversionInput = z.object({
  uomId: Uuid,
  unitsPerUom: UnitsPerUom,
  isPurchaseDefault: z.boolean().optional(),
  isSalesDefault: z.boolean().optional(),
});
export type VariantUomConversionInput = z.infer<typeof VariantUomConversionInput>;

/**
 * The whole set for one item, replaced at once.
 *
 * Replace rather than patch because the defaults are a property of the SET —
 * "usually bought by the case" is one fact across every conversion, and setting
 * it row by row means a moment where two rows claim it or none does.
 */
export const SetVariantUomsInput = z.object({
  variantId: Uuid,
  /** The unit the ledger counts this item in. `null` clears it back to "each". */
  stockingUomId: Uuid.nullable().optional(),
  conversions: z.array(VariantUomConversionInput).max(20),
});
export type SetVariantUomsInput = z.infer<typeof SetVariantUomsInput>;

/** What a document line records: the unit typed and what it was worth. Both
 *  optional — a line with neither is in base units, which is most of them. */
export const LineUomInput = z.object({
  uomCode: UomCode.optional(),
  unitsPerUom: UnitsPerUom.optional(),
});
export type LineUomInput = z.infer<typeof LineUomInput>;

// ─── The pure arithmetic ─────────────────────────────────────────────────────

/**
 * A quantity someone typed, in base units.
 *
 * The one multiplication in the feature, in one place, so a receipt and a count
 * cannot disagree about what three cartons means.
 */
export function toBaseUnits(quantityInUom: number, unitsPerUom: number): number {
  const factor = Number.isFinite(unitsPerUom) && unitsPerUom >= 1 ? Math.floor(unitsPerUom) : 1;
  return Math.round(quantityInUom * factor);
}

/** Whole units and the leftover base units — 30 base at 12 per case is 2 and 6. */
export function splitIntoUom(
  baseQuantity: number,
  unitsPerUom: number
): { whole: number; remainder: number } {
  const factor = Number.isFinite(unitsPerUom) && unitsPerUom >= 1 ? Math.floor(unitsPerUom) : 1;
  const sign = baseQuantity < 0 ? -1 : 1;
  const magnitude = Math.abs(baseQuantity);
  return { whole: sign * Math.floor(magnitude / factor), remainder: sign * (magnitude % factor) };
}

export interface QuantityDescriptor {
  /** The quantity in BASE units — what is actually stored. */
  baseQuantity: number;
  /** The unit it was entered in, if any. */
  uomCode?: string | null;
  unitsPerUom?: number | null;
  /** Singular and plural for the unit, when known — "case"/"cases". Falls back
   *  to the code, which is why a code is required and a name is not. */
  uomName?: string | null;
  uomPluralName?: string | null;
  /** What the BASE unit is called. Almost always "each". */
  baseUomName?: string | null;
  baseUomPluralName?: string | null;
}

/**
 * Say a quantity the way a person would, with the base amount always present.
 *
 *   48 base, no unit               → "48 each"
 *   48 base, CS × 12               → "4 cases (48 each)"
 *   30 base, CS × 12               → "30 each (2 cases and 6)"
 *   1 base,  CS × 12               → "1 each"
 *
 * The base figure is NEVER dropped. A screen that says only "4 cases" has hidden
 * the number the ledger actually holds, and the first time a factor is wrong
 * nobody can see it. Showing both is what makes a bad factor obvious the moment
 * it is entered rather than at the next stock take.
 */
export function describeQuantity(input: QuantityDescriptor): string {
  const base = input.baseQuantity;
  const baseLabel = pluralise(base, input.baseUomName ?? 'each', input.baseUomPluralName ?? 'each');
  const factor =
    input.unitsPerUom && Number.isFinite(input.unitsPerUom) && input.unitsPerUom >= 1
      ? Math.floor(input.unitsPerUom)
      : 1;

  if (!input.uomCode || factor === 1) return `${formatNumber(base)} ${baseLabel}`;

  const { whole, remainder } = splitIntoUom(base, factor);
  const unitLabel = pluralise(
    whole,
    input.uomName ?? input.uomCode,
    input.uomPluralName ?? `${input.uomName ?? input.uomCode}s`
  );

  // An exact multiple leads with the pack, because that is how it was bought and
  // how it is stacked. Anything else leads with the base amount, because a
  // part-pack is a fact about the shelf and rounding it into "2.5 cases" would
  // invent a half-case nobody can point at.
  if (remainder === 0 && whole !== 0) {
    return `${formatNumber(whole)} ${unitLabel} (${formatNumber(base)} ${baseLabel})`;
  }
  if (whole === 0) return `${formatNumber(base)} ${baseLabel}`;
  return `${formatNumber(base)} ${baseLabel} (${formatNumber(whole)} ${unitLabel} and ${formatNumber(
    Math.abs(remainder)
  )})`;
}

/** The short form for a table cell, where the sentence above is too long:
 *  "4 CS · 48 ea". Falls back to the base figure alone when there is no unit. */
export function describeQuantityShort(input: QuantityDescriptor): string {
  const factor = input.unitsPerUom && input.unitsPerUom >= 1 ? Math.floor(input.unitsPerUom) : 1;
  if (!input.uomCode || factor === 1) return formatNumber(input.baseQuantity);
  const { whole, remainder } = splitIntoUom(input.baseQuantity, factor);
  if (remainder !== 0 || whole === 0) return formatNumber(input.baseQuantity);
  return `${formatNumber(whole)} ${input.uomCode} · ${formatNumber(input.baseQuantity)}`;
}

function pluralise(count: number, singular: string, plural: string): string {
  return Math.abs(count) === 1 ? singular : plural;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

/**
 * The starter set a tenant gets when they have none.
 *
 * Deliberately short. A long list is a list nobody reads, and the units below
 * are the ones almost every business needs before it needs anything else —
 * anything more specific is a business's own vocabulary and it should type it.
 * `EA` is first because it is the base almost everything converts to.
 */
export const STARTER_UNITS: {
  code: string;
  name: string;
  pluralName: string;
  dimension: UomDimension;
}[] = [
  { code: 'EA', name: 'each', pluralName: 'each', dimension: 'count' },
  { code: 'PR', name: 'pair', pluralName: 'pairs', dimension: 'count' },
  { code: 'BX', name: 'box', pluralName: 'boxes', dimension: 'count' },
  { code: 'CS', name: 'case', pluralName: 'cases', dimension: 'count' },
  { code: 'PK', name: 'pack', pluralName: 'packs', dimension: 'count' },
  { code: 'DZ', name: 'dozen', pluralName: 'dozen', dimension: 'count' },
  { code: 'PAL', name: 'pallet', pluralName: 'pallets', dimension: 'count' },
  { code: 'ROL', name: 'roll', pluralName: 'rolls', dimension: 'count' },
  { code: 'G', name: 'gram', pluralName: 'grams', dimension: 'weight' },
  { code: 'KG', name: 'kilogram', pluralName: 'kilograms', dimension: 'weight' },
  { code: 'ML', name: 'millilitre', pluralName: 'millilitres', dimension: 'volume' },
  { code: 'L', name: 'litre', pluralName: 'litres', dimension: 'volume' },
  { code: 'MM', name: 'millimetre', pluralName: 'millimetres', dimension: 'length' },
  { code: 'M', name: 'metre', pluralName: 'metres', dimension: 'length' },
];
