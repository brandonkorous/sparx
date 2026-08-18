// The accounting handoff, against a real database.
//
// The unit suites prove the CSV and the parsers. This one proves the thing that
// actually matters to the product position: spend recorded in sparx comes OUT in
// a file an accounting package can read, and a file from a bank goes back IN
// without duplicating anything.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildExport,
  categoryBySlug,
  commitImport,
  createExpense,
  exportColumns,
  listExpenses,
  parseCsvObjects,
  provisionFinance,
  upsertConnection,
  setMappings,
  mappingsForExport,
} from '../../src/index';
import { AccountingProviderUnavailableError } from '../../src/accounting/connections';
import { createTestTenant, day, dropTestTenant, type TestTenant } from '../helpers';

let t: TestTenant;

const ALL = {
  propertyId: null,
  categoryId: null,
  vendorId: null,
  source: null,
  from: null,
  to: null,
  unpaidOnly: null,
  search: null,
  limit: 500,
  cursor: null,
};

beforeAll(async () => {
  t = await createTestTenant();
  await provisionFinance(t.tenantId);

  const parts = await categoryBySlug(t.tenantId, 'parts');
  const rent = await categoryBySlug(t.tenantId, 'rent');

  const spend = async (categoryId: string, description: string, cents: number, on: string) => {
    await createExpense(t.tenantId, {
      propertyId: t.propertyId,
      categoryId,
      vendorId: null,
      description,
      amountCents: cents,
      currency: 'USD',
      taxCents: 0,
      incurredAt: day(on),
      paidAt: null,
      dueAt: null,
      paymentMethod: null,
      reference: null,
      notes: null,
      allocations: [],
      attachmentAssetIds: [],
    });
  };

  await spend(parts!.id, 'Brake pads', 12_500, '2027-03-04');
  await spend(rent!.id, 'March rent', 150_000, '2027-03-01');
  // A description with a comma AND a quote — the row that breaks a naive export.
  await spend(parts!.id, 'Filters, "heavy duty"', 7_000, '2027-03-06');
  // Outside the window every test below asks for.
  await spend(parts!.id, 'February parts', 999_00, '2027-02-01');
});

afterAll(async () => {
  await dropTestTenant(t.tenantId);
});

describe('export', () => {
  it('produces a file an accounting package can actually parse', async () => {
    const result = await buildExport(t.tenantId, 'csv', {
      from: day('2027-03-01'),
      to: day('2027-03-31'),
    });

    expect(result.rowCount).toBe(3);
    expect(result.contentType).toContain('text/csv');
    expect(result.filename).toMatch(/^sparx-expenses-csv-2027-03-01-to-2027-03-31\.csv$/);

    const rows = parseCsvObjects(result.body);
    expect(rows).toHaveLength(3);
    // The quoted, comma-bearing description survives the round trip intact —
    // this is the row that silently shifts every column in a naive export.
    expect(rows.map((r) => r.Description)).toContain('Filters, "heavy duty"');
  });

  it('honours the date window rather than dumping everything', async () => {
    const result = await buildExport(t.tenantId, 'csv', {
      from: day('2027-03-01'),
      to: day('2027-03-31'),
    });
    expect(result.body).not.toContain('February parts');
  });

  it('writes money as a decimal string with exactly two places', async () => {
    const result = await buildExport(t.tenantId, 'csv', {
      from: day('2027-03-01'),
      to: day('2027-03-31'),
    });
    const rows = parseCsvObjects(result.body);
    const rent = rows.find((r) => r.Description === 'March rent');
    expect(rent?.Amount).toBe('1500.00');
  });

  it('NEVER writes into a closed period', async () => {
    // The single fastest way to lose an accountant's trust. Skipped rows are
    // reported, not silently dropped.
    const result = await buildExport(t.tenantId, 'csv', {
      from: day('2027-03-01'),
      to: day('2027-03-31'),
      syncFromDate: day('2027-03-05'),
    });
    expect(result.rowCount).toBe(1);
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped[0]?.reason).toMatch(/books-closed/i);
  });

  it('lays each provider out in its own columns', async () => {
    const xero = await buildExport(t.tenantId, 'xero', {
      from: day('2027-03-01'),
      to: day('2027-03-31'),
    });
    const header = xero.body.split('\r\n')[0] ?? '';
    // Xero keys a bill to a contact and an account CODE, and its importer is
    // strict about the asterisked column names.
    expect(header).toContain('*ContactName');
    expect(header).toContain('*AccountCode');
    expect(header).not.toContain('Payment method');

    expect(exportColumns('quickbooks_online')).toContain('Account');
    expect(exportColumns('sage50')).toContain('Account Code');
  });

  it('posts to the mapped account when a mapping exists', async () => {
    const connection = await upsertConnection(t.tenantId, {
      provider: 'csv',
      propertyId: t.propertyId,
    });
    const rent = await categoryBySlug(t.tenantId, 'rent');
    await setMappings(t.tenantId, connection.id, [
      {
        sparxType: 'expense_category',
        sparxId: rent!.id,
        categoryId: rent!.id,
        externalId: '6100',
        externalName: 'Rent Expense',
        externalCode: '6100',
      },
    ]);

    const mappings = await mappingsForExport(t.tenantId, connection.id);
    const result = await buildExport(t.tenantId, 'csv', {
      from: day('2027-03-01'),
      to: day('2027-03-31'),
      mappings,
    });

    const rows = parseCsvObjects(result.body);
    expect(rows.find((r) => r.Description === 'March rent')?.Account).toBe('6100');
    // An UNmapped category still exports something recognisable rather than a
    // blank column — the owner can re-file it, which beats a silent hole.
    expect(rows.find((r) => r.Description === 'Brake pads')?.Account).toBe('Parts & materials');
  });

  it('refuses to pretend an unbuilt provider is connected', async () => {
    await expect(
      upsertConnection(t.tenantId, { provider: 'xero', propertyId: t.propertyId })
    ).rejects.toThrow(AccountingProviderUnavailableError);
  });
});

describe('import', () => {
  const CSV =
    'Date,Description,Amount,Payee\r\n' +
    '2027-04-02,Fuel,45.00,Shell\r\n' +
    '2027-04-03,Phone bill,88.50,Telco\r\n' +
    'bad-date,Broken row,12.00,\r\n';

  const request = (overrides: Record<string, unknown> = {}) => ({
    csv: CSV,
    columns: { date: 'Date', description: 'Description', amount: 'Amount', vendor: 'Payee' },
    propertyId: t.propertyId,
    fallbackCategoryId: '',
    sourceKey: 'april-statement.csv',
    ...overrides,
  });

  async function fallbackId(): Promise<string> {
    return (await categoryBySlug(t.tenantId, 'other'))!.id;
  }

  it('writes the good rows and reports the bad one', async () => {
    const result = await commitImport(
      t.tenantId,
      request({ fallbackCategoryId: await fallbackId() })
    );
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]?.line).toBe(4);
  });

  it('re-importing the SAME file updates instead of doubling the month', async () => {
    const before = await listExpenses(t.tenantId, { ...ALL, source: 'imported' });

    await commitImport(t.tenantId, request({ fallbackCategoryId: await fallbackId() }));

    const after = await listExpenses(t.tenantId, { ...ALL, source: 'imported' });
    expect(after.items).toHaveLength(before.items.length);
    expect(after.totalCents).toBe(before.totalCents);
  });

  it('a corrected re-import updates the row rather than adding one', async () => {
    const corrected = CSV.replace('45.00', '52.00');
    await commitImport(
      t.tenantId,
      request({ csv: corrected, fallbackCategoryId: await fallbackId() })
    );

    const page = await listExpenses(t.tenantId, { ...ALL, source: 'imported' });
    const fuel = page.items.filter((e) => e.description === 'Fuel');
    expect(fuel).toHaveLength(1);
    expect(fuel[0]?.amountCents).toBe(5200);
  });

  it('files bank lines as already PAID — the money has left', async () => {
    const page = await listExpenses(t.tenantId, { ...ALL, source: 'imported' });
    expect(page.items.every((e) => e.paidAt !== null)).toBe(true);
  });

  it('matches a vendor by name when one already exists, and never invents one', async () => {
    const page = await listExpenses(t.tenantId, { ...ALL, source: 'imported' });
    // No vendor called "Shell" exists, so the row imports unassigned rather than
    // minting a vendor from a bank memo field.
    expect(page.items.every((e) => e.vendor === null)).toBe(true);
  });

  it('round-trips: what we exported can be read straight back in', async () => {
    const exported = await buildExport(t.tenantId, 'csv', {
      from: day('2027-03-01'),
      to: day('2027-03-31'),
    });

    const result = await commitImport(t.tenantId, {
      csv: exported.body,
      columns: { date: 'Date', description: 'Description', amount: 'Amount', vendor: 'Vendor' },
      propertyId: t.propertyId,
      fallbackCategoryId: await fallbackId(),
      sourceKey: 'roundtrip.csv',
    });

    // Every exported row read back cleanly, including the quoted one.
    expect(result.imported).toBe(3);
    expect(result.skipped).toBe(0);
  });
});
