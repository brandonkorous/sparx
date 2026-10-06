// "Use these hours for…": one week copied onto other people or things. Issue 086.
//
// A diesel shop with two technicians and two bays (and sixteen bays in the real
// shop) entered the same week once per bay. These pin the rules that decide
// what a copy writes, who it writes to, and what the owner is told before and
// after, because each of them fails silently: a closure copied that was not
// asked for, a closure added twice on a retry, a toast naming someone whose
// hours did not change.

import { describe, expect, it } from 'vitest';

import {
  closuresFor,
  copyConfirmCopy,
  copyGroups,
  copyToasts,
  nameList,
  ownUpcomingClosures,
  runCopy,
  windowsToCopy,
  type CopyResult,
} from './hours-copy';
import type { AvailabilityException, AvailabilityWindow, ExceptionInput } from './setup-data';

const BAY_1 = 'bay-1';
const BAY_2 = 'bay-2';
const KIRK = 'kirk';
const TOMAS = 'tomas';

const NOW = new Date('2026-10-02T15:00:00Z');

function closure(partial: Partial<AvailabilityException>): AvailabilityException {
  return {
    id: 'ex-1',
    resourceId: BAY_1,
    locationId: null,
    kind: 'closed',
    startAt: '2026-12-24T06:00:00.000Z',
    endAt: '2026-12-25T05:59:59.999Z',
    reason: 'Christmas Eve',
    meta: {},
    ...partial,
  };
}

describe('copyGroups', () => {
  const resources = [
    { id: BAY_1, name: 'Bay 1 (light duty)', kind: 'equipment' as const },
    { id: 'bay-10', name: 'Bay 10', kind: 'equipment' as const },
    { id: BAY_2, name: 'Bay 2 (light duty)', kind: 'equipment' as const },
    { id: TOMAS, name: 'Tomás Begay', kind: 'staff' as const },
    { id: KIRK, name: 'Kirk Halvorsen', kind: 'staff' as const },
    { id: 'lobby', name: 'Front lobby', kind: 'space' as const },
  ];

  it('groups by kind, people first, and leaves out the one being copied from', () => {
    const groups = copyGroups(resources, BAY_1);
    expect(groups.map((group) => group.label)).toEqual([
      'People',
      'Rooms and spaces',
      'Machines and tools',
    ]);
    expect(groups.flatMap((group) => group.members.map((member) => member.id))).not.toContain(
      BAY_1
    );
  });

  it('sorts names the way a person counts, so Bay 2 comes before Bay 10', () => {
    const machines = copyGroups(resources, BAY_1).find((group) => group.kind === 'equipment');
    expect(machines?.members.map((member) => member.name)).toEqual([
      'Bay 2 (light duty)',
      'Bay 10',
    ]);
    const people = copyGroups(resources, BAY_1).find((group) => group.kind === 'staff');
    expect(people?.members.map((member) => member.name)).toEqual(['Kirk Halvorsen', 'Tomás Begay']);
  });

  it('drops a group that would be empty', () => {
    const groups = copyGroups(resources.slice(0, 3), BAY_1);
    expect(groups.map((group) => group.label)).toEqual(['Machines and tools']);
  });
});

describe('windowsToCopy', () => {
  it('copies every block with its season dates and nothing that names the source', () => {
    const windows: AvailabilityWindow[] = [
      {
        id: 'w1',
        resourceId: BAY_1,
        dayOfWeek: 1,
        startMinute: 450,
        endMinute: 1050,
        validFrom: null,
        validTo: null,
      },
      {
        id: 'w2',
        resourceId: BAY_1,
        dayOfWeek: 6,
        startMinute: 480,
        endMinute: 720,
        validFrom: '2026-05-01',
        validTo: '2026-09-30',
      },
    ];
    expect(windowsToCopy(windows)).toEqual([
      { dayOfWeek: 1, startMinute: 450, endMinute: 1050, validFrom: null, validTo: null },
      {
        dayOfWeek: 6,
        startMinute: 480,
        endMinute: 720,
        validFrom: '2026-05-01',
        validTo: '2026-09-30',
      },
    ]);
  });
});

describe('ownUpcomingClosures', () => {
  it('keeps only this resource’s own closures that have not ended yet', () => {
    const exceptions = [
      closure({ id: 'mine' }),
      closure({ id: 'everyone', resourceId: null }),
      closure({ id: 'someone-else', resourceId: KIRK }),
      closure({
        id: 'over',
        startAt: '2026-07-04T05:00:00.000Z',
        endAt: '2026-07-05T04:59:59.999Z',
      }),
    ];
    expect(ownUpcomingClosures(exceptions, BAY_1, NOW).map((exception) => exception.id)).toEqual([
      'mine',
    ]);
  });
});

describe('closuresFor', () => {
  it('writes each closure onto the target, special hours and all', () => {
    const special = closure({
      id: 'eve',
      kind: 'custom_hours',
      meta: { startMinute: 480, endMinute: 720 },
    });
    expect(closuresFor(KIRK, [special], [])).toEqual<ExceptionInput[]>([
      {
        resourceId: KIRK,
        locationId: null,
        kind: 'custom_hours',
        startAt: special.startAt,
        endAt: special.endAt,
        reason: 'Christmas Eve',
        meta: { startMinute: 480, endMinute: 720 },
      },
    ]);
  });

  it('skips one the target already has, so trying again never adds it twice', () => {
    const mine = closure({ id: 'mine' });
    const theirs = closure({ id: 'theirs', resourceId: KIRK, reason: 'Already off' });
    expect(closuresFor(KIRK, [mine], [mine, theirs])).toEqual([]);
  });

  it('still adds it when the target has a different closure on the same days', () => {
    const mine = closure({
      id: 'mine',
      kind: 'custom_hours',
      meta: { startMinute: 480, endMinute: 720 },
    });
    const theirs = closure({ id: 'theirs', resourceId: KIRK, kind: 'closed' });
    expect(closuresFor(KIRK, [mine], [theirs])).toHaveLength(1);
  });
});

describe('nameList', () => {
  it('reads like a sentence', () => {
    expect(nameList(['Kirk'])).toBe('Kirk');
    expect(nameList(['Kirk', 'Tomás'])).toBe('Kirk and Tomás');
    expect(nameList(['Kirk', 'Tomás', 'Bay 2'])).toBe('Kirk, Tomás and Bay 2');
  });

  it('stops naming after a handful and counts the rest', () => {
    const bays = Array.from({ length: 15 }, (_, index) => `Bay ${String(index + 2)}`);
    expect(nameList(bays, 3)).toBe('Bay 2, Bay 3, Bay 4 and 12 others');
  });
});

describe('copyConfirmCopy', () => {
  it('names how many, who, and that their weekly hours will be replaced', () => {
    const copy = copyConfirmCopy({
      source: 'Bay 1',
      targets: ['Kirk Halvorsen', 'Tomás Begay', 'Bay 2'],
      closures: 0,
      closedAllWeek: false,
      seasonal: false,
    });
    expect(copy.title).toBe('Copy Bay 1’s hours to 3 others?');
    expect(copy.description).toContain('Kirk Halvorsen, Tomás Begay and Bay 2');
    expect(copy.description).toContain('Their current weekly hours will be replaced');
    expect(copy.description).toContain('Closures and special days are not copied');
    expect(copy.confirmLabel).toBe('Replace hours for 3');
  });

  it('uses the name when there is only one', () => {
    const copy = copyConfirmCopy({
      source: 'Bay 1',
      targets: ['Bay 2'],
      closures: 0,
      closedAllWeek: false,
      seasonal: false,
    });
    expect(copy.title).toBe('Copy Bay 1’s hours to Bay 2?');
    expect(copy.description).toContain('Their current weekly hours will be replaced');
  });

  it('says closures are added, not swapped, when they are ticked', () => {
    const copy = copyConfirmCopy({
      source: 'Bay 1',
      targets: ['Bay 2'],
      closures: 2,
      closedAllWeek: false,
      seasonal: false,
    });
    expect(copy.description).toContain('2 upcoming closures and special days');
    expect(copy.description).not.toContain('are not copied');
  });

  it('warns when the week being copied is closed every day', () => {
    const copy = copyConfirmCopy({
      source: 'Bay 1',
      targets: ['Bay 2'],
      closures: 0,
      closedAllWeek: true,
      seasonal: false,
    });
    expect(copy.description).toContain('closed every day');
  });
});

describe('runCopy', () => {
  const targets = [
    { id: KIRK, name: 'Kirk Halvorsen' },
    { id: BAY_2, name: 'Bay 2 (light duty)' },
  ];

  it('writes the week to every target, then adds the closures to each', async () => {
    const hours: string[] = [];
    const added: ExceptionInput[] = [];
    const results = await runCopy({
      targets,
      closures: [closure({ id: 'mine' })],
      existing: [],
      writeHours: (id) => {
        hours.push(id);
        return Promise.resolve();
      },
      addClosure: (input) => {
        added.push(input);
        return Promise.resolve();
      },
      errorText: () => 'nope',
    });
    expect(hours.sort()).toEqual([BAY_2, KIRK]);
    expect(added.map((input) => input.resourceId).sort()).toEqual([BAY_2, KIRK]);
    expect(results.every((result) => result.hours && result.error === null)).toBe(true);
  });

  it('adds no closures for a target whose hours did not save', async () => {
    const added: ExceptionInput[] = [];
    const results = await runCopy({
      targets,
      closures: [closure({ id: 'mine' })],
      existing: [],
      writeHours: (id) => (id === BAY_2 ? Promise.reject(new Error('down')) : Promise.resolve()),
      addClosure: (input) => {
        added.push(input);
        return Promise.resolve();
      },
      errorText: (error) => (error instanceof Error ? error.message : 'unknown'),
    });
    expect(added.map((input) => input.resourceId)).toEqual([KIRK]);
    const bay = results.find((result) => result.id === BAY_2);
    expect(bay).toMatchObject({ hours: false, closuresAdded: 0, error: 'down' });
  });
});

describe('copyToasts', () => {
  const ok = (id: string, name: string): CopyResult => ({
    id,
    name,
    hours: true,
    closuresAdded: 0,
    closuresFailed: 0,
    error: null,
  });

  it('names who got the hours', () => {
    const toasts = copyToasts('Bay 1', [ok(KIRK, 'Kirk Halvorsen'), ok(BAY_2, 'Bay 2')]);
    expect(toasts.success?.title).toBe('Bay 1’s hours copied to 2 others');
    expect(toasts.success?.description).toBe(
      'Kirk Halvorsen and Bay 2 now have the same weekly hours as Bay 1.'
    );
    expect(toasts.failure).toBeNull();
  });

  it('never names someone whose hours did not change as having got them', () => {
    const failed: CopyResult = {
      id: BAY_2,
      name: 'Bay 2',
      hours: false,
      closuresAdded: 0,
      closuresFailed: 0,
      error: 'The server is not answering.',
    };
    const toasts = copyToasts('Bay 1', [ok(KIRK, 'Kirk Halvorsen'), failed]);
    expect(toasts.success?.description).not.toContain('Bay 2');
    expect(toasts.failure?.title).toBe('Could not copy the hours to Bay 2');
    expect(toasts.failure?.description).toContain('The server is not answering.');
    expect(toasts.failure?.description).toContain('Their hours are as they were');
  });

  it('says plainly when the hours landed but a closure did not', () => {
    const partial: CopyResult = {
      ...ok(KIRK, 'Kirk Halvorsen'),
      closuresAdded: 1,
      closuresFailed: 1,
      error: 'Busy.',
    };
    const toasts = copyToasts('Bay 1', [partial]);
    expect(toasts.success?.description).toContain('Kirk Halvorsen');
    expect(toasts.failure?.title).toBe('Some closures were not copied');
    expect(toasts.failure?.description).toContain(
      'Kirk Halvorsen got the weekly hours, but 1 closure'
    );
  });
});
