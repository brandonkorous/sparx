// The pointer and the membership have to agree. Issue 744.
//
// Two halves, tested two ways. The BEHAVIOUR of the invariant is exercised
// against a fake transaction that records what it was asked to write. The
// REASON the invariant is needed is a fact about a file in another package —
// that pricing reads the active membership row and refuses to trust the pointer
// — so that half is asserted by reading the source. Delete that refusal and
// this module is dead weight; delete this module and the refusal starts
// charging people retail. Neither is safe to change without seeing the other.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { membershipDeactivated, membershipRestored, pointerMoved } from './trade-membership';

/* ── The fake transaction ────────────────────────────────────────────────── */

interface Row {
  id: string;
  tenantId: string;
  customerId: string;
  accountId: string;
  role: string;
  isActive: boolean;
}

/** Only the four calls `trade-membership` makes, each recording what it did. */
interface PointerWrite {
  /** The guard half of the where clause, which is what keeps each direction
   *  from stealing somebody who is filed under a different business. */
  onlyWhenCompanyIdIs: string | null;
  id: string;
  companyId: string | null;
}

function fakeTx(rows: Row[]) {
  const pointerWrites: PointerWrite[] = [];
  let minted = 0;
  const tx = {
    b2bAccountContact: {
      findFirst: ({ where }: { where: Partial<Row> }) =>
        Promise.resolve(
          rows.find(
            (r) =>
              r.tenantId === where.tenantId &&
              r.customerId === where.customerId &&
              r.accountId === where.accountId
          ) ?? null
        ),
      updateMany: ({ where, data }: { where: Partial<Row>; data: Partial<Row> }) => {
        for (const r of rows) {
          if (
            r.tenantId === where.tenantId &&
            r.customerId === where.customerId &&
            r.accountId === where.accountId &&
            r.isActive === where.isActive
          ) {
            Object.assign(r, data);
          }
        }
        return Promise.resolve({ count: 0 });
      },
      update: ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const found = rows.find((r) => r.id === where.id);
        if (found) Object.assign(found, data);
        return Promise.resolve(found);
      },
      create: ({ data }: { data: Omit<Row, 'id' | 'isActive'> }) => {
        minted += 1;
        const made: Row = { id: `new_${minted}`, isActive: true, ...data };
        rows.push(made);
        return Promise.resolve(made);
      },
    },
    customer: {
      updateMany: ({
        where,
        data,
      }: {
        where: { id: string; companyId: string | null };
        data: { companyId: string | null };
      }) => {
        pointerWrites.push({
          onlyWhenCompanyIdIs: where.companyId,
          id: where.id,
          companyId: data.companyId,
        });
        return Promise.resolve({ count: 1 });
      },
    },
  };
  // The real TxClient is the whole Prisma surface; this stands in for the four
  // calls this module makes, which is the whole of what there is to test.
  return { tx: tx as unknown as Parameters<typeof pointerMoved>[0], pointerWrites };
}

const T = 'tenant-1';
const C = 'customer-1';

function row(over: Partial<Row> = {}): Row {
  return {
    id: 'r1',
    tenantId: T,
    customerId: C,
    accountId: 'account-A',
    role: 'approver',
    isActive: true,
    ...over,
  };
}

/* ── Setting the pointer joins them ──────────────────────────────────────── */

describe('pointerMoved', () => {
  it('files a customer under a business they have never bought from', async () => {
    const rows: Row[] = [];
    const { tx } = fakeTx(rows);
    await pointerMoved(tx, T, C, null, 'account-A');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ accountId: 'account-A', isActive: true, role: 'buyer' });
  });

  it('does nothing at all when the business has not changed', async () => {
    const rows: Row[] = [row({ isActive: false })];
    const { tx } = fakeTx(rows);
    await pointerMoved(tx, T, C, 'account-A', 'account-A');

    // Untouched, including the switched-off row: a save that changes a phone
    // number must not quietly re-admit somebody who was taken off.
    expect(rows[0]!.isActive).toBe(false);
    expect(rows).toHaveLength(1);
  });

  it('keeps the role somebody had when they come back to a business', async () => {
    const rows: Row[] = [row({ isActive: false, role: 'approver' })];
    const { tx } = fakeTx(rows);
    await pointerMoved(tx, T, C, null, 'account-A');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ isActive: true, role: 'approver' });
  });

  it('takes them off the old business when they move to a new one', async () => {
    const rows: Row[] = [row({ accountId: 'account-A', isActive: true })];
    const { tx } = fakeTx(rows);
    await pointerMoved(tx, T, C, 'account-A', 'account-B');

    expect(rows.find((r) => r.accountId === 'account-A')!.isActive).toBe(false);
    expect(rows.find((r) => r.accountId === 'account-B')).toMatchObject({ isActive: true });
  });

  it('takes them off when the business is cleared, and adds nothing', async () => {
    const rows: Row[] = [row({ isActive: true })];
    const { tx } = fakeTx(rows);
    await pointerMoved(tx, T, C, 'account-A', null);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.isActive).toBe(false);
  });

  it('leaves a membership on another business alone', async () => {
    const rows: Row[] = [row({ id: 'r2', accountId: 'account-Z', isActive: true })];
    const { tx } = fakeTx(rows);
    await pointerMoved(tx, T, C, null, 'account-A');

    expect(rows.find((r) => r.accountId === 'account-Z')!.isActive).toBe(true);
  });
});

/* ── Switching the membership off clears the pointer ─────────────────────── */

describe('membershipDeactivated', () => {
  it('clears the pointer, and only when it aimed at this business', async () => {
    const { tx, pointerWrites } = fakeTx([]);
    await membershipDeactivated(tx, C, 'account-A');

    // The `companyId: accountId` half of the where clause is what keeps this
    // safe on a second account — asserted here because a fake cannot enforce it.
    expect(pointerWrites).toEqual([{ onlyWhenCompanyIdIs: 'account-A', id: C, companyId: null }]);
  });
});

describe('membershipRestored', () => {
  it('points them back, and only when they are filed under nobody', async () => {
    const { tx, pointerWrites } = fakeTx([]);
    await membershipRestored(tx, C, 'account-A');

    // `companyId: null` is the guard. Without it, restoring somebody as a viewer
    // on a second account would move the business that prices them.
    expect(pointerWrites).toEqual([{ onlyWhenCompanyIdIs: null, id: C, companyId: 'account-A' }]);
  });
});

/* ── Why any of this is needed ───────────────────────────────────────────── */

function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i += 1) {
    try {
      readFileSync(join(dir, 'pnpm-workspace.yaml'));
      return dir;
    } catch {
      dir = dirname(dir);
    }
  }
  throw new Error('pnpm-workspace.yaml not found above this test');
}

describe('the reason the invariant exists', () => {
  it('pricing still refuses to trust the pointer on its own', () => {
    const pricing = readFileSync(
      join(repoRoot(), 'wizeworks/packages/commerce/src/services/pricing-service.ts'),
      'utf8'
    );
    const at = pricing.indexOf('export async function resolveActiveB2bAccountId');
    expect(at).toBeGreaterThan(-1);
    const body = pricing.slice(at, pricing.indexOf('\n}\n', at));

    // An ACTIVE membership row is the whole question it asks. If this stops
    // being true, the pointer alone would price somebody and `trade-membership`
    // would be keeping a row nothing reads.
    expect(body).toContain('b2bAccountContact.findFirst');
    expect(body).toContain('isActive: true');
  });

  it('the customer editor still calls the invariant on both paths', () => {
    const customerService = readFileSync(
      join(repoRoot(), 'wizeworks/packages/crm/src/services/customer-service.ts'),
      'utf8'
    );
    // Once in create, once in update. Two is the count, and a drop to one is
    // exactly the half-fixed shape this issue was.
    expect(customerService.split('await pointerMoved(').length - 1).toBe(2);
  });

  it('the account editor still handles BOTH directions of a membership', () => {
    // Remove was wired and Restore was not, so a restored buyer came back as an
    // active member filed under nobody, priced at retail — the same
    // disagreement, reintroduced by testing only the direction being fixed.
    const contactService = readFileSync(
      join(repoRoot(), 'wizeworks/packages/crm/src/services/b2b-account-contact-service.ts'),
      'utf8'
    );
    expect(contactService).toContain('await membershipDeactivated(');
    expect(contactService).toContain('await membershipRestored(');
  });
});
