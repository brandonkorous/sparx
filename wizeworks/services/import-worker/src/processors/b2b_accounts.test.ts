import pino from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENTITY_FIELDS, mapManually, validateRows } from '@wizeworks/migration';

// The trade-account contract, end to end without a database: a file mapped the way
// the Move-in column mapper maps it, validated the way the API validates it, then
// handed to the processor that saves it. The canonical field keys and the columns
// this processor reads once disagreed (`name`/`tier` against `company_name`/
// `pricing_tier`), so every trade account a Move-in carried failed "company_name is
// required" and every tier was dropped, while each side's own tests stayed green.

const calls = vi.hoisted(() => ({
  created: [] as Record<string, unknown>[],
  companyUpdates: [] as { where: unknown; data: Record<string, unknown> }[],
  contacts: [] as { accountId: string; input: Record<string, unknown> }[],
}));

vi.mock('@wizeworks/db', () => {
  const tx = {
    company: {
      findFirst: () => Promise.resolve(null),
      update: (args: { where: unknown; data: Record<string, unknown> }) => {
        calls.companyUpdates.push(args);
        return Promise.resolve({});
      },
    },
    b2bPricingTier: {
      findFirst: (args: { where: { name: { equals: string } } }) =>
        Promise.resolve(
          args.where.name.equals.toLowerCase() === 'gold' ? { id: 'tier-gold' } : null
        ),
    },
    customer: {
      findFirst: (args: { where: { email: { equals: string } } }) =>
        Promise.resolve(
          args.where.email.equals.toLowerCase() === 'buyer@acme.example'
            ? { id: 'customer-1' }
            : null
        ),
    },
    b2bAccountContact: { findFirst: () => Promise.resolve(null) },
  };
  return {
    withTenant: (_ctx: unknown, run: (client: typeof tx) => unknown) => run(tx),
  };
});

vi.mock('@wizeworks/crm', () => {
  class CrmConflictError extends Error {}
  return {
    CrmConflictError,
    companyService: {
      create: (_ctx: unknown, input: Record<string, unknown>) => {
        calls.created.push(input);
        return Promise.resolve({ id: `account-${calls.created.length}` });
      },
      // The tier is linked through the company's own save, so whatever a save of
      // the tier has to do (close a finished set-up task) happens on import too.
      update: (_ctx: unknown, id: string, input: Record<string, unknown>) => {
        calls.companyUpdates.push({ where: { id }, data: input });
        return Promise.resolve({});
      },
    },
    b2bAccountContactService: {
      create: (_ctx: unknown, accountId: string, input: Record<string, unknown>) => {
        calls.contacts.push({ accountId, input });
        return Promise.resolve({});
      },
    },
    objectDefService: { schemaFor: () => Promise.resolve({ fields: [] }) },
    propertiesFromRow: () => ({ values: {}, problems: [], matchedColumns: [] }),
    describeColumnProblems: () => '',
  };
});

const { B2B_ACCOUNT_COLUMNS, processB2bAccountRows, readAccountRow } =
  await import('./b2b_accounts');

const logger = pino({ level: 'silent' });
const ctx = { tenantId: '00000000-0000-0000-0000-000000000001' };

/** Map a file's headers onto trade-account fields by the label the mapper prints. */
function mapByLabel(raw: Record<string, string>[], labels: Record<string, string>) {
  const columnMap: Record<string, string> = {};
  for (const [header, label] of Object.entries(labels)) {
    const field = ENTITY_FIELDS.b2b_accounts.find((spec) => spec.label === label);
    if (field === undefined) throw new Error(`no trade-account field labelled ${label}`);
    columnMap[header] = field.key;
  }
  return mapManually('b2b_accounts', raw, columnMap);
}

beforeEach(() => {
  calls.created.length = 0;
  calls.companyUpdates.length = 0;
  calls.contacts.length = 0;
});

describe('the trade-account import contract', () => {
  it('reads exactly the fields Move in offers, no more and no fewer', () => {
    // A field offered and not read is data the tenant watches import and then
    // never sees; a column read and not offered can never be mapped.
    const offered = ENTITY_FIELDS.b2b_accounts.map((spec) => spec.key).sort();
    expect(offered).toEqual([...B2B_ACCOUNT_COLUMNS].sort());
  });

  it('saves a trade account mapped by Move in, with its name, tier and terms', async () => {
    const mapped = mapByLabel(
      [
        {
          Company: 'Acme Wholesale',
          Tier: 'Gold',
          Terms: 'NET30',
          Limit: '$5,000.00',
          Contact: 'buyer@acme.example',
        },
      ],
      {
        Company: 'Account name',
        Tier: 'Pricing tier',
        Terms: 'Payment terms',
        Limit: 'Credit limit',
        Contact: 'Primary contact',
      }
    );
    expect(validateRows('b2b_accounts', mapped.rows).errorRows).toEqual([]);

    const results = await processB2bAccountRows(ctx, mapped.rows, { upsert: true }, logger);

    expect(results).toEqual([{ rowIndex: 0, status: 'imported', naturalKey: 'Acme Wholesale' }]);
    expect(calls.created).toHaveLength(1);
    expect(calls.created[0]).toMatchObject({
      companyName: 'Acme Wholesale',
      paymentTerms: 'net30',
      creditLimit: 5000,
    });
    // Nothing is written to the legacy free-text column: it priced nothing, and
    // a name with no tier behind it read as a tier the account was not on
    // (sparx persona issue 086).
    expect(calls.created[0]).not.toHaveProperty('pricingTier');
    // The tier is linked, not just labelled: pricing reads the id.
    expect(calls.companyUpdates).toEqual([
      { where: { id: 'account-1' }, data: { pricingTierId: 'tier-gold' } },
    ]);
    expect(calls.contacts).toEqual([
      { accountId: 'account-1', input: { customerId: 'customer-1', role: 'primary_contact' } },
    ]);
  });

  it('says so when a tier or a contact named in the file does not exist yet', async () => {
    const results = await processB2bAccountRows(
      ctx,
      [{ company_name: 'Beta Supply', pricing_tier: 'Platinum', email: 'nobody@beta.example' }],
      { upsert: true },
      logger
    );
    expect(results[0]!.status).toBe('imported');
    expect(results[0]!.errorMsg).toContain('no pricing tier called “Platinum”');
    expect(results[0]!.errorMsg).toContain('No customer has the email nobody@beta.example');
  });

  it('still reads the trade-account export, whose headers are the same keys', () => {
    const read = readAccountRow({
      company_name: 'Acme Wholesale',
      pricing_tier: 'Gold',
      payment_terms: 'net60',
      credit_limit: '2500.00',
      discount_percent: '7.50',
      website: 'acme.example',
      status: 'credit_hold',
      tags: 'fleet, priority',
    });
    expect(read).toMatchObject({
      companyName: 'Acme Wholesale',
      tierName: 'Gold',
      paymentTerms: 'net60',
      creditLimit: 2500,
      discountPercent: 7.5,
      website: 'https://acme.example',
      status: 'credit_hold',
      tags: ['fleet', 'priority'],
      setAside: [],
    });
  });

  it('reports a value it could not use instead of dropping it in silence', () => {
    const read = readAccountRow({ company_name: 'Acme', payment_terms: 'Net 45' });
    expect(read.paymentTerms).toBeUndefined();
    expect(read.setAside.join(' ')).toContain('Net 45');
  });
});
