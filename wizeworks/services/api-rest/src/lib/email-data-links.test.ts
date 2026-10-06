// What a customer's order email links to, and what it says about how the order
// reaches them (sparx persona issue 064).
//
// Read off the dev broker for two counter sales at Gillett Diesel: every link was a
// bare path (`/account/orders`, `/`, `(/privacy-policy)`), the receipt said "Shipping
// to [object Object]" and promised tracking, and the hand-over email said the order
// "has been delivered". These drive the real resolver over a faked database so the
// data the templates bind is pinned at its source.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SilicaEmailDocument } from '@wizeworks/builder-schemas';

interface OrderRow {
  propertyId: string | null;
  shippingAddress: unknown;
  metadata: unknown;
  fulfillments: { carrier: string | null }[];
  /** Absent: handed over (the till's case). `null`: still to collect. */
  deliveredAt?: Date | null;
}

const state = vi.hoisted(() => ({
  order: null as OrderRow | null,
  business: null as null | {
    businessName: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    region: string;
    postalCode: string;
  },
  canonical: new Map<string, string>(),
  originLookups: 0,
}));

const PRIMARY = { id: 'site-primary', slug: 'primary', isPrimary: true, name: 'Gillett Diesel' };
const COUNTER = { id: 'site-counter', slug: 'counter', isPrimary: false, name: 'Gillett Counter' };
const SITES = new Map([
  [PRIMARY.id, PRIMARY],
  [COUNTER.id, COUNTER],
]);

vi.mock('@wizeworks/db', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const orderFull = () =>
    state.order && {
      orderNumber: 'O-000002',
      status: 'delivered',
      total: 120,
      subtotal: 120,
      shippingTotal: 0,
      taxTotal: 0,
      discountTotal: 0,
      refundTotal: 0,
      coreChargeTotal: 0,
      amountPaid: 120,
      readyOn: null,
      placedAt: new Date('2026-10-01T15:00:00Z'),
      deliveredAt:
        state.order.deliveredAt === undefined
          ? new Date('2026-10-01T16:00:00Z')
          : state.order.deliveredAt,
      cancelledReason: null,
      shippingAddress: state.order.shippingAddress,
      metadata: state.order.metadata,
      fulfillments: state.order.fulfillments,
      items: [
        {
          name: 'Rebuilt injector',
          description: null,
          quantity: 1,
          unitPrice: 120,
          lineTotal: 120,
          coreCharge: null,
          coreFirst: false,
          product: { handle: 'rebuilt-injector' },
        },
      ],
    };
  // The site-origin resolution is the one tenant read that asks for `settings`
  // (the legacy primary domain), so counting those counts origin lookups.
  const tenant = {
    findUnique: ({ select }: { select?: { settings?: boolean } }) => {
      if (select?.settings) state.originLookups += 1;
      return Promise.resolve({
        slug: 'gillettdiesel',
        name: 'Gillett Diesel LLC',
        email: 'o@g.test',
        settings: {},
      });
    },
  };
  const domain = {
    findFirst: ({ where }: { where: { propertyId: string } }) => {
      const host = state.canonical.get(where.propertyId);
      return Promise.resolve(host ? { host } : null);
    },
    findMany: () => Promise.resolve([]),
  };
  const tx = {
    tenant,
    domain,
    order: {
      findFirst: () => Promise.resolve(orderFull()),
      findUnique: () => Promise.resolve(state.order && { propertyId: state.order.propertyId }),
    },
    property: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(SITES.get(where.id) ?? null),
      findFirst: () => Promise.resolve(PRIMARY),
    },
    tenantBusiness: { findUnique: () => Promise.resolve(state.business) },
    emailSettings: { findUnique: () => Promise.resolve(null) },
    siteDocPlacement: {
      findMany: () =>
        Promise.resolve([
          {
            label: null,
            entry: { slug: 'privacy-policy', status: 'published', deletedAt: null },
          },
        ]),
    },
  };
  return {
    ...actual,
    prisma: { tenant, domain },
    withTenant: (_ctx: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
});

import {
  orderHandover,
  resolveEmailFooterLinks,
  resolveEmailSiteOrigin,
  resolveSilicaEmailData,
  shippingAddressValue,
} from './email-data.js';

const ctx = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' };
const ref = { email: 'brynn@example.test', orderId: 'order-2' };
/** A document that references the order and the site, through its copy. */
const EMPTY_DOC = { root: { children: [] } } as unknown as SilicaEmailDocument;
const TOKENS = ['{{order.statusUrl}} {{order.reviewUrl}} {{site.url}}'];

const COUNTER_SALE: OrderRow = {
  propertyId: COUNTER.id,
  // What the till stores: the JSON value null, not an empty column.
  shippingAddress: null,
  metadata: {
    shippingRateRef: 'collection:in-person',
    shippingDescription: 'Taken at the counter',
  },
  fulfillments: [{ carrier: 'pickup' }],
};

const POSTED: OrderRow = {
  propertyId: COUNTER.id,
  shippingAddress: {
    recipientName: 'Brynn O’Hara-Løvdal',
    line1: '12 Harbour Rd',
    city: 'Portland',
    region: 'OR',
    postalCode: '97201',
  },
  metadata: { shippingProviderSlug: 'sparx-manual', shippingRateRef: 'manual:abc' },
  fulfillments: [{ carrier: 'ups' }],
};

beforeEach(() => {
  delete process.env.SPARX_SITE_BASE;
  state.order = { ...COUNTER_SALE };
  state.business = {
    businessName: 'Gillett Diesel Service',
    addressLine1: '410 Mill St',
    addressLine2: null,
    city: 'Lowell',
    region: 'MA',
    postalCode: '01852',
  };
  state.canonical = new Map([[COUNTER.id, 'counter.gillettdiesel.com']]);
  state.originLookups = 0;
});

describe('every link in a customer email is absolute, on the site the email is about', () => {
  it("links an order email into the site the order was placed on, not the tenant's primary", async () => {
    const data = await resolveSilicaEmailData(ctx, EMPTY_DOC, ref, TOKENS, PRIMARY.id);
    const order = data.order as Record<string, string>;
    const site = data.site as Record<string, string>;
    expect(order.statusUrl).toBe('https://counter.gillettdiesel.com/account/orders');
    expect(order.reviewUrl).toBe('https://counter.gillettdiesel.com/products/rebuilt-injector');
    expect(site.url).toBe('https://counter.gillettdiesel.com/');
  });

  it('mints the address when the site has no domain of its own, never a bare path', async () => {
    state.canonical = new Map();
    const data = await resolveSilicaEmailData(ctx, EMPTY_DOC, ref, TOKENS);
    const order = data.order as Record<string, string>;
    expect(order.statusUrl).toBe('https://counter.gillettdiesel.sparx.zone/account/orders');
    for (const url of [order.statusUrl, order.reviewUrl, (data.site as { url: string }).url]) {
      expect(url).toMatch(/^https:\/\//);
    }
  });

  it('resolves the site once per email, however many sources link into it', async () => {
    await resolveSilicaEmailData(ctx, EMPTY_DOC, ref, TOKENS);
    expect(state.originLookups).toBe(1);
  });

  it("puts the footer's account and policy links on the same site as the body", async () => {
    const origin = await resolveEmailSiteOrigin(ctx, ref, PRIMARY.id);
    const footer = await resolveEmailFooterLinks(ctx, PRIMARY.id, origin);
    expect(footer.map((l) => l.href)).toEqual([
      'https://counter.gillettdiesel.com/account',
      'https://counter.gillettdiesel.com/privacy-policy',
    ]);
  });

  it('keeps SPARX_SITE_BASE as an explicit override', async () => {
    process.env.SPARX_SITE_BASE = 'http://localhost:3002';
    const data = await resolveSilicaEmailData(ctx, EMPTY_DOC, ref, TOKENS);
    expect((data.order as Record<string, string>).statusUrl).toBe(
      'http://localhost:3002/account/orders'
    );
  });
});

describe('an order says how it reaches the customer', () => {
  const ORDER_TOKENS = [
    '{{order.shippingAddress.oneLine}} {{order.pickup}} {{order.delivery}} {{order.pickupFrom}}',
  ];

  it('marks a counter sale handed over on the spot as picked up already', async () => {
    const data = await resolveSilicaEmailData(ctx, EMPTY_DOC, ref, ORDER_TOKENS);
    const order = data.order as Record<string, unknown>;
    expect(order.pickup).toBe('yes');
    expect(order.delivery).toBe('');
    expect(order.shippingAddress).toBe('');
    expect(order.pickedUp).toBe('yes');
    expect(order.pickupLater).toBe('');
    // Nowhere to come to: they have it.
    expect(order.pickupFrom).toBe('');
  });

  it('tells a pickup still to collect where to come', async () => {
    state.order = { ...COUNTER_SALE, deliveredAt: null };
    const data = await resolveSilicaEmailData(ctx, EMPTY_DOC, ref, ORDER_TOKENS);
    const order = data.order as Record<string, unknown>;
    expect(order.pickupLater).toBe('yes');
    expect(order.pickedUp).toBe('');
    expect(order.pickupFrom).toBe('410 Mill St, Lowell, MA 01852');
  });

  it('marks a posted order as delivered, with its address readable whole and by part', async () => {
    state.order = { ...POSTED };
    const data = await resolveSilicaEmailData(ctx, EMPTY_DOC, ref, ORDER_TOKENS);
    const order = data.order as Record<string, unknown>;
    expect(order.pickup).toBe('');
    expect(order.delivery).toBe('yes');
    expect(order.pickupFrom).toBe('');
    // Typed with its own `toString`, which is the point: it reads whole as its line.
    const address = order.shippingAddress as { oneLine: string; toString(): string };
    const oneLine = 'Brynn O’Hara-Løvdal, 12 Harbour Rd, Portland, OR 97201';
    expect(address.oneLine).toBe(oneLine);
    // `{{order.shippingAddress}}`, bound whole by every receipt shipped before the
    // fix, printed "[object Object]".
    expect(String(address)).toBe(oneLine);
  });
});

describe('orderHandover', () => {
  it('is a pickup when the order was placed for collection', () => {
    expect(orderHandover({ shippingRateRef: 'collection:in-person' }, [])).toBe('pickup');
  });

  it('is a pickup when everything was handed over the counter', () => {
    expect(orderHandover({}, ['pickup', 'pickup'])).toBe('pickup');
  });

  it('is a delivery when anything went by a carrier, or nothing is known yet', () => {
    expect(orderHandover({}, ['pickup', 'ups'])).toBe('delivery');
    expect(orderHandover({ shippingRateRef: 'manual:abc' }, [])).toBe('delivery');
    expect(orderHandover(null, [])).toBe('delivery');
  });
});

describe('shippingAddressValue', () => {
  it("is empty for the till's JSON null and for no address at all", () => {
    expect(shippingAddressValue(null)).toBe('');
    expect(shippingAddressValue(undefined)).toBe('');
    expect(shippingAddressValue({})).toBe('');
  });

  it('keeps toString out of the fields', () => {
    const value = shippingAddressValue({ line1: '1 Main St', city: 'Lowell' });
    expect(Object.keys(value)).not.toContain('toString');
    expect(JSON.stringify(value)).not.toContain('toString');
  });
});
