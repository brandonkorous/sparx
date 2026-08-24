// One roster: what happens to the person when the bookable record moves.
//
// Issue 120. A salon set two stylists up under Bookings, saw them on every
// booking form, and was then told by the till that nobody was on her team. The
// pairing is what fixes that; these are the rules it has to follow.

import { describe, expect, it, vi } from 'vitest';

import { addToRoster, renameOnRoster } from './roster';
import type { TxClient } from '@wizeworks/db';

interface Person {
  id: string;
  firstName: string;
  lastName: string | null;
}

/** Enough of a client for the two functions under test: the roster row they
 *  look for, the sites they mirror, and a record of what they wrote. */
function fakeTx(opts: {
  person?: Person | null;
  scopedProperties?: string[];
  allProperties?: string[];
}) {
  const created: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const siteRows: Record<string, unknown>[] = [];

  const tx = {
    staffMember: {
      findFirst: vi.fn(() => Promise.resolve(opts.person ?? null)),
      create: vi.fn((args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return Promise.resolve({ id: 'person-new' });
      }),
      update: vi.fn((args: { data: Record<string, unknown> }) => {
        updated.push(args.data);
        return Promise.resolve({});
      }),
    },
    staffMemberSite: {
      createMany: vi.fn((args: { data: Record<string, unknown>[] }) => {
        siteRows.push(...args.data);
        return Promise.resolve({ count: args.data.length });
      }),
    },
    schedulingResourceProperty: {
      findMany: vi.fn(() =>
        Promise.resolve((opts.scopedProperties ?? []).map((propertyId) => ({ propertyId })))
      ),
    },
    property: {
      findMany: vi.fn(() => Promise.resolve((opts.allProperties ?? []).map((id) => ({ id })))),
    },
  };

  return { tx: tx as unknown as TxClient, created, updated, siteRows, spies: tx };
}

const RESOURCE = { id: 'res-1', kind: 'staff', name: 'Dara Bell', color: '#ff8800' };

describe('addToRoster', () => {
  it('puts a new staff resource on the team', async () => {
    const f = fakeTx({ person: null, allProperties: ['site-a'] });
    await addToRoster(f.tx, 'tenant-1', RESOURCE);

    expect(f.created).toHaveLength(1);
    expect(f.created[0]).toMatchObject({
      tenantId: 'tenant-1',
      firstName: 'Dara',
      lastName: 'Bell',
      resourceId: 'res-1',
      color: '#ff8800',
    });
  });

  it('leaves a room, a bay or a machine alone — a thing is not a person', async () => {
    for (const kind of ['asset', 'table', 'space', 'equipment']) {
      const f = fakeTx({ person: null, allProperties: ['site-a'] });
      await addToRoster(f.tx, 'tenant-1', { ...RESOURCE, kind });
      expect(f.created, kind).toHaveLength(0);
    }
  });

  it('does not add somebody twice', async () => {
    const f = fakeTx({ person: { id: 'person-1', firstName: 'Dara', lastName: 'Bell' } });
    await addToRoster(f.tx, 'tenant-1', RESOURCE);
    expect(f.created).toHaveLength(0);
  });

  it('does not invent a surname for a one-word name', async () => {
    const f = fakeTx({ person: null, allProperties: ['site-a'] });
    await addToRoster(f.tx, 'tenant-1', { ...RESOURCE, name: 'Cher' });
    expect(f.created[0]).toMatchObject({ firstName: 'Cher', lastName: null });
  });

  it('mirrors the resource’s own sites', async () => {
    const f = fakeTx({ person: null, scopedProperties: ['site-b', 'site-c'] });
    await addToRoster(f.tx, 'tenant-1', RESOURCE);

    expect(f.siteRows.map((row) => row.propertyId)).toEqual(['site-b', 'site-c']);
    // Somewhere their cost lands when a shift names no business of its own.
    expect(f.siteRows.filter((row) => row.isPrimary)).toHaveLength(1);
  });

  it('writes EVERY site out when the resource serves them all', async () => {
    // The two tables read an empty list in opposite directions: a resource with
    // no links works everywhere, a person with no links matches no site-scoped
    // roster at all. Copying "nothing" across would create a person the roster
    // still could not see — which is the invisibility this issue is about.
    const f = fakeTx({ person: null, scopedProperties: [], allProperties: ['site-a', 'site-b'] });
    await addToRoster(f.tx, 'tenant-1', RESOURCE);

    expect(f.siteRows.map((row) => row.propertyId)).toEqual(['site-a', 'site-b']);
    expect(f.siteRows[0]).toMatchObject({ isPrimary: true });
  });
});

describe('renameOnRoster', () => {
  it('renames the person when the two still agree', async () => {
    const f = fakeTx({ person: { id: 'person-1', firstName: 'Dara', lastName: 'Bell' } });
    await renameOnRoster(f.tx, 'res-1', 'Dara Bell', 'Dara Bellamy');
    expect(f.updated[0]).toMatchObject({ firstName: 'Dara', lastName: 'Bellamy' });
  });

  it('leaves a person alone once somebody has edited them separately', async () => {
    // She corrected the spelling under My Team. The two records have been pulled
    // apart on purpose, and a rename in Bookings must not quietly undo it.
    const f = fakeTx({ person: { id: 'person-1', firstName: 'Dara', lastName: 'Belle' } });
    await renameOnRoster(f.tx, 'res-1', 'Dara Bell', 'Dara Bellamy');
    expect(f.updated).toHaveLength(0);
  });

  it('does nothing when the name did not change', async () => {
    const f = fakeTx({ person: { id: 'person-1', firstName: 'Dara', lastName: 'Bell' } });
    await renameOnRoster(f.tx, 'res-1', 'Dara Bell', 'Dara Bell');
    expect(f.spies.staffMember.findFirst).not.toHaveBeenCalled();
  });

  it('does nothing when nobody is linked', async () => {
    const f = fakeTx({ person: null });
    await renameOnRoster(f.tx, 'res-1', 'Dara Bell', 'Dara Bellamy');
    expect(f.updated).toHaveLength(0);
  });
});
