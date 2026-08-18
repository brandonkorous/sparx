// Barcodes — symbology, validation, and the equivalence rules a scanner forces
// on us (docs/146 Phase 3.1).
//
// This file is deliberately PURE: no DOM, no Prisma, no rendering. The same
// functions run in the service that writes the registry, in the API that
// validates the input, and in the workbench that prints the label — because a
// check digit computed one way on the server and another way in the browser is
// a bug that only ever shows up on paper, after four hundred of them are printed.
//
// Rendering (jsbarcode, canvas, SVG) lives in the app that draws pixels.

import { z } from 'zod';

// ── Symbologies ─────────────────────────────────────────────────────────────
//
// The format a code is ENCODED in, which is not the same question as where it
// came from (`BarcodeSource`) or what it means (pack size, primary).
export const BarcodeSymbology = z.enum([
  'upc_a', // 12 digits. North American retail unit.
  'upc_e', // 8 digits, a zero-suppressed UPC-A. Small packages.
  'ean_13', // 13 digits. The international unit code; a UPC-A with a leading 0.
  'ean_8', // 8 digits. Small packages, outside North America.
  'gtin_14', // 14 digits. The case/carton code.
  'itf_14', // 14 digits, Interleaved 2-of-5 encoding of a GTIN-14. Corrugated.
  'code_128', // Any ASCII. No check digit of its own. Internal codes, shipping.
  'code_39', // Letters, digits, a few symbols. Asset tags, older systems.
  'qr', // 2D. Shelf labels, anything read off-angle by a phone.
  'other', // Something we were handed and will not pretend to understand.
]);
export type BarcodeSymbology = z.infer<typeof BarcodeSymbology>;

export const BarcodeSource = z.enum([
  'manual', // Somebody typed it in.
  'generated', // We minted it, so it is ours to reprint.
  'import', // Came in on a spreadsheet or from the old system.
  'supplier', // The code on the supplier's packaging.
  'channel', // Arrived from a marketplace listing.
  'scan', // Registered by scanning an unknown code onto a known item.
]);
export type BarcodeSource = z.infer<typeof BarcodeSource>;

/** The fixed-length, check-digit-bearing GTIN family — the codes the outside world means by "barcode". */
const GTIN_FAMILY: ReadonlySet<BarcodeSymbology> = new Set([
  'upc_a',
  'upc_e',
  'ean_13',
  'ean_8',
  'gtin_14',
  'itf_14',
]);

/**
 * Whether this symbology is a GTIN — i.e. whether it is the code Google
 * Shopping, Amazon and the product feeds mean, and therefore whether it is
 * allowed to mirror down into `ProductVariant.barcode`.
 */
export function isGtin(symbology: BarcodeSymbology): boolean {
  return GTIN_FAMILY.has(symbology);
}

/** Symbologies whose value is case-insensitive and therefore stored upper-cased. */
const UPPERCASE_SYMBOLOGIES: ReadonlySet<BarcodeSymbology> = new Set(['code_39']);

// ── Normalization ───────────────────────────────────────────────────────────

/**
 * Canonical storage form.
 *
 * Trims, strips ALL internal whitespace, and upper-cases where the symbology is
 * case-insensitive. Without this the `UNIQUE (tenant_id, value)` index is
 * defeated by a trailing space pasted out of a spreadsheet, and the duplicate it
 * exists to catch walks straight in.
 *
 * Code 128 and QR are left case-sensitive on purpose: they encode arbitrary
 * payloads, and upper-casing someone's URL or serial would change what the code
 * actually says.
 */
export function normalizeBarcode(value: string, symbology?: BarcodeSymbology): string {
  const stripped = value.replace(/\s+/g, '');
  if (symbology && UPPERCASE_SYMBOLOGIES.has(symbology)) return stripped.toUpperCase();
  // With no symbology declared we are pre-detection: only safe, universal cleanup.
  return stripped;
}

const DIGITS_ONLY = /^[0-9]+$/;

/**
 * Best guess at the symbology of a raw scan.
 *
 * Length is the whole signal for the numeric family, and it is nearly always
 * enough: a scanner reports digits, not a format, so this is what runs when the
 * caller does not say — which is almost always.
 *
 * The one genuine ambiguity is EIGHT digits, which is both EAN-8 and UPC-E. This
 * resolves it to `ean_8` because it is far commoner in catalogue data, and the
 * cost of being wrong is small: `scanEquivalents` below tries the UPC-E reading
 * as well, so a mislabelled row still resolves when someone scans it.
 */
export function detectSymbology(value: string): BarcodeSymbology {
  const v = normalizeBarcode(value);
  if (!DIGITS_ONLY.test(v)) return 'code_128';
  switch (v.length) {
    case 8:
      return 'ean_8';
    case 12:
      return 'upc_a';
    case 13:
      return 'ean_13';
    case 14:
      return 'gtin_14';
    default:
      return 'code_128';
  }
}

// ── Check digits ────────────────────────────────────────────────────────────

/**
 * The GS1 mod-10 check digit for a payload that does NOT include one.
 *
 * Weights alternate 3,1 from the RIGHTMOST payload digit leftward — the same
 * calculation for UPC-A, EAN-8, EAN-13 and GTIN-14, which is why one function
 * covers all four. Throws on a non-numeric payload rather than returning a
 * plausible-looking digit for input that was never a GTIN.
 */
export function gs1CheckDigit(payload: string): number {
  if (!DIGITS_ONLY.test(payload)) {
    throw new Error('GS1 check digit requires a numeric payload');
  }
  let sum = 0;
  for (let i = payload.length - 1, weight = 3; i >= 0; i -= 1, weight = weight === 3 ? 1 : 3) {
    sum += Number(payload[i]) * weight;
  }
  return (10 - (sum % 10)) % 10;
}

/** Append the GS1 check digit to a payload — the form used when minting a code. */
export function withGs1CheckDigit(payload: string): string {
  return `${payload}${gs1CheckDigit(payload)}`;
}

/**
 * Expand a zero-suppressed UPC-E to its full UPC-A.
 *
 * Real scanners emit UPC-E for small packages, and unless we expand it a tenant
 * who registered the UPC-A — which is what is printed on the invoice and in
 * every catalogue — gets "unknown barcode" for an item they definitely have.
 * Returns null for anything that is not a well-formed UPC-E.
 */
export function expandUpcE(value: string): string | null {
  const v = normalizeBarcode(value);
  if (v.length !== 8 || !DIGITS_ONLY.test(v)) return null;
  const system = v[0];
  // Only number systems 0 and 1 have a UPC-E form at all.
  if (system !== '0' && system !== '1') return null;
  const [s1, s2, s3, s4, s5, s6] = v.slice(1, 7);
  const check = v[7];

  let middle: string;
  switch (s6) {
    case '0':
    case '1':
    case '2':
      middle = `${s1}${s2}${s6}0000${s3}${s4}${s5}`;
      break;
    case '3':
      middle = `${s1}${s2}${s3}00000${s4}${s5}`;
      break;
    case '4':
      middle = `${s1}${s2}${s3}${s4}00000${s5}`;
      break;
    default:
      middle = `${s1}${s2}${s3}${s4}${s5}0000${s6}`;
      break;
  }
  return `${system}${middle}${check}`;
}

/**
 * Every form the SAME physical code can be reported as, normalized value first.
 *
 * Scan resolution looks up all of them, because which one arrives is a property
 * of how the gun is configured rather than of the item:
 *
 *   • A UPC-A read by a gun in EAN-13 mode arrives with a leading zero.
 *   • An EAN-13 beginning 0 is a UPC-A with the zero stripped.
 *   • A UPC-E is a zero-suppressed UPC-A and expands to one.
 *   • A GTIN-14 whose indicator digit is 0 wraps an EAN-13 unit code.
 *
 * Without this, "we registered the barcode and it still says unknown" is a
 * support ticket the tenant cannot possibly diagnose.
 */
export function scanEquivalents(value: string): string[] {
  const v = normalizeBarcode(value);
  const out = new Set<string>([v]);
  if (!DIGITS_ONLY.test(v)) return [...out];

  if (v.length === 12) out.add(`0${v}`); // UPC-A read as EAN-13
  if (v.length === 13 && v.startsWith('0')) out.add(v.slice(1)); // EAN-13 that is a UPC-A
  if (v.length === 8) {
    const expanded = expandUpcE(v);
    if (expanded) {
      out.add(expanded);
      out.add(`0${expanded}`);
    }
  }
  if (v.length === 14 && v.startsWith('0')) out.add(v.slice(1)); // GTIN-14 wrapping an EAN-13
  if (v.length === 13) out.add(`0${v}`); // EAN-13 as a GTIN-14 unit

  return [...out];
}

export interface BarcodeValidation {
  ok: boolean;
  /** Canonical storage form. Present even when `ok` is false, so the caller can echo what it read. */
  value: string;
  symbology: BarcodeSymbology;
  /** Plain-language, for a warehouse screen — never "constraint violation". */
  error?: string;
}

const EXPECTED_LENGTH: Partial<Record<BarcodeSymbology, number>> = {
  upc_a: 12,
  upc_e: 8,
  ean_13: 13,
  ean_8: 8,
  gtin_14: 14,
  itf_14: 14,
};

/**
 * Validate a barcode against its symbology, computing the check digit where the
 * format has one.
 *
 * This is the point of storing a symbology at all: a mis-keyed UPC is caught
 * here, before it reaches the registry, rather than on the day someone scans a
 * carton and the wrong item comes up. Code 128, Code 39 and QR carry no check
 * digit and are accepted as typed — refusing them would be inventing a rule the
 * symbology does not have.
 */
export function validateBarcode(raw: string, declared?: BarcodeSymbology): BarcodeValidation {
  const symbology = declared ?? detectSymbology(raw);
  const value = normalizeBarcode(raw, symbology);

  if (value.length === 0) {
    return { ok: false, value, symbology, error: 'Enter a barcode.' };
  }
  if (value.length > 64) {
    return { ok: false, value, symbology, error: 'A barcode can be at most 64 characters.' };
  }

  const expected = EXPECTED_LENGTH[symbology];
  if (expected !== undefined) {
    if (!DIGITS_ONLY.test(value)) {
      return {
        ok: false,
        value,
        symbology,
        error: `${symbologyLabel(symbology)} codes are digits only.`,
      };
    }
    if (value.length !== expected) {
      return {
        ok: false,
        value,
        symbology,
        error: `${symbologyLabel(symbology)} is ${expected} digits — this one has ${value.length}.`,
      };
    }
  }

  if (symbology === 'upc_e') {
    const expanded = expandUpcE(value);
    if (!expanded) {
      return { ok: false, value, symbology, error: 'This is not a valid UPC-E code.' };
    }
    return checkDigitResult(expanded, value, symbology);
  }

  if (expected !== undefined) {
    return checkDigitResult(value, value, symbology);
  }

  // code_128 / code_39 / qr / other — no check digit exists to verify.
  if (symbology === 'code_39' && !/^[0-9A-Z\-. $/+%]+$/.test(value)) {
    return {
      ok: false,
      value,
      symbology,
      error: 'Code 39 allows digits, capital letters, and - . space $ / + % only.',
    };
  }
  return { ok: true, value, symbology };
}

function checkDigitResult(
  checkable: string,
  value: string,
  symbology: BarcodeSymbology
): BarcodeValidation {
  const payload = checkable.slice(0, -1);
  const given = Number(checkable.slice(-1));
  const want = gs1CheckDigit(payload);
  if (given !== want) {
    return {
      ok: false,
      value,
      symbology,
      // Naming the expected digit turns "invalid" into something a person can
      // act on — nine times in ten one digit was mis-typed and this shows which.
      error: `Check digit does not match — this code should end in ${want}, not ${given}.`,
    };
  }
  return { ok: true, value, symbology };
}

const SYMBOLOGY_LABELS: Record<BarcodeSymbology, string> = {
  upc_a: 'UPC-A',
  upc_e: 'UPC-E',
  ean_13: 'EAN-13',
  ean_8: 'EAN-8',
  gtin_14: 'GTIN-14',
  itf_14: 'ITF-14',
  code_128: 'Code 128',
  code_39: 'Code 39',
  qr: 'QR code',
  other: 'Other',
};

export function symbologyLabel(symbology: BarcodeSymbology): string {
  return SYMBOLOGY_LABELS[symbology] ?? 'Barcode';
}

/** What each symbology is for, in the words of somebody who does not work here. */
export const SYMBOLOGY_HINTS: Record<BarcodeSymbology, string> = {
  upc_a: 'The 12-digit code on North American retail packaging.',
  upc_e: 'A shortened 8-digit UPC used on small packages.',
  ean_13: 'The 13-digit international retail code.',
  ean_8: 'A shortened 8-digit code for small packages.',
  gtin_14: 'The 14-digit code identifying a case or carton.',
  itf_14: 'The wide 14-digit code printed straight onto corrugated boxes.',
  code_128: 'Any letters or numbers — internal codes, shipping labels.',
  code_39: 'Letters and digits — asset tags and older systems.',
  qr: 'A square 2D code, readable off-angle by a phone camera.',
  other: 'Something else — stored as scanned, not validated.',
};

// ── Internal codes ──────────────────────────────────────────────────────────

/**
 * The GS1 number system reserved for restricted circulation — codes valid only
 * inside one company. Minting here means a generated barcode can never collide
 * with a manufacturer's, and a scanner reads it as an ordinary UPC with no
 * configuration at all.
 */
const INTERNAL_NUMBER_SYSTEM = '2';

/** The largest body an internal UPC-A can carry: 12 digits minus the system digit and the check digit. */
export const INTERNAL_BARCODE_MAX = 9_999_999_999n;

/**
 * Mint the `n`th internal barcode as a real UPC-A.
 *
 * Not an invented format — a genuine number-system-2 UPC-A, so it scans on any
 * gun, prints on any label, and carries a check digit that catches a mis-read.
 */
export function internalBarcode(sequence: bigint): string {
  if (sequence < 1n || sequence > INTERNAL_BARCODE_MAX) {
    throw new Error(`Internal barcode sequence out of range: ${sequence}`);
  }
  const body = sequence.toString().padStart(10, '0');
  return withGs1CheckDigit(`${INTERNAL_NUMBER_SYSTEM}${body}`);
}

/** Whether a value looks like one of ours — a 12-digit UPC-A in the restricted range. */
export function isInternalBarcode(value: string): boolean {
  const v = normalizeBarcode(value);
  return v.length === 12 && v.startsWith(INTERNAL_NUMBER_SYSTEM) && DIGITS_ONLY.test(v);
}

// ── Write schemas ───────────────────────────────────────────────────────────

export const BarcodeValue = z
  .string()
  .trim()
  .min(1, 'Enter a barcode.')
  .max(64, 'A barcode can be at most 64 characters.');

export const CreateVariantBarcodeInput = z.object({
  variantId: z.uuid(),
  value: BarcodeValue,
  /** Omit and it is detected from the value, which is what a scanner gives you. */
  symbology: BarcodeSymbology.optional(),
  packSize: z.number().int().min(1).max(100_000).default(1),
  isPrimary: z.boolean().default(false),
  supplierId: z.uuid().nullish(),
  label: z.string().trim().max(120).nullish(),
  source: BarcodeSource.default('manual'),
  /**
   * Accept a code whose check digit does not compute. Off by default and
   * deliberately awkward to reach: the override exists because legacy data
   * genuinely contains bad GTINs that are nonetheless printed on the shelf, and
   * refusing to record reality teaches people to record it somewhere else.
   */
  allowInvalidCheckDigit: z.boolean().default(false),
});
export type CreateVariantBarcodeInput = z.infer<typeof CreateVariantBarcodeInput>;

export const UpdateVariantBarcodeInput = z.object({
  packSize: z.number().int().min(1).max(100_000).optional(),
  isPrimary: z.boolean().optional(),
  supplierId: z.uuid().nullish(),
  label: z.string().trim().max(120).nullish(),
  isActive: z.boolean().optional(),
});
export type UpdateVariantBarcodeInput = z.infer<typeof UpdateVariantBarcodeInput>;

export const GenerateVariantBarcodesInput = z.object({
  /** The variants to mint a code for. Ones that already have a primary are skipped, not overwritten. */
  variantIds: z.array(z.uuid()).min(1).max(500),
  /** Mint even for variants that already have a barcode, adding a second, internal one. */
  force: z.boolean().default(false),
});
export type GenerateVariantBarcodesInput = z.infer<typeof GenerateVariantBarcodesInput>;

export const ListVariantBarcodesQuery = z.object({
  variantId: z.uuid().optional(),
  supplierId: z.uuid().optional(),
  symbology: BarcodeSymbology.optional(),
  source: BarcodeSource.optional(),
  search: z.string().trim().max(64).optional(),
  includeInactive: z.boolean().default(false),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});
export type ListVariantBarcodesQuery = z.infer<typeof ListVariantBarcodesQuery>;
