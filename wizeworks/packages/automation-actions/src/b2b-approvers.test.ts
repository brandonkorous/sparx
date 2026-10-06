import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EffectInput, TenantCtx } from '@wizeworks/automation';

// Sparx persona issue 087. A trade account's contact with the role "Can approve
// orders" was never asked anything: an order held over a spending limit the
// account signs off went to nobody at the account. `b2b.ask_account_approvers`
// emails each of them. These tests drive the real sign-off rule
// (`accountOrderGate.loadOrderSignOff`) over a fake transaction, so "who is
// asked" is decided exactly as the Approve buttons decide it.

const enqueueSend = vi.fn();
vi.mock('@wizeworks/email-sends', () => ({
  enqueueSend: (...args: unknown[]) => enqueueSend(...args) as unknown,
}));

const { askAccountApprovers } = await import('./b2b.js');

const TENANT = 'tenant-ridgeline';
const ACCOUNT = 'acct-harbor';
const ORDER = 'ord-214';
const SITE = 'site-ridgeline';

interface Contact {
  customerId: string;
  role: string;
  isActive: boolean;
  firstName: string;
  lastName: string;
  email: string | null;
}

const CONTACTS: Contact[] = [
  // Placed the order. An approver too, and still never asked to sign their own.
  {
    customerId: 'c-joel',
    role: 'approver',
    isActive: true,
    firstName: 'Joel',
    lastName: 'Brandt',
    email: 'joel@harbor.test',
  },
  {
    customerId: 'c-imani',
    role: 'approver',
    isActive: true,
    firstName: 'Imani',
    lastName: 'Okafor',
    email: 'imani@harbor.test',
  },
  {
    customerId: 'c-ruth',
    role: 'approver',
    isActive: true,
    firstName: 'Ruth',
    lastName: 'Szabo',
    email: 'ruth@harbor.test',
  },
  // Can view only. Not asked.
  {
    customerId: 'c-pat',
    role: 'viewer',
    isActive: true,
    firstName: 'Pat',
    lastName: 'Lindqvist',
    email: 'pat@harbor.test',
  },
];

function heldOrder(metadata: Record<string, unknown> = {}) {
  return {
    id: ORDER,
    orderNumber: 'O-000214',
    status: 'pending_approval',
    customerId: 'c-joel',
    propertyId: SITE,
    currency: 'USD',
    metadata: {
      poNumber: 'HSC-PO-1187',
      approvalHold: { reasons: [{ kind: 'approval_rule', ruleId: 'rule-1' }] },
      ...metadata,
    },
    total: '1340.00',
    subtotal: '1340.00',
    discountTotal: '0',
    taxTotal: '0',
    shippingTotal: '0',
    surchargeTotal: '0',
    coreChargeTotal: '0',
    customer: {
      companyId: ACCOUNT,
      firstName: 'Joel',
      lastName: 'Brandt',
      email: 'joel@harbor.test',
    },
    items: [
      {
        name: 'House espresso, 5 lb bag',
        quantity: 20,
        unitPrice: '58.00',
        lineTotal: '1160.00',
        uomCode: null,
        unitsPerUom: 1,
      },
      {
        name: 'Decaf Colombia, 5 lb bag',
        quantity: 3,
        unitPrice: '60.00',
        lineTotal: '180.00',
        uomCode: null,
        unitsPerUom: 1,
      },
    ],
  };
}

function rule(signOffBy: 'account' | 'business') {
  return {
    id: 'rule-1',
    accountId: ACCOUNT,
    propertyId: null,
    minAmountCents: 100_000,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    signOffBy,
    requiredApproverUserId: null,
    requiredApprover: null,
  };
}

function ctxFor(opts: {
  order: ReturnType<typeof heldOrder> | null;
  signOffBy?: 'account' | 'business';
  contacts?: Contact[];
}): TenantCtx {
  const contacts = opts.contacts ?? CONTACTS;
  const tx = {
    order: { findUnique: () => Promise.resolve(opts.order) },
    purchaseApprovalRule: {
      findMany: () => Promise.resolve([rule(opts.signOffBy ?? 'account')]),
    },
    // Honors the query the gate sends, so excluding whoever placed the order is
    // the gate's doing, not the fake's.
    b2bAccountContact: {
      findMany: ({
        where,
      }: {
        where: { accountId: string; isActive: boolean; role: string; customerId?: { not: string } };
      }) =>
        Promise.resolve(
          contacts
            .filter(
              (c) =>
                c.isActive === where.isActive &&
                c.role === where.role &&
                c.customerId !== where.customerId?.not
            )
            .map((c) => ({
              customerId: c.customerId,
              customer: { firstName: c.firstName, lastName: c.lastName, email: c.email },
            }))
        ),
    },
    company: { findUnique: () => Promise.resolve({ companyName: 'Harbor Street Cafés, LLC' }) },
    property: {
      findUnique: () =>
        Promise.resolve({
          id: SITE,
          name: 'Ridgeline Coffee Roasters',
          slug: 'main',
          isPrimary: true,
        }),
      findFirst: () => Promise.resolve(null),
    },
    tenant: {
      findUnique: () => Promise.resolve({ name: 'Ridgeline', slug: 'ridgeline', settings: {} }),
    },
    domain: { findFirst: () => Promise.resolve(null) },
  };
  return { tenantId: TENANT, tx, deps: {} } as unknown as TenantCtx;
}

const effect = { config: {}, fields: { 'order.id': ORDER } } as unknown as EffectInput;

/** What each queued send was, in the order they were queued. */
function sends() {
  return enqueueSend.mock.calls.map((call) => call[1] as Record<string, unknown>);
}

const priorBase = process.env.SPARX_SITE_BASE;
beforeAll(() => {
  // The explicit site override, so the address is built without a domain table.
  process.env.SPARX_SITE_BASE = 'https://{slug}.shop.test';
});
afterAll(() => {
  if (priorBase === undefined) delete process.env.SPARX_SITE_BASE;
  else process.env.SPARX_SITE_BASE = priorBase;
});
beforeEach(() => {
  enqueueSend.mockReset();
  enqueueSend.mockResolvedValue({ enqueued: true, suppressed: false });
});

describe('asking the account’s approvers', () => {
  it('emails every approver at the account except whoever placed the order', async () => {
    const out = await askAccountApprovers(ctxFor({ order: heldOrder() }), effect);

    expect(sends().map((s) => s.recipient)).toEqual(['imani@harbor.test', 'ruth@harbor.test']);
    expect(out).toMatchObject({ asked: ['Imani Okafor', 'Ruth Szabo'] });
  });

  it('sends the order, the limit and one link to it on the business site', async () => {
    await askAccountApprovers(ctxFor({ order: heldOrder() }), effect);
    const first = sends()[0]!;
    expect(first.scope).toBe('transactional');
    expect(first.propertyId).toBe(SITE);
    expect(first.customerId).toBe('c-imani');
    const body = first.body as { template: string; props: Record<string, unknown> };
    expect(body.template).toBe('order-approval-request');
    expect(body.props).toMatchObject({
      fromName: 'Ridgeline Coffee Roasters',
      approverName: 'Imani Okafor',
      accountName: 'Harbor Street Cafés, LLC',
      placedBy: 'Joel Brandt',
      orderNumber: 'O-000214',
      total: 1340,
      limit: 1000,
      poNumber: 'HSC-PO-1187',
      businessToo: false,
      orderUrl: `https://ridgeline.shop.test/account/b2b/${ACCOUNT}/orders/${ORDER}`,
    });
    expect(body.props.lines).toEqual([
      { title: 'House espresso, 5 lb bag', subtitle: '20 × $58.00', amount: '$1,160.00' },
      { title: 'Decaf Colombia, 5 lb bag', subtitle: '3 × $60.00', amount: '$180.00' },
    ]);
  });

  it('asks nobody when the limit is one the business signs off', async () => {
    const out = await askAccountApprovers(
      ctxFor({ order: heldOrder(), signOffBy: 'business' }),
      effect
    );
    expect(enqueueSend).not.toHaveBeenCalled();
    expect(out).toMatchObject({ asked: [] });
  });

  it('asks nobody once the account has already signed', async () => {
    const signed = heldOrder({
      approvalHold: {
        reasons: [{ kind: 'approval_rule', ruleId: 'rule-1' }],
        signed: { account: { name: 'Imani Okafor', at: '2026-10-03T15:00:00.000Z' } },
      },
    });
    await askAccountApprovers(ctxFor({ order: signed }), effect);
    expect(enqueueSend).not.toHaveBeenCalled();
  });

  it('asks nobody about an order that is no longer held', async () => {
    const placed = { ...heldOrder(), status: 'placed' };
    await askAccountApprovers(ctxFor({ order: placed }), effect);
    expect(enqueueSend).not.toHaveBeenCalled();
  });

  it('asks each approver once per order, however often the run is retried', async () => {
    await askAccountApprovers(ctxFor({ order: heldOrder() }), effect);
    const first = sends().map((s) => s.dedupeKey);
    enqueueSend.mockClear();
    await askAccountApprovers(ctxFor({ order: heldOrder() }), effect);
    const again = sends().map((s) => s.dedupeKey);

    // One key per approver, and the same keys on the retry: the send queue is
    // unique on the key, so the retry queues nothing new.
    expect(new Set(first).size).toBe(2);
    expect(again).toEqual(first);
    expect(first[0]).toBe(`b2b.ask_account_approvers:${ORDER}:c-imani`);
  });

  it('fails, naming them, when no approver has an email address', async () => {
    const noEmail = CONTACTS.map((c) => (c.customerId === 'c-joel' ? c : { ...c, email: null }));
    await expect(
      askAccountApprovers(ctxFor({ order: heldOrder(), contacts: noEmail }), effect)
    ).rejects.toThrow(/Imani Okafor, Ruth Szabo/);
    expect(enqueueSend).not.toHaveBeenCalled();
  });
});
