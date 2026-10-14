// The counting-schedule form's values: its shape, its defaults, and the
// pure readings the detail surface takes from them.

import type { AbcClass, CountCadence, CountSchedule } from './planning-data';
import { suggestedScheduleName } from './count-schedule-name';

export interface Draft {
  warehouseId: string;
  name: string;
  abcClass: '' | AbcClass;
  zoneName: string;
  cadence: CountCadence;
  intervalDays: number;
  maxItemsPerRun: number;
  isBlind: boolean;
  isActive: boolean;
}

// The defaults ARE the advice: the setup the trade converges on. Blind because a
// scheduled count exists to MEASURE accuracy, and showing the expected figure
// measures agreement instead. A hand-made count still defaults the other way.
export const NEW_DRAFT: Draft = {
  warehouseId: '',
  name: suggestedScheduleName({
    abcClass: 'A',
    zoneName: '',
    cadence: 'monthly',
    intervalDays: 30,
  }),
  abcClass: 'A',
  zoneName: '',
  cadence: 'monthly',
  intervalDays: 30,
  maxItemsPerRun: 50,
  isBlind: true,
  isActive: true,
};

export const CADENCES: { value: CountCadence; label: string }[] = [
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'quarterly', label: 'Every quarter' },
  { value: 'annually', label: 'Once a year' },
  { value: 'custom', label: 'Every so many days…' },
];

/** Is the next run already owed? A schedule is due the moment it is created, so
 *  this is the normal state on first save, not an edge case. */
export function isDue(nextRunAt: string | null): boolean {
  if (!nextRunAt) return false;
  const at = new Date(nextRunAt).getTime();
  return Number.isFinite(at) && at <= Date.now();
}

/** The form's values for a schedule the server already holds. */
export function draftFromServer(server: CountSchedule): Draft {
  return {
    warehouseId: server.warehouseId,
    name: server.name,
    abcClass: server.abcClass ?? '',
    zoneName: server.zoneName ?? '',
    cadence: server.cadence,
    intervalDays: server.intervalDays,
    maxItemsPerRun: server.maxItemsPerRun,
    isBlind: server.isBlind,
    isActive: server.isActive,
  };
}

/** The body a save sends. Location is set once, at creation. */
export function toSavePayload(draft: Draft, isNew: boolean) {
  return {
    ...(isNew ? { warehouseId: draft.warehouseId } : {}),
    name: draft.name.trim(),
    abcClass: draft.abcClass === '' ? null : draft.abcClass,
    zoneName: draft.zoneName.trim() === '' ? null : draft.zoneName.trim(),
    cadence: draft.cadence,
    ...(draft.cadence === 'custom' ? { intervalDays: draft.intervalDays } : {}),
    maxItemsPerRun: draft.maxItemsPerRun,
    isBlind: draft.isBlind,
    ...(isNew ? {} : { isActive: draft.isActive }),
  };
}

// WHY nothing is covered, in the words of the controls that caused it, so a
// zone holding nothing does not send her to widen the group too (issue 506).
export function coverageWords(draft: Draft) {
  const zoneNarrows = draft.zoneName.trim() !== '';
  const classNarrows = draft.abcClass !== '';
  const narrowedBy = [
    zoneNarrows ? 'the zone you named' : null,
    classNarrows ? 'the group you picked' : null,
  ].filter((s): s is string => s !== null);
  const widenBy = [
    zoneNarrows ? 'clear the zone box' : null,
    classNarrows ? 'choose “Everything at this location”' : null,
  ].filter((s): s is string => s !== null);
  // Whichever remedy comes first starts the sentence, so it is capitalized
  // here rather than baked into the list.
  const widen = widenBy.join(', or ');
  const widenSentence = widen.charAt(0).toUpperCase() + widen.slice(1);
  return { narrowedBy, widenSentence };
}
