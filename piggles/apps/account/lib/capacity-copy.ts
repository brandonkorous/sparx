import type { Meter, MeterReading } from '@wizeworks/usage';

// How a meter reads to a shop owner. Names are the lexicon's, not the platform's
// — nobody has "seats" or "contacts"; they have people and customers.

export const METER_LABEL: Record<Meter, string> = {
  seats: 'People on your team',
  sites: 'Websites',
  locations: 'Locations',
  contacts: 'Customers',
  storageBytes: 'Photos and files',
  emailSendsPerMonth: 'Messages sent this month',
};

/** Bytes as a person reads them. Whole units under 10 to avoid "1.0 GB". */
export function formatBytes(bytes: bigint): string {
  const n = Number(bytes);
  if (n < 1000) return `${n} bytes`;
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let value = n / 1000;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

function formatCount(value: bigint): string {
  return Number(value).toLocaleString('en-US');
}

/** One meter's value, in its own units. */
export function formatUsed(meter: Meter, value: bigint): string {
  return meter === 'storageBytes' ? formatBytes(value) : formatCount(value);
}

/**
 * The headline for one meter. Three shapes, because there are three genuinely
 * different answers and only one of them is a measurement against a limit.
 */
export function meterHeadline(m: MeterReading): string {
  if (m.used === null) return 'Not measured yet';
  const used = formatUsed(m.meter, m.used);
  if (m.limit === null) return used;
  return `${used} of ${formatUsed(m.meter, m.limit)}`;
}

/**
 * What to say under the headline, or null for nothing.
 *
 * `unknown` explains itself, because "Not measured yet" invites the question.
 * `unmetered` says nothing: a meter with no ceiling is just a number, and adding
 * "no limit" beside every one of them would turn the honest absence of a limit
 * into a promise nobody made.
 */
export function meterNote(m: MeterReading): string | null {
  switch (m.state) {
    case 'over':
      return 'You are past what your plan includes.';
    case 'approaching':
      return 'Getting close to what your plan includes.';
    case 'unknown':
      return 'We have not counted this one yet — it is measured overnight.';
    default:
      return null;
  }
}

/** Semantic tone for the bar and the note. Never neutral: a meter's state is
 *  exactly the kind of thing color is for. */
export function meterTone(m: MeterReading): 'danger' | 'warning' | 'primary' {
  if (m.state === 'over') return 'danger';
  if (m.state === 'approaching') return 'warning';
  return 'primary';
}
