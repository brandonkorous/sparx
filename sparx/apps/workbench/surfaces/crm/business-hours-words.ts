// Opening hours in the words a person would use (persona issue 268).

import { zoneWords } from '../../lib/wall-clock';
import { clockLabel } from '../automations/schedule-clock';
import type { SlaPolicy } from './tickets-data';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon–Fri, 9:00am–5:00pm, Mountain time". Days with the same hours run
 *  together; empty hours mean the desk never closes, which is worth saying. */
export function describeHours(policy: Pick<SlaPolicy, 'businessHours' | 'timezone'>): string {
  const zone = zoneWords(policy.timezone);
  if (policy.businessHours.length === 0) return `Open at all hours, ${zone}`;
  const byDay = new Map<number, string[]>();
  for (const w of [...policy.businessHours].sort(
    (a, b) => a.day - b.day || a.startMinute - b.startMinute
  )) {
    const span = `${clockLabel(w.startMinute)}–${clockLabel(w.endMinute)}`;
    byDay.set(w.day, [...(byDay.get(w.day) ?? []), span]);
  }
  const runs: { from: number; to: number; hours: string }[] = [];
  for (const [day, spans] of byDay) {
    const hours = spans.join(' and ');
    const last = runs.at(-1);
    if (last?.to === day - 1 && last.hours === hours) last.to = day;
    else runs.push({ from: day, to: day, hours });
  }
  const said = runs.map(({ from, to, hours }) => {
    const days = from === to ? DAYS[from] : `${DAYS[from] ?? '?'}–${DAYS[to] ?? '?'}`;
    return `${days ?? '?'}, ${hours}`;
  });
  return `${said.join('; ')}, ${zone}`;
}
