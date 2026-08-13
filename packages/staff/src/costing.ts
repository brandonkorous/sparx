// Turning approved time into money — the arithmetic half of the labour deriver.
//
// Imports only `./pay.js`, and pay.ts imports nothing at all, so everything here
// is testable without a database. That is the point: this is where the module
// produces a plausible wrong number, and a plausible wrong number about wages is
// the one an owner acts on.
//
// THREE THINGS THIS REFUSES TO DO, each of which looks like a reasonable default
// and each of which lies:
//
//   1. It never prices an hour it has no rate for. A day with no rate in force
//      is reported as UNPRICED MINUTES, not costed at zero. Zero is a
//      measurement; "nobody has recorded what this person earns" is not, and
//      rendering the second as the first tells an owner that labour was free.
//   2. It never derives a salary from hours. A salary is incurred whether or not
//      anyone logged time, so it comes from the calendar; the logged time only
//      decides how it is ATTRIBUTED.
//   3. It never spreads unattributed time over the jobs that happen to have been
//      recorded. Hours with no job leave their share unallocated, which is the
//      true statement — the money went out and no job can claim it.

import {
  dayKey,
  hourlyCostCents,
  rateSegments,
  salaryCostCents,
  splitProportionally,
  type PayBasis,
  type PayRate,
} from './pay.js';

/** One approved stretch of work, reduced to what costing actually needs. */
export interface LaborEntry {
  workedOn: Date;
  /** Net of the break, which is why this is authoritative rather than derived here. */
  minutes: number;
  /** The site the work was for, or null to fall back to the person's primary. */
  propertyId: string | null;
  jobType: 'order' | 'booking' | null;
  jobId: string | null;
}

export interface LaborAllocation {
  targetType: 'order' | 'booking';
  targetId: string;
  amountCents: number;
}

export interface LaborSiteCost {
  propertyId: string | null;
  amountCents: number;
  minutes: number;
  allocations: LaborAllocation[];
}

export interface LaborDerivation {
  perSite: LaborSiteCost[];
  totalCents: number;
  /**
   * Approved minutes that fell on days with NO pay rate in force. Surfaced
   * rather than absorbed: the timesheet screen can say "4h 30m across 3 days has
   * no pay rate set", which is actionable, where a silent zero is not.
   */
  unpricedMinutes: number;
  /** Which days those were, so the screen can name them. */
  unpricedDays: string[];
  /** Distinct bases that applied across the period — someone can be hourly in the
   *  first half and salaried in the second, and both are costed properly. */
  bases: PayBasis[];
}

interface Bucket {
  propertyId: string | null;
  amountCents: number;
  minutes: number;
  byJob: Map<string, LaborAllocation>;
}

function bucketFor(buckets: Map<string, Bucket>, propertyId: string | null): Bucket {
  const key = propertyId ?? '';
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { propertyId, amountCents: 0, minutes: 0, byJob: new Map() };
    buckets.set(key, bucket);
  }
  return bucket;
}

function addToJob(bucket: Bucket, entry: LaborEntry, cents: number): void {
  if (!entry.jobType || !entry.jobId || cents === 0) return;
  const key = `${entry.jobType}:${entry.jobId}`;
  const current = bucket.byJob.get(key);
  if (current) {
    current.amountCents += cents;
    return;
  }
  bucket.byJob.set(key, { targetType: entry.jobType, targetId: entry.jobId, amountCents: cents });
}

export function deriveLabor(input: {
  periodStart: Date;
  periodEnd: Date;
  rates: readonly PayRate[];
  entries: readonly LaborEntry[];
  /** The person's primary site — where a cost lands when the entry names none. */
  fallbackPropertyId: string | null;
}): LaborDerivation {
  const buckets = new Map<string, Bucket>();
  const bases = new Set<PayBasis>();
  const unpricedDays = new Set<string>();
  let unpricedMinutes = 0;

  const segments = rateSegments(input.rates, input.periodStart, input.periodEnd);

  // Days the period covers that no rate window reaches. Approved time on one of
  // them is UNPRICED — never zero-costed.
  const pricedDays = new Set<string>();
  for (const segment of segments) {
    const span = Math.round((segment.to.getTime() - segment.from.getTime()) / 86_400_000);
    for (let i = 0; i <= span; i += 1) {
      pricedDays.add(dayKey(new Date(segment.from.getTime() + i * 86_400_000)));
    }
  }
  for (const entry of input.entries) {
    if (entry.minutes <= 0) continue;
    if (pricedDays.has(dayKey(entry.workedOn))) continue;
    unpricedMinutes += entry.minutes;
    unpricedDays.add(dayKey(entry.workedOn));
  }

  for (const segment of segments) {
    bases.add(segment.rate.basis);
    const from = dayKey(segment.from);
    const to = dayKey(segment.to);
    const within = input.entries.filter((e) => {
      const key = dayKey(e.workedOn);
      return key >= from && key <= to && e.minutes > 0;
    });

    if (segment.rate.basis === 'hourly') {
      // Each entry costs what its own hours cost. Nothing is apportioned, so
      // nothing has to be reconciled afterwards.
      for (const entry of within) {
        const cents = hourlyCostCents(segment.rate, entry.minutes);
        const bucket = bucketFor(buckets, entry.propertyId ?? input.fallbackPropertyId);
        bucket.amountCents += cents;
        bucket.minutes += entry.minutes;
        addToJob(bucket, entry, cents);
      }
      continue;
    }

    if (segment.rate.basis === 'salary') {
      const cost = salaryCostCents(segment.rate, segment.days);
      if (cost === 0) continue;

      if (within.length === 0) {
        // Paid, with nothing to attribute it to. It lands on the primary site and
        // stays unallocated — the true statement rather than a tidy one.
        const bucket = bucketFor(buckets, input.fallbackPropertyId);
        bucket.amountCents += cost;
        continue;
      }

      // Split by site first, then by job inside each site — both proportional to
      // logged minutes, both largest-remainder, so the pieces sum to `cost`.
      const sites = [...new Set(within.map((e) => e.propertyId ?? input.fallbackPropertyId))];
      const siteMinutes = sites.map((site) =>
        within
          .filter((e) => (e.propertyId ?? input.fallbackPropertyId) === site)
          .reduce((sum, e) => sum + e.minutes, 0)
      );
      const siteShares = splitProportionally(cost, siteMinutes);

      sites.forEach((site, index) => {
        // `?? 0` throughout rather than `!`: `splitProportionally` returns one
        // entry per weight so these are always present, but an assertion here
        // would be the thing that silently swallowed a future off-by-one.
        const share = siteShares[index] ?? 0;
        if (share === 0) return;
        const bucket = bucketFor(buckets, site);
        const siteEntries = within.filter(
          (e) => (e.propertyId ?? input.fallbackPropertyId) === site
        );
        bucket.amountCents += share;
        bucket.minutes += siteMinutes[index] ?? 0;

        if (!siteEntries.some((e) => e.jobType && e.jobId)) return;
        // WEIGHTED AGAINST ALL OF THE SITE'S MINUTES, not just the ones on a job.
        // `addToJob` then drops the shares belonging to jobless entries, so that
        // time leaves its portion UNALLOCATED rather than inflating whichever
        // jobs happened to get recorded.
        //
        // Weighting over only the job entries is the obvious-looking version and
        // it is wrong: with 100 minutes on a job and 300 on admin, the job would
        // absorb the entire month's salary. That is what this code did until a
        // test caught it — a person who logs one job and does everything else
        // untracked would have made that single job look catastrophic.
        const shares = splitProportionally(
          share,
          siteEntries.map((e) => e.minutes)
        );
        siteEntries.forEach((entry, i) => addToJob(bucket, entry, shares[i] ?? 0));
      });
      continue;
    }

    // `none` — a volunteer, or an owner who does not draw a wage. Those hours
    // genuinely cost zero, which is a measured answer and not a missing one, so
    // they are NOT reported as unpriced. `commission` likewise contributes
    // nothing here: that person's pay is a StaffCommission row reaching the
    // ledger by its own path, and counting it twice would bill it twice.
  }

  const perSite: LaborSiteCost[] = [...buckets.values()]
    .filter((b) => b.amountCents !== 0 || b.minutes !== 0)
    .map((b) => ({
      propertyId: b.propertyId,
      amountCents: b.amountCents,
      minutes: b.minutes,
      allocations: [...b.byJob.values()].filter((a) => a.amountCents > 0),
    }));

  return {
    perSite,
    totalCents: perSite.reduce((sum, s) => sum + s.amountCents, 0),
    unpricedMinutes,
    unpricedDays: [...unpricedDays].sort(),
    bases: [...bases],
  };
}
