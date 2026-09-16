// The two ways a return ENDS must reach the shopper.
//
// A return finishes by refunding, by swapping, or by being turned down, and only
// the refund used to send anything. The silence was not one missing piece but a
// chain of them, and the LAST link is the one this file guards: without a
// registered resolver, `resolveFields` returns an EMPTY map, so a seed guarded on
// `customer.email is_set` can never match — and a non-matching automation writes
// no run and no error. An owner who built the rule by hand would have watched it
// sit "active" with 0 runs forever (persona issue 448).
//
// So this asserts through the real engine, not the seed list: given an event, the
// resolver must produce the address the send is guarded on, plus the fact the
// email exists to carry — the replacement that went out, or the reason for the no.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { handleTrigger, installBuiltins, type TriggerEnvelope } from '../../src';
import { resolveFields } from '../../src/resolvers/registry';
import { withTenant } from '@wizeworks/db';
import {
  createTenant,
  dropTenant,
  makeDeps,
  ownerDb,
  runsFor,
  seedCustomer,
  seedProperty,
} from '../helpers';
import {
  createAutomation,
  setAutomationStatus,
  type ServiceCtx,
} from '../../src/service/automation-service';

const deps = makeDeps();

let tenantId: string;
let propertyId: string;
let customerId: string;
let orderId: string;
let returnId: string;
const ctx = (): ServiceCtx => ({ tenantId });

beforeAll(async () => {
  installBuiltins();
  tenantId = await createTenant();
  propertyId = await seedProperty(tenantId, 'Juniper Row');
  customerId = await seedCustomer(tenantId, { propertyId, email: 'jo.kim@sparx.test' });

  const order = await ownerDb.order.create({
    data: {
      tenantId,
      propertyId,
      customerId,
      orderNumber: `O-${crypto.randomBytes(3).toString('hex')}`,
      status: 'fulfilled',
      placedAt: new Date(),
      currency: 'USD',
      subtotal: 128,
      total: 128,
    },
    select: { id: true },
  });
  orderId = order.id;

  const ret = await ownerDb.returnRequest.create({
    data: {
      tenantId,
      orderId,
      requestedBy: 'customer',
      status: 'received',
      preferredOutcome: 'exchange',
    },
    select: { id: true },
  });
  returnId = ret.id;
});

afterAll(async () => {
  await dropTenant(tenantId);
});

const envelope = (type: string, data: Record<string, unknown>): TriggerEnvelope => ({
  type,
  tenantId,
  actorId: null,
  occurredAt: new Date().toISOString(),
  data,
});

describe('return endings reach the shopper', () => {
  it('resolves the address a swap notice is guarded on', async () => {
    const fields = await withTenant({ tenantId }, (tx) =>
      resolveFields({ tenantId, tx, deps, causeDepth: 0 }, 'return.exchanged', {
        returnId,
        replacementLabel: 'Marlow Knit: Oat · L',
        quantity: 1,
      })
    );
    // The whole point: an unregistered event yields {} and the guard can never
    // pass. This is the field the send is addressed to AND guarded on.
    expect(fields['customer.email']).toBe('jo.kim@sparx.test');
    expect(fields['return.id']).toBe(returnId);
  });

  it('carries WHAT went out, which the return row cannot say', async () => {
    const fields = await withTenant({ tenantId }, (tx) =>
      resolveFields({ tenantId, tx, deps, causeDepth: 0 }, 'return.exchanged', {
        returnId,
        replacementLabel: 'Marlow Knit: Oat · L',
        quantity: 1,
      })
    );
    // A return has no column for its replacement, so an email that named it from
    // the row alone would name nothing.
    expect(fields['return.replacement']).toBe('Marlow Knit: Oat · L');
  });

  it('carries the reason a return was turned down', async () => {
    const fields = await withTenant({ tenantId }, (tx) =>
      resolveFields({ tenantId, tx, deps, causeDepth: 0 }, 'return.denied', {
        returnId,
        reason: 'It came back outside the 30-day window.',
      })
    );
    expect(fields['customer.email']).toBe('jo.kim@sparx.test');
    expect(fields['return.deniedReason']).toBe('It came back outside the 30-day window.');
  });

  it('leaves an absent fact EMPTY rather than missing, so its row self-drops', async () => {
    // A bound row with an empty value drops out of the email; a MISSING key
    // renders the raw `{{…}}` token in front of a customer.
    const fields = await withTenant({ tenantId }, (tx) =>
      resolveFields({ tenantId, tx, deps, causeDepth: 0 }, 'return.exchanged', { returnId })
    );
    expect(fields['return.replacement']).toBe('');
    expect(fields['return.deniedReason']).toBe('');
  });

  it('actually RUNS an automation on a swap, end to end', async () => {
    const automation = await createAutomation(ctx(), {
      name: 'Replacement sent: email',
      trigger: { kind: 'event', eventType: 'return.exchanged' },
      conditions: { logic: 'AND', conditions: [{ field: 'customer.email', operator: 'is_set' }] },
      actions: [{ type: 'platform.stop', config: {} }],
    });
    // Created as a draft, like every automation; switching it on is its own act.
    await setAutomationStatus(ctx(), automation.id, 'active');
    await handleTrigger(
      envelope('return.exchanged', { returnId, replacementLabel: 'Marlow Knit: Oat · L' }),
      deps
    );
    const runs = await runsFor(automation.id);
    // Before the resolver existed this was ZERO, silently: no match, no run, no
    // error, and an owner with no way to tell the rule from a broken one.
    expect(runs.length).toBe(1);
  });
});
