// Pay rates and the arithmetic over them — the part that goes quietly wrong.
//
// THIS FILE IMPORTS NOTHING. No database, no clock, no `new Date()` with no
// argument. That is deliberate and load-bearing rather than tidy: costing an
// hour is where this module produces a plausible wrong number, and pure code is
// the only kind you can test exhaustively without a Postgres. The persistence
// half lives in `rates.ts`, which imports this.
//
// THE BUG THE EFFECTIVE-DATED MODEL EXISTS TO PREVENT. A rate stored as a column
// on the person rewrites the cost of every job they have ever worked the moment
// someone gets a raise: last quarter's profit changes for a reason that has
// nothing to do with last quarter, and nobody can tell that it did. So a rate is
// a ROW with a validity window, and everything that costs an hour asks "what was
// the rate in force on the day that hour was worked".

/* ── The vocabulary ─────────────────────────────────────────────────────────── */

/**
 * How this person is paid.
 *
 * `none` is a REAL answer, not a missing one — a volunteer, an owner who does not
 * pay themselves a wage, a family member helping out. Their hours cost zero and
 * the deriver writes nothing. It is deliberately distinguishable from "nobody has
 * told us what this person earns", where the honest behaviour is to derive
 * nothing AND say so, rather than to tell the business a week of someone's labour
 * was free.
 */
export type PayBasis = 'hourly' | 'salary' | 'commission' | 'none';

export interface PayRate {
  id: string;
  basis: PayBasis;
  /** Cents. Per hour under `hourly`; per YEAR under `salary`. Zero under `none`. */
  amountCents: number;
  currency: string;
  /**
   * Employer cost ON TOP of the wage, as a percentage — the employer's share of
   * payroll taxes, workers' comp, insurance.
   *
   * A multiplier for the owner's own cost reporting and nothing else. sparx never
   * calculates a withholding, never files, and never tells anyone what they owe.
   * It exists because a labour figure that ignores burden runs systematically
   * 15–30% light, which is the "confidently wrong" failure this module was built
   * to prevent.
   */
  burdenPercent: number;
  /**
   * The share of a SALE earned, under `basis: 'commission'` and zero otherwise.
   *
   * A separate field from `amountCents` because that one is per-hour under
   * `hourly` and per-YEAR under `salary` — there was no unit left that could
   * mean "7.5% of what they sell", which is why `commission` was a basis the
   * model could name and could not describe, and why nothing calculated a
   * commission until migration 20270324000000 added the column.
   */
  commissionPercent: number;
  effectiveFrom: Date;
  /** Null = the rate in force today. */
  effectiveTo: Date | null;
  /** Why this rate exists — "annual review", "promoted to lead tech". Carried
   *  because the surface renders a Note column against every window; leaving it
   *  off the type is how a note the API accepted, stored and displayed a column
   *  for still came back empty on every read. */
  note: string | null;
}

/* ── Calendar helpers ───────────────────────────────────────────────────────── */

/**
 * A calendar day as `YYYY-MM-DD`, read in UTC.
 *
 * Prisma hands back a `@db.Date` as a Date at UTC midnight, so UTC getters are
 * the only ones that round-trip. Local getters would move every boundary by a day
 * for anyone west of Greenwich — and a pay rate that starts a day early is a rate
 * applied to work it was never meant to cover.
 */
export function dayKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** A `YYYY-MM-DD` key back to the UTC-midnight Date the database stores. */
export function dayFromKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Whole days from `from` to `to`, inclusive of both ends. */
export function inclusiveDayCount(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  if (b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** 365, or 366 in a leap year. Used to amortise an annual salary honestly. */
export function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

/* ── Which rate applied ─────────────────────────────────────────────────────── */

/**
 * The rate in force on a given day, or null when none was.
 *
 * NULL IS THE POINT. A person hired in March has no rate covering February, and
 * the only honest answer for February is "we do not know what that cost" — not
 * zero. Every caller has to handle the null rather than defaulting, because a
 * defaulted zero silently tells an owner that labour was free.
 */
export function rateInForceOn(rates: readonly PayRate[], day: Date): PayRate | null {
  const key = dayKey(day);
  let best: PayRate | null = null;
  for (const rate of rates) {
    if (dayKey(rate.effectiveFrom) > key) continue;
    if (rate.effectiveTo && dayKey(rate.effectiveTo) < key) continue;
    // Later start wins, so a same-day correction supersedes the row it replaced
    // even when the older row was never closed.
    if (!best || dayKey(rate.effectiveFrom) > dayKey(best.effectiveFrom)) best = rate;
  }
  return best;
}

/** Whether two windows share any day. Open-ended (`effectiveTo: null`) runs forever. */
export function windowsOverlap(
  a: { effectiveFrom: Date; effectiveTo: Date | null },
  b: { effectiveFrom: Date; effectiveTo: Date | null }
): boolean {
  const aFrom = dayKey(a.effectiveFrom);
  const bFrom = dayKey(b.effectiveFrom);
  const aTo = a.effectiveTo ? dayKey(a.effectiveTo) : null;
  const bTo = b.effectiveTo ? dayKey(b.effectiveTo) : null;
  if (aTo && aTo < bFrom) return false;
  if (bTo && bTo < aFrom) return false;
  return true;
}

export interface RateSegment {
  rate: PayRate;
  from: Date;
  to: Date;
  days: number;
}

/**
 * The rate windows that touch `[from, to]`, clipped to it and in date order.
 *
 * This is what makes a mid-period raise cost correctly: a salaried person who
 * moved from $52k to $60k on the 15th is amortised as two segments, not as one
 * period at whichever rate happened to be picked.
 *
 * Walks the period a day at a time and coalesces runs. A period is at most a few
 * hundred days, and this is unambiguous where interval algebra is easy to get
 * subtly wrong — the clarity is worth the loop.
 */
export function rateSegments(rates: readonly PayRate[], from: Date, to: Date): RateSegment[] {
  const segments: RateSegment[] = [];
  const total = inclusiveDayCount(from, to);
  if (total <= 0) return segments;

  let current: RateSegment | null = null;
  for (let i = 0; i < total; i += 1) {
    const day = new Date(from.getTime() + i * 86_400_000);
    const rate = rateInForceOn(rates, day);
    if (!rate) {
      current = null;
      continue;
    }
    if (current?.rate.id === rate.id) {
      current.to = day;
      current.days += 1;
      continue;
    }
    current = { rate, from: day, to: day, days: 1 };
    segments.push(current);
  }
  return segments;
}

/* ── Costing ────────────────────────────────────────────────────────────────── */

/**
 * Add the employer burden to a wage figure, in integer cents.
 *
 * Basis points, not floats: `base * 1.0725` is a float multiply on money, and
 * `Math.round(Number('0.145') * 100)` is 14 rather than 15 for exactly the reason
 * this codebase keeps money in integers everywhere.
 */
export function applyBurden(baseCents: number, burdenPercent: number): number {
  if (burdenPercent <= 0) return baseCents;
  const bps = Math.round(burdenPercent * 100);
  return baseCents + Math.round((baseCents * bps) / 10_000);
}

/** What `minutes` at an hourly rate cost the business, burden included. */
export function hourlyCostCents(rate: PayRate, minutes: number): number {
  if (rate.basis !== 'hourly' || minutes <= 0) return 0;
  return applyBurden(Math.round((rate.amountCents * minutes) / 60), rate.burdenPercent);
}

/**
 * What a salaried person cost over a span of days, burden included.
 *
 * Amortised by DAYS OVER DAYS-IN-THAT-YEAR rather than by "annual ÷ 12", so a
 * 28-day February and a 31-day March do not cost the same, and twelve monthly
 * runs sum back to the annual figure to within a few cents of rounding. The year
 * comes from the segment's start — right except for a segment straddling New
 * Year, which `rateSegments` already splits whenever the rate changes, and which
 * is off by at most one day's worth when it does not.
 */
export function salaryCostCents(rate: PayRate, days: number): number {
  if (rate.basis !== 'salary' || days <= 0) return 0;
  const year = daysInYear(rate.effectiveFrom.getUTCFullYear());
  return applyBurden(Math.round((rate.amountCents * days) / year), rate.burdenPercent);
}

/**
 * Split `total` across `weights` so the parts sum to EXACTLY `total`.
 *
 * Largest remainder, not naive rounding. Rounding each share independently loses
 * or gains cents against the total, and a job-profitability screen whose parts do
 * not add up to the expense they came from is a screen nobody trusts twice.
 * Returns all zeros when every weight is zero — the honest answer for a salaried
 * week where nobody logged anything against a job.
 */
export function splitProportionally(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total === 0) return weights.map(() => 0);

  const exact = weights.map((w) => (total * w) / sum);
  const floors = exact.map((v) => Math.floor(v));
  let remainder = total - floors.reduce((a, b) => a + b, 0);

  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const out = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    out[i] = (out[i] ?? 0) + 1;
    remainder -= 1;
  }
  return out;
}

/**
 * `2026-03` for a whole calendar month, `2026-03-16..2026-03-31` for anything
 * else. Half of the labour deriver's idempotency identity, so it is derived from
 * the period and nothing else — never from a clock.
 */
export function periodKey(from: Date, to: Date): string {
  const fromKey = dayKey(from);
  const toKey = dayKey(to);
  const firstOfMonth = `${fromKey.slice(0, 7)}-01`;
  const lastOfMonth = dayKey(new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0)));
  if (fromKey === firstOfMonth && toKey === lastOfMonth) return fromKey.slice(0, 7);
  return `${fromKey}..${toKey}`;
}
