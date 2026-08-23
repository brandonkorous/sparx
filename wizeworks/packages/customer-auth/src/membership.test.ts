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
  });

  it('returns the membership already linked on this site', async () => {
    rows = [guest({ id: 'mine', authUserId: USER })];
    const result = await ensureMembership(CTX, SITE, USER, EMAIL, {});
    expect(result).toEqual({ customerId: 'mine', created: false });
    expect(created).toBeNull();
  });

  it('adopts a guest row on this site rather than making a second one', async () => {
    rows = [guest()];
    const result = await ensureMembership(CTX, SITE, USER, EMAIL, {});
    expect(result).toEqual({ customerId: 'guest-row', created: false });
    expect(rows[0]?.authUserId).toBe(USER);
    expect(created).toBeNull();
  });

  // The one that was missing. A booking made through the website wrote a customer
  // with NO site on it, which reads exactly like a correct value — so signing up
  // with the same address produced a SECOND person: one holding her appointments,
  // one holding her login (issue 152).
  it('adopts a guest row that belongs to no site, and writes the site onto it', async () => {
    rows = [guest({ propertyId: null })];
    const result = await ensureMembership(CTX, SITE, USER, EMAIL, {});
    expect(result).toEqual({ customerId: 'guest-row', created: false });
    expect(rows[0]?.authUserId).toBe(USER);
    expect(rows[0]?.propertyId).toBe(SITE);
    expect(created).toBeNull();
  });

  // docs/58 D6: two sites are two businesses. A sister site's customer is never
  // claimed, so a first sign-in there gets a fresh membership and fresh consent.
  it('never takes a row belonging to a DIFFERENT site', async () => {
    rows = [guest({ propertyId: 'site-b' })];
    const result = await ensureMembership(CTX, SITE, USER, EMAIL, {});
    expect(result).toEqual({ customerId: 'new-row', created: true });
    expect(created).toMatchObject({ propertyId: SITE, authUserId: USER, email: EMAIL });
  });

  it('creates a fresh membership when nothing matches', async () => {
    const result = await ensureMembership(CTX, SITE, USER, EMAIL, {
      firstName: 'Imani',
      lastName: 'Reyes',
    });
    expect(result).toEqual({ customerId: 'new-row', created: true });
    expect(created).toMatchObject({ firstName: 'Imani', lastName: 'Reyes' });
  });

  it('fills in a name the guest row was missing, and leaves one it has', async () => {
    rows = [guest({ firstName: null, lastName: 'Reyes' })];
    await ensureMembership(CTX, SITE, USER, EMAIL, { firstName: 'Imani', lastName: 'Okafor' });
    expect(rows[0]?.firstName).toBe('Imani');
    expect(rows[0]?.lastName).toBe('Reyes');
  });
});
