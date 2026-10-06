import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A TRADE BUYER BUILDS HER QUOTE REQUEST FROM THE CATALOG (sparx persona issue 086).
 *
 * The /b2b page promised "From the catalog, the buyer builds a request
 * (quantities, delivery needs, notes) and submits it. It lands in your
 * dashboard, separate from the cart." The request they are still building is the
 * ACCOUNT's (every contact who can order sees the same one, from any device),
 * it is nobody else's, and the business hears nothing until they send it.
 */

const WASATCH = '8aa59a36-acc9-455f-b0ba-41c0b66292b9';
const BONNEVILLE = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const RENEE = 'fd7795a2-99f3-4583-b7be-efcb2d886a1b';
const MARCO = '0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e';
const INJECTOR = '6f0cf3c9-2fc3-4294-a285-643eb5ef229d';
const FILTER = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const RETIRED = '9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b';
const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' };

interface RequestRow {
  id: string;
  tenantId: string;
  companyId: string;
  status: string;
  startedByCustomerId: string | null;
  neededBy: Date | null;
  deliverTo: string | null;
  deliveryNotes: string | null;
  poNumber: string | null;
  notes: string | null;
  submittedAt: Date | null;
  submittedDocumentId: string | null;
  updatedAt: Date;
}
interface LineRow {
  id: string;
  tenantId: string;
  requestId: string;
  variantId: string | null;
  description: string;
  quantity: number;
  position: number;
}

let requests: RequestRow[];
let lines: LineRow[];
let seq = 0;
const newId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

/** Only plain equality on the row's own columns, which is all the service asks.
 *  A key the fake does not hold fails the match rather than being ignored, so a
 *  where clause cannot quietly widen. */
function matches(row: object, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v);
}

const CATALOG: Record<string, { title: string | null; product: { title: string } }> = {
  [INJECTOR]: { title: null, product: { title: 'Bosch Remanufactured Fuel Injector' } },
  [FILTER]: { title: '10 micron', product: { title: 'Fuel Filter' } },
};

const tx = {
  b2bQuoteRequest: {
    findFirst: vi.fn(({ where }: { where: Record<string, unknown> }) => {
      const row = requests.find((r) => matches(r, where));
      if (!row) return Promise.resolve(null);
      return Promise.resolve({
        ...row,
        lines: lines.filter((l) => l.requestId === row.id).sort((a, b) => a.position - b.position),
        startedBy:
          row.startedByCustomerId === RENEE
            ? { firstName: 'Renée', lastName: 'Castañeda', email: 'renee@wasatch.test' }
            : null,
      });
    }),
    createMany: vi.fn(
      ({
        data,
      }: {
        data: Pick<RequestRow, 'tenantId' | 'companyId' | 'startedByCustomerId'>[];
      }) => {
        for (const d of data) {
          if (requests.some((r) => r.companyId === d.companyId && r.status === 'open')) continue;
          requests.push({
            id: newId(),
            status: 'open',
            neededBy: null,
            deliverTo: null,
            deliveryNotes: null,
            poNumber: null,
            notes: null,
            submittedAt: null,
            submittedDocumentId: null,
            updatedAt: new Date(),
            ...d,
          });
        }
        return Promise.resolve({ count: data.length });
      }
    ),
    update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<RequestRow> }) => {
      const row = requests.find((r) => r.id === where.id);
      if (!row) throw new Error('no row');
      Object.assign(row, data, { updatedAt: new Date() });
      return Promise.resolve(row);
    }),
    updateMany: vi.fn(
      ({ where, data }: { where: Record<string, unknown>; data: Partial<RequestRow> }) => {
        const hit = requests.filter((r) => matches(r, where));
        for (const r of hit) Object.assign(r, data);
        return Promise.resolve({ count: hit.length });
      }
    ),
    deleteMany: vi.fn(({ where }: { where: Record<string, unknown> }) => {
      const gone = requests.filter((r) => matches(r, where)).map((r) => r.id);
      requests = requests.filter((r) => !gone.includes(r.id));
      lines = lines.filter((l) => !gone.includes(l.requestId));
      return Promise.resolve({ count: gone.length });
    }),
  },
  b2bQuoteRequestLine: {
    findFirst: vi.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(lines.find((l) => matches(l, where)) ?? null)
    ),
    update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<LineRow> }) => {
      const row = lines.find((l) => l.id === where.id);
      if (!row) throw new Error('no line');
      Object.assign(row, data);
      return Promise.resolve(row);
    }),
    create: vi.fn(({ data }: { data: Omit<LineRow, 'id'> }) => {
      const row = { id: newId(), ...data };
      lines.push(row);
      return Promise.resolve(row);
    }),
    createMany: vi.fn(({ data }: { data: Omit<LineRow, 'id'>[] }) => {
      for (const d of data) lines.push({ id: newId(), ...d });
      return Promise.resolve({ count: data.length });
    }),
    deleteMany: vi.fn(({ where }: { where: Record<string, unknown> }) => {
      const before = lines.length;
      lines = lines.filter((l) => !matches(l, where));
      return Promise.resolve({ count: before - lines.length });
    }),
    count: vi.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(lines.filter((l) => matches(l, where)).length)
    ),
  },
  productVariant: {
    findFirst: vi.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(CATALOG[where.id] ? { id: where.id, ...CATALOG[where.id] } : null)
    ),
    findMany: vi.fn(({ where }: { where: { id: { in: string[] } } }) =>
      Promise.resolve(
        where.id.in
          .filter((id) => CATALOG[id])
          .map((id) => ({ id, productId: `product-${id}`, ...CATALOG[id] }))
      )
    ),
  },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));

const create = vi.fn((_ctx: unknown, input: Record<string, unknown>) =>
  Promise.resolve({ id: 'doc-q', number: 'Q-000044', ...input })
);
let addLineFails = false;
const addLine = vi.fn((_ctx: unknown, id: string, _input: Record<string, unknown>) => {
  if (addLineFails) return Promise.reject(new Error('database went away'));
  return Promise.resolve({ id, number: 'Q-000044' });
});
const advance = vi.fn((_ctx: unknown, id: string) => Promise.resolve({ id, number: 'Q-000044' }));
const remove = vi.fn(() => Promise.resolve({ id: 'doc-q' }));
vi.mock('./billing-document-service', () => ({ create, remove }));
vi.mock('./billing-line-service', () => ({ addLine }));
vi.mock('./billing-document-stage-service', () => ({ advance }));
vi.mock('./b2b-quote-service', () => ({
  b2bQuoteDraftStage: vi.fn(() => Promise.resolve({ id: 'stage-draft', workflowId: 'wf-q' })),
  b2bQuoteStageByName: vi.fn(() => Promise.resolve({ id: 'stage-submitted' })),
}));

const service = await import('./b2b-quote-request-service');
const { CrmValidationError } = await import('../errors');

const renee = { accountId: WASATCH, customerId: RENEE };
const marco = { accountId: BONNEVILLE, customerId: MARCO };

beforeEach(() => {
  vi.clearAllMocks();
  requests = [];
  lines = [];
  addLineFails = false;
});

describe('building a request from the catalog', () => {
  it('starts the account’s request on the first item, named as the catalog names it', async () => {
    const view = await service.addItem(CTX, renee, { variantId: FILTER, quantity: 12 });
    expect(view.lines).toEqual([
      expect.objectContaining({
        variantId: FILTER,
        description: 'Fuel Filter, 10 micron',
        quantity: 12,
      }),
    ]);
    expect(view.startedBy).toBe('Renée Castañeda');
  });

  it('adds more of the same item to its line rather than listing it twice', async () => {
    await service.addItem(CTX, renee, { variantId: INJECTOR, quantity: 2 });
    const view = await service.addItem(CTX, renee, { variantId: INJECTOR, quantity: 4 });
    expect(view.lines).toHaveLength(1);
    expect(view.lines[0]?.quantity).toBe(6);
  });

  it('refuses an item the shop no longer sells, in words', async () => {
    await expect(service.addItem(CTX, renee, { variantId: RETIRED, quantity: 1 })).rejects.toThrow(
      CrmValidationError
    );
    expect(requests).toHaveLength(0);
  });

  it('keeps delivery needs, PO number and notes with the request', async () => {
    await service.addItem(CTX, renee, { variantId: INJECTOR, quantity: 6 });
    const view = await service.save(CTX, renee, {
      neededBy: '2026-10-20',
      deliverTo: 'Yard 2, 400 Industrial Way, Salt Lake City',
      deliveryNotes: 'Forklift on site',
      poNumber: 'WFUC-24-0901',
      notes: 'Price for six, and for twelve if it is cheaper each',
      lines: [
        { variantId: INJECTOR, quantity: 6 },
        { description: 'Injector seals to suit', quantity: 6 },
      ],
    });
    expect(view).toMatchObject({
      neededBy: '2026-10-20',
      deliverTo: 'Yard 2, 400 Industrial Way, Salt Lake City',
      deliveryNotes: 'Forklift on site',
      poNumber: 'WFUC-24-0901',
    });
    expect(view.lines.map((l) => l.description)).toEqual([
      'Bosch Remanufactured Fuel Injector',
      'Injector seals to suit',
    ]);
  });
});

describe('one account’s request is that account’s alone', () => {
  it('is not visible from another account', async () => {
    await service.addItem(CTX, renee, { variantId: INJECTOR, quantity: 6 });
    expect(await service.getOpen(CTX, BONNEVILLE)).toBeNull();
    expect(await service.getOpen(CTX, WASATCH)).not.toBeNull();
  });

  it('cannot be added to, saved over, sent or thrown away from another account', async () => {
    await service.addItem(CTX, renee, { variantId: INJECTOR, quantity: 6 });

    await service.addItem(CTX, marco, { variantId: FILTER, quantity: 1 });
    await service.save(CTX, marco, { lines: [{ description: 'Something else', quantity: 1 }] });
    await service.discard(CTX, BONNEVILLE);
    await expect(service.submit(CTX, marco)).rejects.toThrow(CrmValidationError);

    const wasatch = await service.getOpen(CTX, WASATCH);
    expect(wasatch?.lines).toEqual([expect.objectContaining({ variantId: INJECTOR, quantity: 6 })]);
    expect(create).not.toHaveBeenCalled();
  });

  it('asks only for the account it was given, every time', async () => {
    await service.addItem(CTX, renee, { variantId: INJECTOR, quantity: 6 });
    await service.getOpen(CTX, WASATCH);
    for (const call of tx.b2bQuoteRequest.findFirst.mock.calls) {
      expect(call[0].where).toMatchObject({ companyId: WASATCH });
    }
  });
});

describe('sending the request', () => {
  it('becomes a quote at Submitted carrying the delivery needs, PO number and notes', async () => {
    await service.addItem(CTX, renee, { variantId: INJECTOR, quantity: 6 });
    await service.save(CTX, renee, {
      neededBy: '2026-10-20',
      deliverTo: 'Yard 2',
      deliveryNotes: 'Forklift on site',
      poNumber: 'WFUC-24-0901',
      notes: 'Price for six',
      lines: [
        { variantId: INJECTOR, quantity: 6 },
        { description: 'Injector seals to suit', quantity: 6 },
      ],
    });

    const sent = await service.submit(CTX, renee);

    expect(sent).toEqual({ id: 'doc-q', number: 'Q-000044' });
    const input = create.mock.calls[0]?.[1];
    expect(input).toMatchObject({
      customerId: RENEE,
      companyId: WASATCH,
      poNumber: 'WFUC-24-0901',
      customerNote: 'Price for six',
      metadata: {
        delivery: { neededBy: '2026-10-20', deliverTo: 'Yard 2', notes: 'Forklift on site' },
      },
    });
    expect(addLine.mock.calls.map((c) => c[2])).toEqual([
      expect.objectContaining({ variantId: INJECTOR, quantity: 6, lineTypeKey: 'catalog' }),
      expect.objectContaining({ description: 'Injector seals to suit', quantity: 6, unitPrice: 0 }),
    ]);
    expect(advance).toHaveBeenCalledWith(CTX, 'doc-q', { stageId: 'stage-submitted' });
    // Sent, so the next item starts a new request.
    expect(await service.getOpen(CTX, WASATCH)).toBeNull();
    expect(requests[0]).toMatchObject({ status: 'submitted', submittedDocumentId: 'doc-q' });
  });

  it('will not send an empty request', async () => {
    await service.save(CTX, renee, { poNumber: 'WFUC-24-0901', lines: [] });
    await expect(service.submit(CTX, renee)).rejects.toThrow(CrmValidationError);
    expect(create).not.toHaveBeenCalled();
  });

  it('stays open for them to send again when the quote could not be made', async () => {
    await service.addItem(CTX, renee, { variantId: INJECTOR, quantity: 6 });
    addLineFails = true;
    await expect(service.submit(CTX, renee)).rejects.toThrow('database went away');
    expect((await service.getOpen(CTX, WASATCH))?.lines).toHaveLength(1);
    // And the half-made quote does not sit in the business's queue.
    expect(remove).toHaveBeenCalledWith(CTX, 'doc-q');
  });
});

// Sparx persona issue 086: Renée's request for 100 O-rings and 6 CP4 kits became
// a quote priced at LIST ($4.32, $400.00, $2,832.00), although Wasatch is in the
// Fleet group at 12% off ($3.80, $352.00, $2,492.00). A quote typed in the
// console already starts at the account's price with the note saying why (issue
// 077); a quote the buyer sends starts the same way.
describe('the account’s price on a sent request', () => {
  const pricer = vi.fn(
    (q: { variantId: string; accountId: string; quantity: number; propertyId: string | null }) =>
      Promise.resolve(
        q.variantId === INJECTOR
          ? { unitPrice: 352, priceNote: 'Fleet price: 12% off $400.00' }
          : { unitPrice: 9.5, priceNote: null }
      )
  );

  const sent = {
    customerId: RENEE,
    accountId: WASATCH,
    customerNote: null,
    poNumber: null,
    delivery: { neededBy: null, deliverTo: null, notes: null },
    lines: [
      { variantId: INJECTOR, description: 'Bosch Remanufactured Fuel Injector', quantity: 6 },
      { variantId: null, description: 'Injector seals to suit', quantity: 6 },
      { variantId: FILTER, description: 'Fuel Filter, 10 micron', quantity: 100 },
    ],
  };

  it('starts each catalog line at the account’s price, with the note saying why', async () => {
    await service.createRequestedQuote(CTX, sent, { accountPrice: pricer });
    const [injector, typed, filter] = addLine.mock.calls.map((c) => c[2]);
    expect(injector).toMatchObject({
      variantId: INJECTOR,
      productId: `product-${INJECTOR}`,
      lineTypeKey: 'catalog',
      unitPrice: 352,
      metadata: {
        priceNote: 'Fleet price: 12% off $400.00',
        productLabel: 'Bosch Remanufactured Fuel Injector',
      },
    });
    // The list price is the account's price: no note to explain.
    expect(filter).toMatchObject({ unitPrice: 9.5, metadata: { productLabel: 'Fuel Filter' } });
    expect((filter?.metadata as Record<string, unknown>).priceNote).toBeUndefined();
    // Asked for this account, at the quantity asked for, for the quote's site.
    expect(pricer).toHaveBeenCalledWith({
      variantId: FILTER,
      accountId: WASATCH,
      quantity: 100,
      propertyId: null,
    });
    // Something typed in by hand has nothing to price it from.
    expect(typed).toEqual({ description: 'Injector seals to suit', quantity: 6, unitPrice: 0 });
  });

  it('starts at the list price when the account’s price cannot be worked out', async () => {
    const broken = vi.fn(() => Promise.reject(new Error('price engine down')));
    await service.createRequestedQuote(CTX, sent, { accountPrice: broken });
    const injector = addLine.mock.calls[0]?.[2];
    expect(injector).toMatchObject({ variantId: INJECTOR, lineTypeKey: 'catalog' });
    expect(injector).not.toHaveProperty('unitPrice');
  });

  it('prices a request built up from the catalog the same way when it is sent', async () => {
    await service.addItem(CTX, renee, { variantId: INJECTOR, quantity: 6 });
    await service.submit(CTX, renee, { accountPrice: pricer });
    expect(addLine.mock.calls[0]?.[2]).toMatchObject({ unitPrice: 352 });
  });
});
