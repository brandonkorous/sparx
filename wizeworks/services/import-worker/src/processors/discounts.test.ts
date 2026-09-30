import pino from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ENTITY_FIELDS,
  discountExportRow,
  discountRowFromFile,
  mapManually,
  validateRows,
} from '@wizeworks/migration';

// The discount contract, down both roads a discount file takes.
//
// Move in maps a file onto the canonical keys; the discount CSV endpoint takes a file
// straight from a tenant, translating one saved from the older export. Both hand rows
// to the same processor. It used to read the old export's column names while Move in
// offered the canonical ones, so every discount a Move-in carried failed "name is
// required" and lost its value, dates and limits, with each side's tests green.

const state = vi.hoisted(() => ({
  existing: null as null | { id: string; status: string; type: string; conditions: unknown },
  created: [] as Record<string, unknown>[],
  updated: [] as { id: string; input: Record<string, unknown> }[],
  activated: [] as string[],
}));

vi.mock('@wizeworks/db', () => {
  const tx = { discount: { findFirst: () => Promise.resolve(state.existing) } };
  return {
    withTenant: (_ctx: unknown, run: (client: typeof tx) => unknown) => run(tx),
  };
});

vi.mock('@wizeworks/commerce', () => ({
  discountService: {
    createDiscount: (_ctx: unknown, input: Record<string, unknown>) => {
      state.created.push(input);
      return Promise.resolve({ id: `discount-${state.created.length}`, code: input.code });
    },
    updateDiscount: (_ctx: unknown, id: string, input: Record<string, unknown>) => {
      state.updated.push({ id, input });
      return Promise.resolve();
    },
    activateDiscount: (_ctx: unknown, id: string) => {
      state.activated.push(id);
      return Promise.resolve();
    },
  },
}));

const { discountsProcessor } = await import('./discounts');

const logger = pino({ level: 'silent' });
const ctx = { tenantId: '00000000-0000-0000-0000-000000000001' };

function mapByLabel(raw: Record<string, string>[], labels: Record<string, string>) {
  const columnMap: Record<string, string> = {};
  for (const [header, label] of Object.entries(labels)) {
    const field = ENTITY_FIELDS.discounts.find((spec) => spec.label === label);
    if (field === undefined) throw new Error(`no discount field labelled ${label}`);
    columnMap[header] = field.key;
  }
  return mapManually('discounts', raw, columnMap);
}

beforeEach(() => {
  state.existing = null;
  state.created.length = 0;
  state.updated.length = 0;
  state.activated.length = 0;
});

describe('a discount moved in through the mapper', () => {
  it('saves every offered field of a percentage discount', async () => {
    const mapped = mapByLabel(
      [
        {
          Code: 'spring20',
          Label: 'Spring sale',
          About: 'Twenty off the spring range',
          Kind: 'percentage',
          Amount: '20',
          Money: 'usd',
          Min: '$50.00',
          Limit: '500',
          Each: '2',
          From: '2026-03-01',
          To: '2026-03-31',
          State: 'active',
        },
      ],
      {
        Code: 'Code',
        Label: 'Name',
        About: 'Description',
        Kind: 'Type',
        Amount: 'Value',
        Money: 'Currency',
        Min: 'Minimum spend',
        Limit: 'Usage limit',
        Each: 'Uses per customer',
        From: 'Starts',
        To: 'Ends',
        State: 'Status',
      }
    );
    expect(validateRows('discounts', mapped.rows).errorRows).toEqual([]);

    const results = await discountsProcessor.run(ctx, mapped.rows, { upsert: true }, logger);

    expect(results).toEqual([{ rowIndex: 0, status: 'imported', naturalKey: 'SPRING20' }]);
    expect(state.created[0]).toEqual({
      code: 'SPRING20',
      name: 'Spring sale',
      description: 'Twenty off the spring range',
      type: 'percent',
      valuePercent: 20,
      currency: 'USD',
      conditions: [{ kind: 'min_subtotal_cents', value: 5000 }],
      totalUsageLimit: 500,
      perCustomerLimit: 2,
      startAt: new Date('2026-03-01').toISOString(),
      endAt: new Date('2026-03-31').toISOString(),
    });
    expect(state.activated).toEqual(['discount-1']);
  });

  it('turns an amount off into cents and uses the code when there is no name', async () => {
    const results = await discountsProcessor.run(
      ctx,
      [{ code: 'TENOFF', type: 'fixed_amount', value: '10', status: 'disabled' }],
      { upsert: true },
      logger
    );
    expect(results[0]).toMatchObject({ status: 'imported' });
    expect(state.created[0]).toEqual({
      code: 'TENOFF',
      name: 'TENOFF',
      type: 'fixed',
      valueCents: 1000,
    });
    // Disabled arrives switched off.
    expect(state.activated).toEqual([]);
  });

  it('refuses a row it cannot save, saying why, instead of guessing a type', async () => {
    const results = await discountsProcessor.run(
      ctx,
      [
        { code: 'BOGO', type: 'buy_x_get_y', value: '100' },
        { code: 'NOTYPE', value: '15' },
        { code: 'NOVALUE', type: 'percentage' },
      ],
      { upsert: true },
      logger
    );
    expect(results.map((r) => r.status)).toEqual(['error', 'error', 'error']);
    expect(results[0]!.errorMsg).toContain('buy_x_get_y');
    expect(results[1]!.errorMsg).toContain('percentage, an amount off, or free shipping');
    expect(results[2]!.errorMsg).toContain('how much');
    expect(state.created).toEqual([]);
  });

  it('never clears what a discount already has from a blank cell, and keeps its other rules', async () => {
    state.existing = {
      id: 'discount-live',
      status: 'active',
      type: 'percent',
      conditions: [
        { kind: 'first_order_only', value: true },
        { kind: 'min_subtotal_cents', value: 2000 },
      ],
    };

    await discountsProcessor.run(ctx, [{ code: 'spring20' }], { upsert: true }, logger);
    expect(state.updated).toEqual([{ id: 'discount-live', input: {} }]);

    state.updated.length = 0;
    await discountsProcessor.run(
      ctx,
      [{ code: 'SPRING20', value: '25', minimum_amount: '75', status: 'expired' }],
      { upsert: true },
      logger
    );
    expect(state.updated[0]!.input).toEqual({
      valuePercent: 25,
      conditions: [
        { kind: 'first_order_only', value: true },
        { kind: 'min_subtotal_cents', value: 7500 },
      ],
    });
    // "Expired" in an old file never switches off a promotion that is live here.
    expect(state.activated).toEqual([]);
  });
});

describe('a discount through the CSV endpoint', () => {
  it('imports a file saved from the older export the way it was written', async () => {
    const oldExport = [
      {
        code: 'SAVE15',
        name: 'Save 15',
        description: '',
        type: 'percent',
        scope: 'order',
        value_cents: '',
        value_percent: '15',
        currency: '',
        status: 'active',
        start_at: '2026-01-01T00:00:00.000Z',
        end_at: '',
        total_usage_limit: '100',
        per_customer_limit: '1',
        usage_count: '7',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
      {
        code: 'FIVER',
        name: 'Five off',
        description: '',
        type: 'fixed',
        scope: 'order',
        value_cents: '500',
        value_percent: '',
        currency: 'USD',
        status: 'draft',
        start_at: '',
        end_at: '',
        total_usage_limit: '',
        per_customer_limit: '1',
        usage_count: '0',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ];

    const results = await discountsProcessor.run(
      ctx,
      oldExport.map(discountRowFromFile),
      { upsert: true },
      logger
    );

    expect(results.map((r) => r.status)).toEqual(['imported', 'imported']);
    expect(state.created).toEqual([
      {
        code: 'SAVE15',
        name: 'Save 15',
        type: 'percent',
        valuePercent: 15,
        totalUsageLimit: 100,
        perCustomerLimit: 1,
        startAt: '2026-01-01T00:00:00.000Z',
      },
      {
        code: 'FIVER',
        name: 'Five off',
        type: 'fixed',
        valueCents: 500,
        currency: 'USD',
        perCustomerLimit: 1,
      },
    ]);
    // Active comes back live; a draft comes back switched off.
    expect(state.activated).toEqual(['discount-1']);
  });

  it('round-trips the current export through the endpoint unchanged', async () => {
    const exported = discountExportRow({
      code: 'WINTER',
      name: 'Winter clear-out',
      description: 'Last of the coats',
      type: 'fixed',
      valueCents: 1250,
      valuePercent: null,
      currency: 'GBP',
      conditions: [{ kind: 'min_subtotal_cents', value: 4000 }],
      totalUsageLimit: 50,
      perCustomerLimit: 3,
      startAt: '2026-11-01T00:00:00.000Z',
      endAt: '2026-12-01T00:00:00.000Z',
      status: 'active',
      usageCount: 12,
      updatedAt: '2026-11-02T00:00:00.000Z',
    });

    await discountsProcessor.run(ctx, [discountRowFromFile(exported)], { upsert: true }, logger);

    expect(state.created[0]).toEqual({
      code: 'WINTER',
      name: 'Winter clear-out',
      description: 'Last of the coats',
      type: 'fixed',
      valueCents: 1250,
      currency: 'GBP',
      conditions: [{ kind: 'min_subtotal_cents', value: 4000 }],
      totalUsageLimit: 50,
      perCustomerLimit: 3,
      startAt: '2026-11-01T00:00:00.000Z',
      endAt: '2026-12-01T00:00:00.000Z',
    });
    expect(state.activated).toEqual(['discount-1']);
  });

  it('writes the export in exactly the columns Move in offers, then two read-only facts', () => {
    const exported = discountExportRow({
      code: null,
      name: 'Automatic',
      description: null,
      type: 'free_shipping',
      valueCents: null,
      valuePercent: null,
      currency: null,
      conditions: [],
      totalUsageLimit: null,
      perCustomerLimit: 1,
      startAt: null,
      endAt: null,
      status: 'draft',
      usageCount: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(Object.keys(exported)).toEqual([
      ...ENTITY_FIELDS.discounts.map((field) => field.key),
      'times_used',
      'updated_at',
    ]);
  });
});
