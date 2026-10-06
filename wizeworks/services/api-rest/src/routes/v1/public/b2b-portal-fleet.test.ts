// The portal's fleet page is one account's and nobody else's (sparx persona
// issue 086).
//
//   1. A contact on one account cannot read another account's fleet by putting
//      that account's id in the URL. The id in the path is checked against the
//      contact's own active roles before anything is read.
//   2. Every contact on the account may read it; only the primary contact may
//      change it, and only from a signed-in session, never a connected app.

import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const MINE = '8aa59a36-acc9-455f-b0ba-41c0b66292b9';
const THEIRS = '9bb59a36-acc9-455f-b0ba-41c0b66292b9';
const VEHICLE = '11111111-1111-4111-8111-111111111111';

const state = vi.hoisted(() => ({
  role: 'buyer',
  scopes: null as ReadonlySet<string> | null,
}));

const fleetService = vi.hoisted(() => ({
  getAccountFleet: vi.fn(),
  addFleetVehicle: vi.fn(),
  updateFleetVehicle: vi.fn(),
  removeFleetVehicle: vi.fn(),
}));

vi.mock('@wizeworks/b2b', () => ({ fleetService }));
vi.mock('../../../lib/public-commerce-context.js', () => ({
  resolveTenantId: () => Promise.resolve('tenant-1'),
}));
vi.mock('../../../lib/customer-session.js', () => ({
  requireCustomer: () =>
    Promise.resolve({ customerId: 'customer-1', userId: 'u1', scopes: state.scopes }),
}));
vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      b2bAccountContact: {
        // The customer is an active contact on MINE only.
        findFirst: ({ where }: { where: { accountId: string; customerId: string } }) =>
          Promise.resolve(
            where.accountId === MINE && where.customerId === 'customer-1'
              ? { role: state.role }
              : null
          ),
      },
    }),
}));

import fleetRoutes from './b2b-portal-fleet.js';

const unit12 = {
  id: VEHICLE,
  label: 'Unit 12',
  year: 2019,
  make: null,
  model: null,
  nodePath: ['Ram', '3500', '6.7L Cummins'],
};

async function app() {
  const a = Fastify();
  await a.register(fleetRoutes);
  return a;
}

beforeEach(() => {
  state.role = 'buyer';
  state.scopes = null;
  for (const fn of Object.values(fleetService)) fn.mockReset();
  fleetService.getAccountFleet.mockResolvedValue([unit12]);
  fleetService.addFleetVehicle.mockResolvedValue({ vehicle: unit12 });
});

describe('reading the fleet', () => {
  it('shows a contact their own account’s vehicles, worded', async () => {
    const a = await app();
    const res = await a.inject({ url: `/v1/public/b2b/portal/${MINE}/fleet?tenant=t` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({
      vehicles: [{ ...unit12, displayName: 'Unit 12, 2019 Ram 3500 6.7L Cummins' }],
      canEdit: false,
    });
    await a.close();
  });

  it('refuses another account’s fleet and reads nothing of it', async () => {
    const a = await app();
    const res = await a.inject({ url: `/v1/public/b2b/portal/${THEIRS}/fleet?tenant=t` });
    expect(res.statusCode).toBe(403);
    expect(fleetService.getAccountFleet).not.toHaveBeenCalled();
    await a.close();
  });

  it('refuses a change to another account’s fleet, even from its own primary contact role elsewhere', async () => {
    state.role = 'primary_contact';
    const a = await app();
    const res = await a.inject({
      method: 'POST',
      url: `/v1/public/b2b/portal/${THEIRS}/fleet/vehicles?tenant=t`,
      payload: { label: 'Unit 99' },
    });
    expect(res.statusCode).toBe(403);
    expect(fleetService.addFleetVehicle).not.toHaveBeenCalled();
    await a.close();
  });
});

describe('changing the fleet', () => {
  it('lets the primary contact add a vehicle', async () => {
    state.role = 'primary_contact';
    const a = await app();
    const read = await a.inject({ url: `/v1/public/b2b/portal/${MINE}/fleet?tenant=t` });
    expect(read.json().data.canEdit).toBe(true);
    const res = await a.inject({
      method: 'POST',
      url: `/v1/public/b2b/portal/${MINE}/fleet/vehicles?tenant=t`,
      payload: { label: 'Unit 12' },
    });
    expect(res.statusCode).toBe(201);
    expect(fleetService.addFleetVehicle).toHaveBeenCalledWith({ tenantId: 'tenant-1' }, MINE, {
      label: 'Unit 12',
    });
    await a.close();
  });

  it.each(['buyer', 'approver', 'viewer'])('refuses a change from a %s', async (role) => {
    state.role = role;
    const a = await app();
    const res = await a.inject({
      method: 'DELETE',
      url: `/v1/public/b2b/portal/${MINE}/fleet/vehicles/${VEHICLE}?tenant=t`,
    });
    expect(res.statusCode).toBe(403);
    expect(fleetService.removeFleetVehicle).not.toHaveBeenCalled();
    await a.close();
  });

  it('refuses a change from a connected app, even the primary contact’s', async () => {
    state.role = 'primary_contact';
    state.scopes = new Set(['b2b:read']);
    const a = await app();
    const res = await a.inject({
      method: 'PUT',
      url: `/v1/public/b2b/portal/${MINE}/fleet/vehicles/${VEHICLE}?tenant=t`,
      payload: { label: 'Unit 12' },
    });
    expect(res.statusCode).toBe(403);
    expect(fleetService.updateFleetVehicle).not.toHaveBeenCalled();
    await a.close();
  });
});
