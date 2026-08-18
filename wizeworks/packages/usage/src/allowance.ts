// What a tenant is allowed, and how close they are to it.
//
// `index.ts` answers "what did they use". This answers "and how much is that",
// which is a different kind of question: consumption is a fact the platform can
// measure, and an allowance is a commercial decision a BRAND makes. sparx prices
// per active module and caps almost nothing; Piggles charges one flat rate with
// capacity limits, and those limits are its product. So the numbers arrive as
// configuration keyed by brand, exactly like `BRAND_NAME` and `EMAIL_PALETTE` —
// this file states no brand's ceiling and would not need editing for a third.
//
// ── A CEILING NOBODY HAS DECIDED IS `null`, NEVER A GUESS ───────────────────
//
// Piggles' own pricing sheet gives some allowances exactly (3 users, 1 site, 1
// location, 10,000 contacts) and others as a RANGE it explicitly has not settled:
// "10–25 GB storage", "5,000–10,000 email sends/month", under the heading "Final
// numbers must be validated against infrastructure cost."
//
// Picking the middle of somebody's undecided range and rendering it as a limit
// would manufacture a commercial decision out of a placeholder, and the person
// reading "12.4 GB of 25 GB" has no way to tell it from a real one. So an
// unconfigured meter is METERED WITHOUT A CEILING: the usage is shown because it
// is measured, and no bar, no percentage and no warning is drawn because there is
// nothing true to draw them against.
//
// That is the whole reason this can ship before pricing is settled — which it
// must, because usage history cannot be backfilled (see index.ts).
//
// ── THIS IS NOT AN ENFORCEMENT POINT ────────────────────────────────────────
//
// Nothing here blocks anything. `state()` reports where a tenant stands so a
// surface can warn them; the decision to pause a new addition belongs at the
// action, counting live, at the moment it acts. The snapshot these percentages
// are drawn from can be up to 24 hours old, which is right for a nudge and wrong
// for a gate. Piggles' rule that a limit never stops work in progress and never
// degrades what already exists lives with the action, not here.

/** One meter's ceiling, or `null` for "metered, no ceiling decided". */
export interface CapacityAllowance {
  /** Bytes of stored media. */
  storageBytes: bigint | null;
  /** Customer/contact records. */
  contacts: number | null;
  /** Staff seats. */
  seats: number | null;
  /** Sites (web properties). */
  sites: number | null;
  /** Stock locations / warehouses. */
  locations: number | null;
  /** Email sends per calendar month. A FLOW — the only meter here that is a
   *  total over a period rather than a level at a moment. */
  emailSendsPerMonth: number | null;
}

export const NO_ALLOWANCE: CapacityAllowance = {
  storageBytes: null,
  contacts: null,
  seats: null,
  sites: null,
  locations: null,
  emailSendsPerMonth: null,
};

/** The meters, in the order a surface should present them. Discrete units first
 *  (they are the ones a person recognises as "my plan"), then the two that grow
 *  on their own. */
export const METERS = [
  'seats',
  'sites',
  'locations',
  'contacts',
  'storageBytes',
  'emailSendsPerMonth',
] as const;

export type Meter = (typeof METERS)[number];

/**
 * How a meter stands. Four states, and `unmetered` is a first-class one rather
 * than an absence — a meter with no ceiling is not "fine", it is "we are not
 * answering that question", and a surface must render the two differently.
 *
 * `unknown` is the other honest non-answer: the snapshot has no figure, either
 * because the measure failed that night or because this tenant has never been
 * measured. It must never collapse into `ok`, which is a claim.
 */
export type MeterState = 'unmetered' | 'unknown' | 'ok' | 'approaching' | 'over';

/**
 * The fraction of an allowance in use, at and beyond which a surface should say
 * something.
 *
 * 0.8 rather than 0.9: the point of a notice is that somebody can act before the
 * limit lands, and for a stock that grows steadily the last tenth arrives without
 * warning. Deliberately not configurable per brand — when to warn is a usability
 * decision the platform is entitled to make, where how much you get is a
 * commercial one it is not.
 */
export const APPROACHING = 0.8;

export interface MeterReading {
  meter: Meter;
  /** What is in use. `null` = not measured — never rendered as a number. */
  used: bigint | null;
  /** The ceiling, or `null` when none has been set. */
  limit: bigint | null;
  /** `used / limit`, or `null` when either is absent. Never clamped: a tenant at
   *  120% should read as 120%, because rounding it down to "full" hides how far
   *  over they are and how much expansion they need. */
  fraction: number | null;
  state: MeterState;
}

function meterState(used: bigint | null, limit: bigint | null): MeterState {
  if (limit === null) return 'unmetered';
  if (used === null) return 'unknown';
  if (used > limit) return 'over';
  // `>=` on purpose: at exactly the limit the next addition is the one that
  // pauses, which is precisely when somebody wants to have been told.
  if (limit > 0n && Number(used) / Number(limit) >= APPROACHING) return 'approaching';
  return 'ok';
}

/** One meter, resolved. Exported for the surfaces that render a single meter at
 *  a point of friction rather than the whole dashboard. */
export function readMeter(meter: Meter, used: bigint | null, limit: bigint | null): MeterReading {
  const fraction =
    used !== null && limit !== null && limit > 0n ? Number(used) / Number(limit) : null;
  return { meter, used, limit, fraction, state: meterState(used, limit) };
}

/** `PIGGLES_CAPACITY` from `piggles`. Same derivation as every other brand
 *  variable, so this file names no brand. */
function varName(brand: string): string {
  return `${brand
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')}_CAPACITY`;
}

function readEnv(name: string): string | null {
  if (typeof process === 'undefined') return null;
  const value = process.env[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * A configured number, or null.
 *
 * Rejects anything that is not a non-negative integer, and rejects it to NULL
 * rather than to some default — a typo'd ceiling must degrade to "no ceiling
 * decided", which shows usage and warns nobody, instead of to a number that
 * would warn or block on a value nobody wrote. Zero is allowed and means zero:
 * "this brand includes none of these", which is a real allowance.
 */
function readLimit(value: unknown): bigint | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  // Strings are accepted for the byte counts, which exceed what JSON numbers
  // hold safely once anybody sells a terabyte.
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

export interface ResolvedAllowance {
  allowance: CapacityAllowance;
  /** `configured` — the brand published ceilings. `none` — it published none, or
   *  none that parsed, and every meter is therefore unmetered. Callers LOG this:
   *  a brand that meant to set limits and typed the JSON wrong looks exactly like
   *  one that deliberately sets none. */
  source: 'configured' | 'none';
  /** Meters the variable named but could not be read. Empty when `source` is
   *  `none` for the honest reason (nothing was set). A non-empty list here is
   *  somebody's mistake and should be surfaced, not swallowed. */
  rejected: string[];
}

/**
 * One brand's capacity allowance.
 *
 * Unlike the email palette, a partial allowance is ACCEPTED rather than refused.
 * The two are different kinds of object: a palette is one visual decision whose
 * halves are meaningless apart, while each ceiling here stands alone — "3 seats,
 * and storage is not yet decided" is a coherent commercial position and in fact
 * the exact one Piggles is in today. Refusing the whole thing over the one
 * undecided meter would throw away five decisions that were made.
 *
 * Never throws. Same posture as the rest of `brand-core`: this runs on a page a
 * person is waiting for, and a missing ceiling is not worth a 500.
 */
export function resolveCapacityAllowance(brand: string | null | undefined): ResolvedAllowance {
  const key = (brand ?? '').trim().toLowerCase() || 'sparx';
  const raw = readEnv(varName(key));
  if (!raw) return { allowance: NO_ALLOWANCE, source: 'none', rejected: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { allowance: NO_ALLOWANCE, source: 'none', rejected: ['(not valid JSON)'] };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { allowance: NO_ALLOWANCE, source: 'none', rejected: ['(not a JSON object)'] };
  }

  const input = parsed as Record<string, unknown>;
  const rejected: string[] = [];
  const allowance = { ...NO_ALLOWANCE };
  let configured = 0;

  for (const meter of METERS) {
    if (!(meter in input)) continue;
    const limit = readLimit(input[meter]);
    if (limit === null) {
      rejected.push(meter);
      continue;
    }
    configured++;
    if (meter === 'storageBytes') allowance.storageBytes = limit;
    else allowance[meter] = Number(limit);
  }

  for (const name of Object.keys(input)) {
    if (!(METERS as readonly string[]).includes(name)) rejected.push(name);
  }

  return { allowance, source: configured > 0 ? 'configured' : 'none', rejected };
}
