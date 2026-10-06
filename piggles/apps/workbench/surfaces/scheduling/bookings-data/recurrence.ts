/* ── Recurrence: building and reading an RRULE ──────────────────────────── */

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type EndsMode = 'never' | 'count' | 'until';

export const WEEKDAYS: { code: string; label: string; short: string }[] = [
  { code: 'MO', label: 'Monday', short: 'Mon' },
  { code: 'TU', label: 'Tuesday', short: 'Tue' },
  { code: 'WE', label: 'Wednesday', short: 'Wed' },
  { code: 'TH', label: 'Thursday', short: 'Thu' },
  { code: 'FR', label: 'Friday', short: 'Fri' },
  { code: 'SA', label: 'Saturday', short: 'Sat' },
  { code: 'SU', label: 'Sunday', short: 'Sun' },
];

export interface RecurrenceDraft {
  freq: Frequency;
  interval: number;
  byDay: string[];
  ends: EndsMode;
  count: number;
  until: string;
}

/** The last day a series can happen, as an RFC-5545 DATE (`YYYYMMDD`): a DAY, read
 *  on the clock of the place it happens at (sparx persona issue 086). Midnight UTC
 *  was the evening BEFORE in the Americas and dropped the last booking. */
function toUntil(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return day.replace(/-/g, '');
}

/** Assemble an RRULE from the friendly draft, or null if it is not yet valid. */
export function buildRrule(draft: RecurrenceDraft): string | null {
  if (draft.interval < 1) return null;
  if (draft.freq === 'WEEKLY' && draft.byDay.length === 0) return null;
  const parts = [`FREQ=${draft.freq}`];
  if (draft.interval > 1) parts.push(`INTERVAL=${String(draft.interval)}`);
  if (draft.freq === 'WEEKLY' && draft.byDay.length > 0) {
    // Keep the canonical week order regardless of click order.
    const ordered = WEEKDAYS.filter((d) => draft.byDay.includes(d.code)).map((d) => d.code);
    parts.push(`BYDAY=${ordered.join(',')}`);
  }
  if (draft.ends === 'count') {
    if (draft.count < 1) return null;
    parts.push(`COUNT=${String(draft.count)}`);
  }
  if (draft.ends === 'until') {
    const until = toUntil(draft.until);
    if (!until) return null;
    parts.push(`UNTIL=${until}`);
  }
  return parts.join(';');
}

interface ParsedRule {
  freq: string | null;
  interval: number;
  byDay: string[];
  count: number | null;
  until: string | null;
}

function parseRrule(rrule: string): ParsedRule {
  const body = rrule.replace(/^RRULE:/i, '').trim();
  const map = new Map<string, string>();
  for (const pair of body.split(';')) {
    const [k, v] = pair.split('=');
    if (k && v) map.set(k.toUpperCase(), v);
  }
  const intervalRaw = map.get('INTERVAL');
  const countRaw = map.get('COUNT');
  return {
    freq: map.get('FREQ') ?? null,
    interval: intervalRaw ? Number(intervalRaw) : 1,
    byDay: map.get('BYDAY')?.split(',').filter(Boolean) ?? [],
    count: countRaw ? Number(countRaw) : null,
    until: map.get('UNTIL') ?? null,
  };
}

export function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join('');
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** An RRULE said in plain words — "Every 2 weeks on Monday and Wednesday, 12 times." */
export function humanizeRrule(rrule: string): string {
  const rule = parseRrule(rrule);
  if (!rule.freq) return 'A custom repeating pattern';

  const unit =
    rule.freq === 'DAILY'
      ? { one: 'day', many: 'days' }
      : rule.freq === 'WEEKLY'
        ? { one: 'week', many: 'weeks' }
        : rule.freq === 'MONTHLY'
          ? { one: 'month', many: 'months' }
          : { one: 'time', many: 'times' };

  const every =
    rule.interval > 1 ? `Every ${String(rule.interval)} ${unit.many}` : `Every ${unit.one}`;

  let sentence = every;
  if (rule.freq === 'WEEKLY' && rule.byDay.length > 0) {
    const days = rule.byDay
      .map((code) => WEEKDAYS.find((d) => d.code === code)?.label ?? code)
      .filter(Boolean);
    sentence += ` on ${joinWords(days)}`;
  }
  if (rule.count) {
    sentence += `, ${String(rule.count)} ${rule.count === 1 ? 'time' : 'times'}`;
  } else if (rule.until) {
    const year = rule.until.slice(0, 4);
    const month = rule.until.slice(4, 6);
    const day = rule.until.slice(6, 8);
    const parsed = new Date(`${year}-${month}-${day}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      sentence += `, until ${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parsed)}`;
    }
  } else {
    sentence += ', ongoing';
  }
  return sentence;
}
