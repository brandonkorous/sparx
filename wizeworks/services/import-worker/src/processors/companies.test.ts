import pino from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENTITY_FIELDS, mapManually, validateRows } from '@wizeworks/migration';

// The company contract, end to end without a database: a file mapped the way the
// Move-in column mapper maps it, validated the way the API validates it, then handed
// to the processor that saves it. Phone, street address and created date were once
// offered for companies and read by nothing, so a HubSpot, Salesforce or Pipedrive
// move showed them as mapped and dropped every value, with each side's own tests
// green.

const state = vi.hoisted(() => ({
  existing: null as null | { id: string; tags: string[]; domains: string[] },
  created: [] as Record<string, unknown>[],
  updated: [] as { id: string; input: Record<string, unknown> }[],
}));

vi.mock('@wizeworks/db', () => {
  const tx = {
    company: { findFirst: () => Promise.resolve(state.existing) },
  };
  return {
    withTenant: (_ctx: unknown, run: (client: typeof tx) => unknown) => run(tx),
    prisma: {
      user: {
        findFirst: (args: { where: { email: { equals: string } } }) =>
          Promise.resolve(
            args.where.email.equals.toLowerCase() === 'rep@team.example' ? { id: 'user-rep' } : null
          ),
      },
    },
  };
});

vi.mock('@wizeworks/inventory', () => ({ inventoryService: {} }));

vi.mock('@wizeworks/crm', () => ({
  companyService: {
    create: (_ctx: unknown, input: Record<string, unknown>) => {
      state.created.push(input);
      return Promise.resolve({ id: `company-${state.created.length}` });
    },
    update: (_ctx: unknown, id: string, input: Record<string, unknown>) => {
      state.updated.push({ id, input });
      return Promise.resolve({});
    },
  },
}));

const { COMPANY_COLUMNS, companiesProcessor } = await import('./companies');

const logger = pino({ level: 'silent' });
const ctx = { tenantId: '00000000-0000-0000-0000-000000000001' };

/** Map a file's headers onto company fields by the label the mapper prints. */
function mapByLabel(raw: Record<string, string>[], labels: Record<string, string>) {
  const columnMap: Record<string, string> = {};
  for (const [header, label] of Object.entries(labels)) {
    const field = ENTITY_FIELDS.companies.find((spec) => spec.label === label);
    if (field === undefined) throw new Error(`no company field labelled ${label}`);
    columnMap[header] = field.key;
  }
  return mapManually('companies', raw, columnMap);
}

beforeEach(() => {
  state.existing = null;
  state.created.length = 0;
  state.updated.length = 0;
});

describe('the company import contract', () => {
  it('reads exactly the fields Move in offers, no more and no fewer', () => {
    // A field offered and not read is data the tenant watches import and then never
    // sees; a column read and not offered can never be mapped.
    const offered = ENTITY_FIELDS.companies.map((spec) => spec.key).sort();
    expect(offered).toEqual([...COMPANY_COLUMNS].sort());
  });

  it('reports phone, address and created date as not imported, since a company cannot hold them', () => {
    // The CRM vendor adapters still carry these columns; the file report must list
    // them under "not imported" rather than as mapped fields that vanish.
    const report = validateRows('companies', [
      {
        name: 'Harbor Freightworks',
        phone: '555-0100',
        address1: '12 Dock St',
        city: 'Portland',
        province: 'OR',
        country: 'US',
        zip: '97201',
        created_at: '2024-02-01',
      },
    ]);
    expect(report.unmappedColumns).toEqual([
      'address1',
      'city',
      'country',
      'created_at',
      'phone',
      'province',
      'zip',
    ]);
  });

  it('saves every offered field of a company mapped by Move in', async () => {
    const mapped = mapByLabel(
      [
        {
          Company: 'Harbor Freightworks',
          Site: 'https://www.harborfreight.example/about',
          Sector: 'Logistics',
          Staff: '85',
          Revenue: '$1,200,000',
          Rep: 'rep@team.example',
          About: 'Regional freight broker.',
        },
      ],
      {
        Company: 'Company name',
        Site: 'Website',
        Sector: 'Industry',
        Staff: 'Employees',
        Revenue: 'Annual revenue',
        Rep: 'Owner',
        About: 'Description',
      }
    );
    expect(validateRows('companies', mapped.rows).errorRows).toEqual([]);

    const results = await companiesProcessor.run(ctx, mapped.rows, { upsert: true }, logger);

    expect(results).toEqual([
      { rowIndex: 0, status: 'imported', naturalKey: 'Harbor Freightworks' },
    ]);
    expect(state.created).toHaveLength(1);
    const input = state.created[0]!;
    expect(input).toMatchObject({
      companyName: 'Harbor Freightworks',
      website: 'https://harborfreight.example',
      domains: ['harborfreight.example'],
      assignedRepId: 'user-rep',
      fleetSize: 85,
      tags: ['Logistics'],
    });
    expect(input.notes).toContain('Regional freight broker.');
    expect(input.notes).toContain('1,200,000');
    expect(input.notes).toContain('Industry: Logistics.');
  });

  it('never clears what a company already has from a blank cell, and adds rather than replaces', async () => {
    state.existing = {
      id: 'company-existing',
      tags: ['priority'],
      domains: ['harbor-group.example'],
    };

    await companiesProcessor.run(
      ctx,
      [{ name: 'Harbor Freightworks', domain: 'harborfreight.example', industry: 'Logistics' }],
      { upsert: true },
      logger
    );
    expect(state.updated).toHaveLength(1);
    expect(state.updated[0]!.input).toMatchObject({
      tags: ['priority', 'Logistics'],
      domains: ['harbor-group.example', 'harborfreight.example'],
    });

    state.updated.length = 0;
    await companiesProcessor.run(ctx, [{ name: 'Harbor Freightworks' }], { upsert: true }, logger);
    const input = state.updated[0]!.input;
    expect(input).toEqual({ companyName: 'Harbor Freightworks' });
  });
});
