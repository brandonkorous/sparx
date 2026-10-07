// The import itself, not only the lookup: a re-imported walk-in with no email
// is updated, and the practice run says so first (sparx persona issue 106).

import { describe, expect, it, vi } from 'vitest';

const findMany = vi.fn((_args: unknown) =>
  Promise.resolve([{ id: 'desmond', doNotContact: false, phone: '(801) 555-0193' }])
);
const update = vi.fn((_ctx: unknown, _id: string, _patch: unknown) => Promise.resolve({}));
const create = vi.fn((_ctx: unknown, _input: unknown) => Promise.resolve({ id: 'new' }));

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, run: (tx: unknown) => unknown) =>
    Promise.resolve(
      run({
        customer: { findMany, findFirst: () => Promise.resolve(null) },
        engagementMessage: { findFirst: () => Promise.resolve(null) },
      })
    ),
}));
vi.mock('@wizeworks/crm', () => ({
  checkCustomerInput: () => null,
  describeColumnProblems: () => '',
  describeCustomerError: (err: unknown) => String(err),
  engagementService: { logNote: () => Promise.resolve() },
  customerService: {
    update,
    create,
    listAddresses: () => Promise.resolve([{ id: 'a' }]),
    addAddress: () => Promise.resolve(),
  },
  objectDefService: { schemaFor: () => Promise.resolve({}) },
  propertiesFromRow: () => ({ values: {}, problems: [] }),
}));

const { processCustomerRows, previewCustomerRows } = await import('./customers');

const CTX = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' };
const DESMOND = {
  first_name: 'Desmond',
  last_name: 'Achterberg',
  phone: '(801) 555-0193',
  note: 'Walk-in. No email on file; call him when parts arrive.',
};
const quiet = vi.fn();
const logger = { child: () => logger, debug: quiet, warn: quiet, error: quiet } as never;

describe('re-importing a customer with no email', () => {
  it('updates the person already here instead of adding them again', async () => {
    const [result] = await processCustomerRows(CTX, [DESMOND], { upsert: true }, logger);
    expect(result?.errorMsg ?? '').toBe('');
    expect(result?.status).toBe('updated');
    expect(update).toHaveBeenCalledWith(CTX, 'desmond', expect.anything());
    expect(create).not.toHaveBeenCalled();
  });

  it('says so in the practice run', async () => {
    const [preview] = await previewCustomerRows(CTX, [DESMOND], { upsert: true });
    expect(preview?.action).toBe('update');
  });
});
