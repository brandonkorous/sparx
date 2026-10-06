// Staff set and change the vehicle on a booking for a trade account (sparx persona
// issue 086). Two things had to be true of the edit for that to work:
//
//   · the trade account itself can be written, so a booking a contact made on the
//     public site can be put on the account whose vehicle it was for;
//   · taking the vehicle OFF actually takes it off. `assetRef: null` used to be
//     turned into `undefined` on the way to Prisma, which means "leave it alone",
//     so the old vehicle stayed on the booking while the request reported success.

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeDb {
  DB_NULL: symbol;
  updates: Record<string, unknown>[];
  events: unknown[];
  existing: Record<string, unknown>;
}

const state = vi.hoisted((): FakeDb => ({
  DB_NULL: Symbol('DbNull'),
  updates: [],
  events: [],
  existing: {},
}));
const { DB_NULL, updates, events } = state;

vi.mock('@wizeworks/db', () => ({
  Prisma: { DbNull: state.DB_NULL },
  withTenant: (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      booking: {
        findFirst: () => Promise.resolve(state.existing),
        update: ({ data }: { data: Record<string, unknown> }) => {
          state.updates.push(data);
          return Promise.resolve({ ...state.existing, ...data });
        },
      },
    }),
}));

vi.mock('./booking-history', () => ({
  recordBookingEvent: (...args: unknown[]) => {
    state.events.push(args);
    return Promise.resolve();
  },
}));

import { updateBooking } from './booking-service';

const BOOKING = '5a1d9c3e-7b2f-4e6a-8c0d-1f3b5d7e9a11';
const COMPANY = '3c9a7e21-5b4d-4e8f-a6c2-1d0b9f8e7a44';

beforeEach(() => {
  updates.length = 0;
  events.length = 0;
  state.existing = {
    id: BOOKING,
    companyId: null,
    assetRef: { vehicleId: 'v-1', label: 'Unit 12' },
    partsLinked: [],
    notes: null,
    staffNotes: null,
    workOrderId: null,
    locationId: null,
  };
});

describe('setting the vehicle on a booking', () => {
  it('writes the trade account the booking is for', async () => {
    await updateBooking('t1', { id: BOOKING, companyId: COMPANY });
    expect(updates[0]).toMatchObject({ companyId: COMPANY });
  });

  it('records the account change in the booking history', async () => {
    await updateBooking('t1', { id: BOOKING, companyId: COMPANY });
    expect(events[0]).toEqual([
      't1',
      BOOKING,
      'booking.updated',
      undefined,
      { changes: { companyId: { from: null, to: COMPANY } } },
    ]);
  });

  it('really clears the vehicle when it is taken off', async () => {
    await updateBooking('t1', { id: BOOKING, assetRef: null });
    expect(updates[0]).toHaveProperty('assetRef', DB_NULL);
  });

  it('leaves the vehicle alone when the edit does not mention it', async () => {
    await updateBooking('t1', { id: BOOKING, notes: 'Bring the keys' });
    expect(updates[0]).not.toHaveProperty('assetRef');
  });
});
