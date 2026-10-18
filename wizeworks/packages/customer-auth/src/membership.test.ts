import { beforeEach, describe, expect, it, vi } from 'vitest';

// `withTenant` opens a tenant-scoped transaction; the rule under test is about
// WHICH existing row a sign-in claims, which is a decision about people's records
// and should not need a database to assert.
vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) => fn(tx),
}));

interface Row {
  id: string;
  email: string;
  propertyId: string | null;
  authUserId: string | null;
  firstName: string | null;
  lastName: string | null;
  deletedAt: null;
}

let rows: Row[] = [];
let created: Record<string, unknown> | null = null;
let audited: Record<string, unknown>[] = [];

const matches = (r: Row, where: Record<string, unknown>): boolean =>
  Object.entries(where).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v);

const tx = {
  customer: {
    findFirst: ({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(rows.find((r) => matches(r, where)) ?? null),
    update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = rows.find((r) => r.id === where.id);
      if (row) Object.assign(row, data);
      return Promise.resolve(row);
    },
    create: ({ data }: { data: Record<string, unknown> }) => {
      created = data;
      return Promise.resolve({ id: 'new-row' });
    },
  },
  auditLog: {
    create: ({ data }: { data: Record<string, unknown> }) => {
      audited.push(data);
      return Promise.resolve({});
    },
  },
};

const { ensureMembership } = await import('./membership');

const CTX = { tenantId: 't1' };
const SITE = 'site-a';
const USER = 'auth-1';
const EMAIL = 'imani@example.com';

function guest(overrides: Partial<Row> = {}): Row {
  return {
    id: 'guest-row',
    email: EMAIL,
    propertyId: SITE,
    authUserId: null,
    firstName: 'Imani',
    lastName: 'Reyes',
    deletedAt: null,
    ...overrides,
  };
}

describe('ensureMembership', () => {
  beforeEach(() => {
    rows = [];
    created = null;
    audited = [];
  });

  it('returns the membership already linked on this site', async () => {
    rows = [guest({ id: 'mine', authUserId: USER })];
    const result = await ensureMembership(CTX, SITE, USER, EMAIL, {}, true);
    expect(result).toEqual({ customerId: 'mine', created: false, adopted: false });
    expect(created).toBeNull();
  });

  it('adopts a guest row on this site rather than making a second one', async () => {
    rows = [guest()];
    const result = await ensureMembership(CTX, SITE, USER, EMAIL, {}, true);
    expect(result).toEqual({ customerId: 'guest-row', created: false, adopted: true });
    expect(rows[0]?.authUserId).toBe(USER);
    expect(created).toBeNull();
  });

  // The one that was missing. A booking made through the website wrote a customer
  // with NO site on it, which reads exactly like a correct value — so signing up
  // with the same address produced a SECOND person: one holding her appointments,
  // one holding her login (issue 152).
  it('adopts a guest row that belongs to no site, and writes the site onto it', async () => {
    rows = [guest({ propertyId: null })];
    const result = await ensureMembership(CTX, SITE, USER, EMAIL, {}, true);
    expect(result).toEqual({ customerId: 'guest-row', created: false, adopted: true });
    expect(rows[0]?.authUserId).toBe(USER);
    expect(rows[0]?.propertyId).toBe(SITE);
    expect(created).toBeNull();
  });

  // docs/58 D6: two sites are two businesses. A sister site's customer is never
  // claimed, so a first sign-in there gets a fresh membership and fresh consent.
  it('never takes a row belonging to a DIFFERENT site', async () => {
    rows = [guest({ propertyId: 'site-b' })];
    const result = await ensureMembership(CTX, SITE, USER, EMAIL, {}, true);
    expect(result).toEqual({ customerId: 'new-row', created: true, adopted: false });
    expect(created).toMatchObject({ propertyId: SITE, authUserId: USER, email: EMAIL });
  });

  it('creates a fresh membership when nothing matches', async () => {
    const result = await ensureMembership(
      CTX,
      SITE,
      USER,
      EMAIL,
      {
        firstName: 'Imani',
        lastName: 'Reyes',
      },
      true
    );
    expect(result).toEqual({ customerId: 'new-row', created: true, adopted: false });
    expect(created).toMatchObject({ firstName: 'Imani', lastName: 'Reyes' });
  });

  // A sign-up left no trace the business could see. The activity bar names every
  // new person who arrives through the site, and a buyer who made an account was
  // the one kind it never showed (sparx persona issue 086).
  it('writes down that somebody new arrived through the site', async () => {
    await ensureMembership(CTX, SITE, USER, EMAIL, { firstName: 'Imani' }, true);
    expect(audited).toEqual([
      expect.objectContaining({
        tenantId: 't1',
        action: 'crm.customer.captured',
        entityType: 'Customer',
        entityId: 'new-row',
        actorType: 'customer',
      }),
    ]);
  });

  it('writes nothing down for somebody it already knew', async () => {
    rows = [guest()];
    await ensureMembership(CTX, SITE, USER, EMAIL, {}, true);
    expect(audited).toEqual([]);
  });

  it('fills in a name the guest row was missing, and leaves one it has', async () => {
    rows = [guest({ firstName: null, lastName: 'Reyes' })];
    await ensureMembership(
      CTX,
      SITE,
      USER,
      EMAIL,
      { firstName: 'Imani', lastName: 'Okafor' },
      true
    );
    expect(rows[0]?.firstName).toBe('Imani');
    expect(rows[0]?.lastName).toBe('Reyes');
  });
});

// Sparx persona issue 329. A stranger typed a guest buyer's email and a password
// on the sign-up form, and her order and home address opened in his account.
describe('ensureMembership, before the email is confirmed', () => {
  beforeEach(() => {
    rows = [];
    created = null;
    audited = [];
  });

  it('does not hand a guest record to a login that has not confirmed the email', async () => {
    rows = [guest()];
    const result = await ensureMembership(CTX, SITE, USER, EMAIL, {}, false);
    expect(result).toEqual({
      customerId: null,
      created: false,
      adopted: false,
      awaitingConfirmation: true,
    });
    expect(rows[0]?.authUserId).toBeNull();
    expect(created).toBeNull();
  });

  it('does not hand over a record that belongs to no site either', async () => {
    rows = [guest({ propertyId: null })];
    const result = await ensureMembership(CTX, SITE, USER, EMAIL, {}, false);
    expect(result.awaitingConfirmation).toBe(true);
    expect(rows[0]?.authUserId).toBeNull();
  });

  it('makes a fresh membership at once when nobody left a record under the email', async () => {
    const result = await ensureMembership(CTX, SITE, USER, EMAIL, {}, false);
    expect(result).toEqual({ customerId: 'new-row', created: true, adopted: false });
  });

  it('keeps an account already linked, confirmed or not', async () => {
    rows = [guest({ id: 'mine', authUserId: USER })];
    const result = await ensureMembership(CTX, SITE, USER, EMAIL, {}, false);
    expect(result.customerId).toBe('mine');
  });

  it('hands the record over once the email is confirmed', async () => {
    rows = [guest()];
    const result = await ensureMembership(CTX, SITE, USER, EMAIL, {}, true);
    expect(result).toEqual({ customerId: 'guest-row', created: false, adopted: true });
    expect(rows[0]?.authUserId).toBe(USER);
  });
});
