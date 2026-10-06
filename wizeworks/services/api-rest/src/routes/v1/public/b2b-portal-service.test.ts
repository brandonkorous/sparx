// Booking service for a fleet vehicle from the B2B portal (sparx persona issue 086).
//
// What these pin down:
//   · a contact sees and books ONLY her own account's vehicles and history: the
//     contact role is checked on the account in the URL, the vehicle is looked up
//     in that account's fleet, and the history is read by that account's id;
//   · the booking is written through `createBooking` for the signed-in contact,
//     which is what lays down her confirmation and reminder emails, with the
//     account and the vehicle on it; the owner is told and the event published;
//   · with scheduling off, the portal is told so and nothing else.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

const ACCOUNT_A = '0a0a0a0a-0000-4000-8000-00000000000a';
const ACCOUNT_B = '0b0b0b0b-0000-4000-8000-00000000000b';
const SERVICE = '5e5e5e5e-0000-4000-8000-000000000005';
const START = '2026-10-05T15:00:00.000Z';

const state = vi.hoisted(() => ({
  customerId: 'cust-renee',
  /** contact rows: `${customerId}:${accountId}` → role */
  contacts: new Map<string, string>(),
  schedulingOn: true,
  bookingWhere: [] as unknown[],
  createBooking: vi.fn(),
  publish: vi.fn(),
  ownerNotify: vi.fn(),
  fleets: new Map<string, { id: string; label: string }[]>(),
}));

vi.mock('@wizeworks/auth', () => ({
  isModuleEnabled: (_t: string, slug: string) =>
    Promise.resolve(slug === 'scheduling' ? state.schedulingOn : true),
}));

vi.mock('@wizeworks/db', () => {
  const tx = {
    b2bAccountContact: {
      findFirst: ({ where }: { where: { customerId: string; accountId: string } }) => {
        const role = state.contacts.get(`${where.customerId}:${where.accountId}`);
        return Promise.resolve(role ? { role } : null);
      },
    },
    booking: {
      findMany: ({ where }: { where: unknown }) => {
        state.bookingWhere.push(where);
        return Promise.resolve([]);
      },
    },
    order: { findMany: () => Promise.resolve([]) },
  };
  return { withTenant: (_ctx: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
});

function vehicle(id: string, label: string) {
  return {
    id,
    label,
    year: 2019,
    make: null,
    model: null,
    vin: null,
    notes: null,
    mileage: null,
    count: 1,
    domainId: null,
    nodeId: null,
    nodePath: ['Ram', '3500'],
  };
}

vi.mock('@wizeworks/b2b', () => ({
  getAccountFleet: (_ctx: unknown, accountId: string) =>
    Promise.resolve((state.fleets.get(accountId) ?? []).map((v) => vehicle(v.id, v.label))),
  findFleetVehicle: (_ctx: unknown, accountId: string, vehicleId: string) => {
    const hit = (state.fleets.get(accountId) ?? []).find((v) => v.id === vehicleId);
    return Promise.resolve(hit ? vehicle(hit.id, hit.label) : null);
  },
}));

vi.mock('@wizeworks/scheduling', () => ({
  listServices: () =>
    Promise.resolve([
      {
        id: SERVICE,
        name: 'Oil and filter change',
        description: null,
        bookingType: 'appointment',
        bookableOnline: true,
        durationMinutes: 90,
        priceCents: 14900,
        currency: 'usd',
        requiresApproval: false,
        requiresAsset: true,
        minLeadMinutes: 0,
        maxAdvanceDays: 60,
      },
      { id: 'class-1', name: 'Shop safety class', bookingType: 'class', bookableOnline: true },
    ]),
  findServicePlaces: () => Promise.resolve(new Map()),
  getService: () =>
    Promise.resolve({
      id: SERVICE,
      name: 'Oil and filter change',
      bookingType: 'appointment',
      bookableOnline: true,
      isActive: true,
    }),
  getAvailability: () => Promise.resolve([{ startAtUtc: Date.parse(START) }]),
  createBooking: state.createBooking,
  findBookingPlace: () => Promise.resolve(null),
  customerFacingPlace: () => null,
}));

vi.mock('../../../lib/public-commerce-context.js', () => ({
  resolveTenantId: () => Promise.resolve('tenant-1'),
}));
vi.mock('../../../lib/property.js', () => ({
  resolvePublicPropertyId: () => Promise.resolve('site-1'),
}));
vi.mock('../../../lib/customer-session.js', () => ({
  requireCustomerId: () => Promise.resolve(state.customerId),
}));
vi.mock('../../../lib/scheduling-events.js', () => ({ publishBookingEvent: state.publish }));
vi.mock('../../../lib/scheduling-owner-notify.js', () => ({
  sendOwnerBookingNotification: state.ownerNotify,
}));
vi.mock('../../../lib/scheduling-payments.js', () => ({
  createBookingDeposit: () => Promise.resolve({ required: false }),
}));
vi.mock('../../../lib/scheduling-ical.js', () => ({ bookingCalendarLinks: () => null }));
vi.mock('../../../lib/scheduling-token.js', () => ({ bookingManagePath: () => '/booking/x' }));

import routes from './b2b-portal-service.js';

async function app() {
  const server = Fastify();
  await server.register(routes);
  return server;
}

beforeEach(() => {
  state.customerId = 'cust-renee';
  state.contacts = new Map([
    ['cust-renee:' + ACCOUNT_A, 'buyer'],
    ['cust-viewer:' + ACCOUNT_A, 'viewer'],
  ]);
  state.schedulingOn = true;
  state.bookingWhere = [];
  state.fleets = new Map([
    [ACCOUNT_A, [{ id: 'veh-a1', label: 'Unit 12' }]],
    [ACCOUNT_B, [{ id: 'veh-b1', label: 'Truck 7' }]],
  ]);
  state.createBooking.mockReset();
  state.createBooking.mockResolvedValue({
    booking: {
      id: 'bk-1',
      status: 'confirmed',
      locationId: null,
      startAt: new Date(START),
      endAt: new Date('2026-10-05T16:30:00.000Z'),
      timezone: 'America/Chicago',
    },
    resourceIds: [],
  });
  state.publish.mockReset();
  state.ownerNotify.mockReset();
});

const book = (accountId: string, vehicleId: string) => ({
  method: 'POST' as const,
  url: `/v1/public/b2b/portal/${accountId}/service/bookings?tenant=shop`,
  payload: { vehicleId, serviceId: SERVICE, startAt: START, notes: 'Pulls to the left' },
});

describe('booking service for a fleet vehicle', () => {
  it('books for the contact, on the account, with the vehicle on it', async () => {
    const server = await app();
    const res = await server.inject(book(ACCOUNT_A, 'veh-a1'));
    expect(res.statusCode).toBe(201);
    expect(state.createBooking).toHaveBeenCalledTimes(1);
    const [, input] = state.createBooking.mock.calls[0] as [string, Record<string, unknown>];
    // The contact is the customer: the engine schedules her confirmation and
    // reminders for this customer, in the booking's own transaction.
    expect(input).toMatchObject({
      serviceId: SERVICE,
      startAt: START,
      customerId: 'cust-renee',
      companyId: ACCOUNT_A,
      source: 'portal',
      notes: 'Pulls to the left',
      assetRef: { vehicleId: 'veh-a1', label: 'Unit 12, 2019 Ram 3500' },
    });
    expect(state.ownerNotify).toHaveBeenCalledWith(expect.anything(), 'tenant-1', 'bk-1');
    expect(state.publish).toHaveBeenCalledWith(
      'booking.created',
      'tenant-1',
      null,
      expect.objectContaining({ bookingId: 'bk-1', companyId: ACCOUNT_A, source: 'portal' })
    );
    expect(res.json().data).toMatchObject({ vehicle: 'Unit 12, 2019 Ram 3500' });
    await server.close();
  });

  it("refuses another account's vehicle, even from a contact of this account", async () => {
    const server = await app();
    const res = await server.inject(book(ACCOUNT_A, 'veh-b1'));
    expect(res.statusCode).toBe(404);
    expect(state.createBooking).not.toHaveBeenCalled();
    await server.close();
  });

  it('refuses an account the contact is not on', async () => {
    const server = await app();
    const res = await server.inject(book(ACCOUNT_B, 'veh-b1'));
    expect(res.statusCode).toBe(403);
    expect(state.createBooking).not.toHaveBeenCalled();
    await server.close();
  });

  it('lets a viewer read but not book', async () => {
    state.customerId = 'cust-viewer';
    const server = await app();
    const res = await server.inject(book(ACCOUNT_A, 'veh-a1'));
    expect(res.statusCode).toBe(403);
    expect(state.createBooking).not.toHaveBeenCalled();
    const read = await server.inject({
      method: 'GET',
      url: `/v1/public/b2b/portal/${ACCOUNT_A}/service?tenant=shop`,
    });
    expect(read.statusCode).toBe(200);
    expect(read.json().data.canBook).toBe(false);
    await server.close();
  });
});

describe('the service page', () => {
  it("lists only this account's vehicles and reads only this account's history", async () => {
    const server = await app();
    const res = await server.inject({
      method: 'GET',
      url: `/v1/public/b2b/portal/${ACCOUNT_A}/service?tenant=shop`,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.enabled).toBe(true);
    expect(data.canBook).toBe(true);
    expect(data.vehicles).toEqual([{ id: 'veh-a1', label: 'Unit 12, 2019 Ram 3500', vin: null }]);
    expect(state.bookingWhere).toEqual([{ companyId: ACCOUNT_A, deletedAt: null }]);
    // Only services you book a time for: the class is not a vehicle service.
    expect(data.services.map((s: { id: string }) => s.id)).toEqual([SERVICE]);
    await server.close();
  });

  it("refuses another account's history", async () => {
    const server = await app();
    const res = await server.inject({
      method: 'GET',
      url: `/v1/public/b2b/portal/${ACCOUNT_B}/service?tenant=shop`,
    });
    expect(res.statusCode).toBe(403);
    expect(state.bookingWhere).toEqual([]);
    await server.close();
  });

  it('says scheduling is off and sends nothing else, and refuses a booking', async () => {
    state.schedulingOn = false;
    const server = await app();
    const res = await server.inject({
      method: 'GET',
      url: `/v1/public/b2b/portal/${ACCOUNT_A}/service?tenant=shop`,
    });
    expect(res.json().data).toEqual({ enabled: false });
    const post = await server.inject(book(ACCOUNT_A, 'veh-a1'));
    expect(post.statusCode).toBe(404);
    expect(state.createBooking).not.toHaveBeenCalled();
    await server.close();
  });
});
