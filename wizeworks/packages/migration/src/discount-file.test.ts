import { describe, expect, it } from 'vitest';

import { discountExportRow, discountRowFromFile } from './discount-file';
import { validateRows } from './validate';

// The discount spreadsheet sparx writes and reads back. The export used to write the
// processor's private column names, and the processor read nothing else, so a Move-in
// discount failed "name is required". Both sides now use the canonical keys; a file
// saved from the old export is translated on the way in.

describe('reading an uploaded discount file', () => {
  it('translates every column of the older export into the canonical keys', () => {
    expect(
      discountRowFromFile({
        code: 'FIVER',
        name: 'Five off',
        type: 'fixed',
        scope: 'order',
        value_cents: '500',
        value_percent: '',
        status: 'archived',
        start_at: '2026-01-01T00:00:00.000Z',
        end_at: '2026-02-01T00:00:00.000Z',
        total_usage_limit: '20',
        per_customer_limit: '1',
        usage_count: '3',
      })
    ).toEqual({
      code: 'FIVER',
      title: 'Five off',
      type: 'fixed_amount',
      value: '5.00',
      status: 'disabled',
      starts_at: '2026-01-01T00:00:00.000Z',
      ends_at: '2026-02-01T00:00:00.000Z',
      usage_limit: '20',
      per_customer_limit: '1',
    });
  });

  it('lets a canonical column win over an old one in a file that has both', () => {
    expect(
      discountRowFromFile({
        code: 'MIX',
        title: 'New name',
        name: 'Old name',
        value: '12',
        value_percent: '99',
      })
    ).toEqual({ code: 'MIX', title: 'New name', value: '12' });
  });

  it('produces rows the Move-in validator accepts', () => {
    const row = discountRowFromFile({
      code: 'SAVE15',
      name: 'Save 15',
      type: 'percent',
      value_percent: '15',
      status: 'draft',
    });
    expect(validateRows('discounts', [row]).errorRows).toEqual([]);
  });
});

describe('writing the export', () => {
  it('writes a percentage discount the way the import reads it back', () => {
    const row = discountExportRow({
      code: 'SAVE15',
      name: 'Save 15',
      description: null,
      type: 'percent',
      valueCents: null,
      valuePercent: 15,
      currency: null,
      conditions: [{ kind: 'first_order_only', value: true }],
      totalUsageLimit: null,
      perCustomerLimit: 1,
      startAt: null,
      endAt: null,
      status: 'active',
      usageCount: 4,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(row).toMatchObject({
      type: 'percentage',
      value: '15',
      minimum_amount: '',
      status: 'active',
    });
    expect(discountRowFromFile(row)).toMatchObject({
      code: 'SAVE15',
      type: 'percentage',
      value: '15',
    });
  });
});
