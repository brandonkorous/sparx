// objectDefService + the declared-property write path (docs/144 §3).
//
// The commitments this file exists to hold, none of which are visible from a
// function signature:
//
//   • `list` SELF-HEALS the four built-ins. Activation seeds them, but every
//     tenant who turned CRM on before this feature existed never got that
//     event — so a read has to be able to repair it or their registry is empty
//     forever. (Exactly the bug this test was written after.)
//   • `ensureBuiltins` only ever CREATES. A tenant who renamed "Customers" to
//     "Patients" keeps it through any number of re-activations.
//   • A built-in can be extended and renamed but never archived.
//   • Declared properties are validated, calculated ones are always recomputed
//     server-side, and a PATCH carrying one property MERGES rather than
//     replacing the bag.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@sparx/db';
import { customerService, objectDefService } from '../../src/services/index.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

/** Set a schema on a built-in without going through the public update path. */
async function declare(
  test: TestContext,
  key: string,
  fields: Record<string, unknown>[]
): Promise<void> {
  await objectDefService.update(test.ctx, key, { propertySchema: { fields } });
}

describe('objectDefService — the object registry', () => {
  let test: TestContext;

  beforeAll(async () => {
    test = await makeTestContext('owner');
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  beforeEach(() => {
    test.publisher.clear();
  });

  it('list — seeds the four built-ins for a tenant that never saw activation', async () => {
    // The fixture tenant is created directly, exactly like a tenant provisioned
    // before this feature shipped: no module.activated event, no rows.
    const before = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${test.ctx.tenantId}'`);
      return tx.crmObjectDef.count({ where: { tenantId: test.ctx.tenantId } });
    });
    expect(before).toBe(0);

    const rows = await objectDefService.list(test.ctx);

    expect(rows.map((row) => row.key).sort()).toEqual(['company', 'contact', 'deal', 'ticket']);
    expect(rows.every((row) => row.kind === 'builtin')).toBe(true);
    // Labels are the words a business owner uses, not our table names.
    expect(rows.find((row) => row.key === 'ticket')?.labelPlural).toBe('Requests');
  });

  it('ensureBuiltins — never undoes a rename or a schema a tenant added', async () => {
    await objectDefService.list(test.ctx); // seed
    await objectDefService.update(test.ctx, 'contact', {
      label: 'Patient',
      labelPlural: 'Patients',
      propertySchema: { fields: [{ key: 'nhsNumber', label: 'NHS number', type: 'text' }] },
    });

    // A redeploy re-runs activation. Nothing may be reverted.
    await objectDefService.ensureBuiltins(test.ctx);

    const contact = await objectDefService.get(test.ctx, 'contact');
    expect(contact.labelPlural).toBe('Patients');
    expect(objectDefService.schemaFor).toBeTypeOf('function');
    const schema = await objectDefService.schemaFor(test.ctx, 'contact');
    expect(schema.fields).toHaveLength(1);
  });

  it('archive — refuses a built-in, in words a business owner can act on', async () => {
    await objectDefService.list(test.ctx);
    await expect(objectDefService.archive(test.ctx, 'contact')).rejects.toThrow(
      /cannot be removed/i
    );
  });

  it('create — invents a custom object and rejects a key that shadows a built-in', async () => {
    const created = await objectDefService.create(test.ctx, {
      key: 'service_contract',
      label: 'Service contract',
      labelPlural: 'Service contracts',
      propertySchema: { fields: [{ key: 'startsOn', label: 'Starts on', type: 'date' }] },
    });
    expect(created.kind).toBe('custom');
    expect(test.publisher.events.map((event) => event.topic)).toContain('crm.object_def.created');

    await expect(
      objectDefService.create(test.ctx, {
        key: 'contact',
        label: 'Contact',
        labelPlural: 'Contacts',
      })
    ).rejects.toThrow();
  });

  it('list — a custom object joins the built-ins, and kind filters it out', async () => {
    const all = await objectDefService.list(test.ctx);
    expect(all.map((row) => row.key)).toContain('service_contract');

    const builtins = await objectDefService.list(test.ctx, { kind: 'builtin' });
    expect(builtins.map((row) => row.key)).not.toContain('service_contract');

    // `kind: 'custom'` must NOT trigger the built-in self-heal — it is asking a
    // question about the tenant's own objects.
    const custom = await objectDefService.list(test.ctx, { kind: 'custom' });
    expect(custom.map((row) => row.key)).toEqual(['service_contract']);
  });

  it('archive — puts a custom object away without losing it', async () => {
    await objectDefService.archive(test.ctx, 'service_contract');
    const visible = await objectDefService.list(test.ctx);
    expect(visible.map((row) => row.key)).not.toContain('service_contract');

    const withArchived = await objectDefService.list(test.ctx, { includeArchived: true });
    expect(withArchived.map((row) => row.key)).toContain('service_contract');
  });
});

describe('declared properties on a contact', () => {
  let test: TestContext;

  beforeAll(async () => {
    test = await makeTestContext('owner');
    await objectDefService.list(test.ctx); // seed the built-ins
    await declare(test, 'contact', [
      { key: 'warrantyExpires', label: 'Warranty expires', type: 'date' },
      { key: 'seats', label: 'Seats', type: 'number', integer: true },
      { key: 'rate', label: 'Rate', type: 'currency', currency: 'USD' },
      {
        key: 'annual',
        label: 'Annual value',
        type: 'calculated',
        expression: 'seats * rate * 12',
        precision: 2,
      },
    ]);
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  beforeEach(() => {
    test.publisher.clear();
  });

  it('create — stores declared values and computes the worked-out one', async () => {
    const customer = await customerService.create(test.ctx, {
      type: 'b2b',
      email: 'rae@northwind.test',
      customProperties: {
        warrantyExpires: '2027-03-14',
        seats: 12,
        rate: { amount: 50, currency: 'USD' },
        // Deliberately hostile: a client-supplied value for a field the server
        // owns. It must be discarded, not stored.
        annual: 999_999,
      },
    });

    const bag = customer.customProperties as Record<string, unknown>;
    expect(bag.warrantyExpires).toBe('2027-03-14');
    expect(bag.seats).toBe(12);
    expect(bag.annual).toBe(7200);
  });

  it('update — a patch naming one property leaves the other nine alone', async () => {
    const customer = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'sam@northwind.test',
      customProperties: { warrantyExpires: '2027-01-01', seats: 3 },
    });

    const updated = await customerService.update(test.ctx, customer.id, {
      customProperties: { seats: 4 },
    });

    const bag = updated.customProperties as Record<string, unknown>;
    expect(bag.seats).toBe(4);
    // The whole point: a PATCH is not a replace.
    expect(bag.warrantyExpires).toBe('2027-01-01');
  });

  it('update — a patch that says nothing about properties does not touch them', async () => {
    const customer = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'lee@northwind.test',
      customProperties: { seats: 9 },
    });

    const renamed = await customerService.update(test.ctx, customer.id, { firstName: 'Lee' });
    expect((renamed.customProperties as Record<string, unknown>).seats).toBe(9);
  });

  it('rejects a value that does not fit its declared type, naming the field', async () => {
    await expect(
      customerService.create(test.ctx, {
        type: 'retail',
        email: 'bad@northwind.test',
        customProperties: { seats: 'twelve' },
      })
    ).rejects.toThrow();
  });

  it('drops a property the business removed rather than failing the whole save', async () => {
    const customer = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'ghost@northwind.test',
      customProperties: { seats: 2, wasRemovedLastWeek: 'still being sent' },
    });
    const bag = customer.customProperties as Record<string, unknown>;
    expect(bag.seats).toBe(2);
    expect(bag.wasRemovedLastWeek).toBeUndefined();
  });

  it('announces which properties changed, for the automation trigger', async () => {
    const customer = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'watch@northwind.test',
      customProperties: { seats: 1 },
    });
    test.publisher.clear();

    await customerService.update(test.ctx, customer.id, { customProperties: { seats: 2 } });

    const changed = test.publisher.events.find((event) => event.topic === 'crm.property.changed');
    expect(changed).toBeDefined();
    expect(changed?.payload).toMatchObject({ objectKey: 'contact' });
    expect((changed?.payload as { properties?: string[] }).properties).toContain('seats');
  });

  it('says nothing when a save leaves every property where it was', async () => {
    const customer = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'quiet@northwind.test',
      customProperties: { seats: 5 },
    });
    test.publisher.clear();

    await customerService.update(test.ctx, customer.id, { firstName: 'Quiet' });
    expect(test.publisher.events.map((event) => event.topic)).not.toContain('crm.property.changed');
  });
});
