// "USE THESE HOURS FOR…": ONE WEEK, COPIED ONTO OTHER PEOPLE OR THINGS.
//
// Weekly hours are set one person or thing at a time, which is right for a
// salon with three chairs and wrong for a shop with sixteen identical bays: the
// owner entered the same week once per bay (issue 086). The copy writes the
// SAVED week of one resource onto each one picked, through the same per-resource
// endpoint the editor saves with, so it replaces their week exactly the way
// pressing Save on each of them would.
//
// ONE WRITE PER RESOURCE, NOT A BULK ENDPOINT. Each write already replaces one
// resource's whole week in one transaction, and writing the same week twice
// gives the same result, so a write that fails can simply be tried again. What
// a bulk endpoint would add is all-or-nothing across the set, and the owner does
// not need that: they need to be told exactly who got the hours and who did
// not, and the ones that failed left ticked to try again. A shop with sixteen
// bays makes sixteen small writes, four at a time.
//
// Closures and special days are copied only when the owner asks. They are ADDED
// to each target, never swapped in for the target's own, and one the target
// already has is skipped, so trying again after a partial failure never adds a
// closure twice.
//
// The rules live here rather than in the pane so they can be tested: a `.tsx`
// cannot be imported by vitest in this app (`jsx: preserve`).

import type {
  AvailabilityException,
  AvailabilityWindow,
  AvailabilityWindowInput,
  ExceptionInput,
  ResourceKind,
} from './setup-data';

/** One person or thing the hours could be copied to. */
export interface CopyCandidate {
  id: string;
  name: string;
  kind: ResourceKind;
  /** False when it has no weekly hours yet (sparx persona issue 118). */
  hasWeeklyHours?: boolean;
}

/** The candidates of one kind, under the heading the picker shows. */
export interface CopyGroup {
  kind: ResourceKind;
  label: string;
  members: CopyCandidate[];
}

/** What happened for one target. */
export interface CopyResult {
  id: string;
  name: string;
  /** Whether their weekly hours were replaced. */
  hours: boolean;
  closuresAdded: number;
  closuresFailed: number;
  /** The most specific thing the server said about a write that failed. */
  error: string | null;
}

/** Each kind's heading, in the order the groups are shown. People come first:
 *  they are who an owner thinks of first, and who most often share a week. */
const GROUPS: readonly { kind: ResourceKind; label: string }[] = [
  { kind: 'staff', label: 'People' },
  { kind: 'space', label: 'Rooms and spaces' },
  { kind: 'table', label: 'Tables' },
  { kind: 'equipment', label: 'Machines and tools' },
  { kind: 'asset', label: 'Things you hire out' },
];

/** Names compared the way a person counts, so "Bay 2" sorts before "Bay 10". */
const BY_NAME = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Everyone the hours could go to, grouped by kind, without the one they come
 *  from. A kind with nobody in it is left out rather than shown empty. */
export function copyGroups(resources: readonly CopyCandidate[], sourceId: string): CopyGroup[] {
  const others = resources.filter((resource) => resource.id !== sourceId);
  const groups: CopyGroup[] = [];
  for (const group of GROUPS) {
    const members = others
      .filter((resource) => resource.kind === group.kind)
      .sort((a, b) => BY_NAME.compare(a.name, b.name));
    if (members.length > 0) groups.push({ ...group, members });
  }
  return groups;
}

/** The saved week, in the shape a write takes. The season dates go with each
 *  block, which is what carries "Hours change with the seasons" across: that
 *  switch is not stored on its own, it is whether any block has a date. */
export function windowsToCopy(windows: readonly AvailabilityWindow[]): AvailabilityWindowInput[] {
  return windows.map((window) => ({
    dayOfWeek: window.dayOfWeek,
    startMinute: window.startMinute,
    endMinute: window.endMinute,
    validFrom: window.validFrom,
    validTo: window.validTo,
  }));
}

/**
 * The closures and special days that belong to this resource alone and have not
 * ended yet. The business-wide ones already apply to everybody, so copying them
 * would only make a second copy; one that is over changes nothing.
 */
export function ownUpcomingClosures(
  exceptions: readonly AvailabilityException[],
  sourceId: string,
  now: Date
): AvailabilityException[] {
  return exceptions.filter(
    (exception) => exception.resourceId === sourceId && Date.parse(exception.endAt) > now.getTime()
  );
}

/** Two `meta` objects with the same entries, whatever order they were written in. */
function sameMeta(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = Object.keys(a).sort();
  const other = Object.keys(b).sort();
  if (keys.length !== other.length) return false;
  return keys.every(
    (key, index) => key === other[index] && JSON.stringify(a[key]) === JSON.stringify(b[key])
  );
}

function sameClosure(a: AvailabilityException, b: AvailabilityException): boolean {
  return (
    a.kind === b.kind &&
    Date.parse(a.startAt) === Date.parse(b.startAt) &&
    Date.parse(a.endAt) === Date.parse(b.endAt) &&
    sameMeta(a.meta, b.meta)
  );
}

/** The closures to add for one target: each one copied, except any the target
 *  already has (same kind, same days, same special hours). */
export function closuresFor(
  targetId: string,
  closures: readonly AvailabilityException[],
  existing: readonly AvailabilityException[]
): ExceptionInput[] {
  const theirs = existing.filter((exception) => exception.resourceId === targetId);
  return closures
    .filter((closure) => !theirs.some((exception) => sameClosure(exception, closure)))
    .map((closure) => ({
      resourceId: targetId,
      locationId: closure.locationId,
      kind: closure.kind,
      startAt: closure.startAt,
      endAt: closure.endAt,
      reason: closure.reason,
      meta: closure.meta,
    }));
}

/** Names as a sentence says them: "Kirk, Tomás and Bay 2". Past `max` names the
 *  rest are counted, so sixteen bays do not become a paragraph. */
export function nameList(names: readonly string[], max = 6): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0] ?? '';
  if (names.length > max) {
    const shown = names.slice(0, max);
    const rest = names.length - max;
    return `${shown.join(', ')} and ${String(rest)} ${rest === 1 ? 'other' : 'others'}`;
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;
}

/** "Bay 2" for one, "3 others" for more. */
function whoCount(names: readonly string[]): string {
  return names.length === 1 ? (names[0] ?? '') : `${String(names.length)} others`;
}

function closuresPhrase(count: number): string {
  return count === 1
    ? '1 upcoming closure or special day'
    : `${String(count)} upcoming closures and special days`;
}

/**
 * The confirm before the copy. It names how many, who, and that their current
 * weekly hours are replaced: that is the part that cannot be taken back, so it
 * is the part the owner has to have read.
 */
export function copyConfirmCopy({
  source,
  targets,
  closures,
  closedAllWeek,
  seasonal,
  targetsWithHours = targets.length,
}: {
  source: string;
  targets: readonly string[];
  /** How many closures will be added to each. Zero when that box is not ticked. */
  closures: number;
  /** The week being copied has no hours on any day. */
  closedAllWeek: boolean;
  /** The week being copied has season dates on it. */
  seasonal: boolean;
  /** How many of the targets already have weekly hours. With none, nothing is
   *  replaced, and the confirm must not say it is (sparx persona issue 118). */
  targetsWithHours?: number;
}): { title: string; description: string; confirmLabel: string; cancelLabel: string } {
  const sentences = [
    `${nameList(targets)} will get the same weekly hours as ${source}.`,
    targetsWithHours === 0
      ? targets.length === 1
        ? 'They have no weekly hours yet.'
        : 'None of them has weekly hours yet.'
      : targets.length === 1
        ? 'Their current weekly hours will be replaced, and the old ones cannot be brought back.'
        : 'Their current weekly hours will be replaced, for each of them, and the old ones cannot be brought back.',
  ];
  if (closedAllWeek) {
    sentences.push(
      `${source} is closed every day, so they will not be offered for booking on any day.`
    );
  }
  if (seasonal) {
    sentences.push(`The dates that limit ${source}’s hours to part of the year go with them.`);
  }
  sentences.push(
    closures > 0
      ? `${source}’s ${closuresPhrase(closures)} will be added to ${targets.length === 1 ? 'theirs' : 'each of theirs'}. Closures they already have stay as they are.`
      : 'Closures and special days are not copied.'
  );
  return {
    title: `Copy ${source}’s hours to ${whoCount(targets)}?`,
    description: sentences.join(' '),
    confirmLabel: `${targetsWithHours === 0 ? 'Copy hours to' : 'Replace hours for'} ${targets.length === 1 ? (targets[0] ?? '') : String(targets.length)}`,
    cancelLabel: 'Keep their hours',
  };
}

/** How many targets are written at once. Enough that sixteen bays take a few
 *  seconds, few enough not to crowd the server. */
const AT_ONCE = 4;

/**
 * Copy the week to every target, then add the closures to each one whose week
 * landed. A target whose week did not save gets no closures, so nobody ends up
 * with half of a copy they would not recognise. Every target is reported, the
 * failures with the server's own words.
 */
export async function runCopy({
  targets,
  closures,
  existing,
  writeHours,
  addClosure,
  errorText,
}: {
  targets: readonly { id: string; name: string }[];
  closures: readonly AvailabilityException[];
  existing: readonly AvailabilityException[];
  writeHours: (id: string) => Promise<unknown>;
  addClosure: (input: ExceptionInput) => Promise<unknown>;
  errorText: (error: unknown) => string;
}): Promise<CopyResult[]> {
  const copyOne = async (target: { id: string; name: string }): Promise<CopyResult> => {
    const result: CopyResult = {
      id: target.id,
      name: target.name,
      hours: false,
      closuresAdded: 0,
      closuresFailed: 0,
      error: null,
    };
    try {
      await writeHours(target.id);
      result.hours = true;
    } catch (error) {
      result.error = errorText(error);
      return result;
    }
    for (const input of closuresFor(target.id, closures, existing)) {
      try {
        await addClosure(input);
        result.closuresAdded += 1;
      } catch (error) {
        result.closuresFailed += 1;
        result.error ??= errorText(error);
      }
    }
    return result;
  };

  const results: CopyResult[] = [];
  for (let index = 0; index < targets.length; index += AT_ONCE) {
    const batch = targets.slice(index, index + AT_ONCE);
    results.push(...(await Promise.all(batch.map(copyOne))));
  }
  return results;
}

/**
 * What the owner is told afterward. The success names who got the hours and
 * only them; anything that did not land gets its own message, with the server's
 * words, so a failure is never folded into a cheerful toast.
 */
export function copyToasts(
  source: string,
  results: readonly CopyResult[]
): {
  success: { title: string; description: string } | null;
  failure: { title: string; description: string } | null;
} {
  const got = results.filter((result) => result.hours).map((result) => result.name);
  const missed = results.filter((result) => !result.hours);
  const partial = results.filter((result) => result.hours && result.closuresFailed > 0);

  const success =
    got.length > 0
      ? {
          title: `${source}’s hours copied to ${whoCount(got)}`,
          description: `${nameList(got)} now ${got.length === 1 ? 'has' : 'have'} the same weekly hours as ${source}.`,
        }
      : null;

  let failure: { title: string; description: string } | null = null;
  if (missed.length > 0) {
    const names = missed.map((result) => result.name);
    failure = {
      title: `Could not copy the hours to ${whoCount(names)}`,
      description: `${missed[0]?.error ?? 'Nothing was changed.'} Their hours are as they were. ${names.length === 1 ? 'They are' : 'They are all'} still ticked, so you can try again.`,
    };
  } else if (partial.length > 0) {
    const names = partial.map((result) => result.name);
    const missing = partial.reduce((sum, result) => sum + result.closuresFailed, 0);
    failure = {
      title: 'Some closures were not copied',
      description: `${nameList(names)} got the weekly hours, but ${String(missing)} ${missing === 1 ? 'closure' : 'closures'} could not be added: ${partial[0]?.error ?? 'Nothing was changed.'} Try again and only the missing ones are added.`,
    };
  }

  return { success, failure };
}
