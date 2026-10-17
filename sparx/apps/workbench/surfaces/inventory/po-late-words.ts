// When a placed order is past its expected day (persona issue 280).

const DAY_MS = 86_400_000;

type Order = { status: string; expectedArrivalAt: string | null };

/** Whole days past the expected day for an order still coming; null when it is
 *  not late. The day is read in UTC, as the Expected field shows it. */
export function lateDays(po: Order, now: Date = new Date()): number | null {
  if (!po.expectedArrivalAt || (po.status !== 'submitted' && po.status !== 'partial')) return null;
  const due = Date.parse(`${po.expectedArrivalAt.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(due)) return null;
  const days = Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - due) / DAY_MS
  );
  return days > 0 ? days : null;
}

/** "It is 7 days late: it was due October 7." for the order itself. */
export function lateWords(po: Order, now: Date = new Date()): string | null {
  const days = lateDays(po, now);
  if (days === null || !po.expectedArrivalAt) return null;
  const when = new Date(`${po.expectedArrivalAt.slice(0, 10)}T00:00:00Z`).toLocaleDateString(
    'en-US',
    {
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }
  );
  return days === 1
    ? `It was due yesterday, ${when}.`
    : `It is ${String(days)} days late: it was due ${when}.`;
}

/** "7 days late" for a list row, or null. */
export function lateBadge(po: Order, now: Date = new Date()): string | null {
  const days = lateDays(po, now);
  if (days === null) return null;
  return days === 1 ? '1 day late' : `${String(days)} days late`;
}
