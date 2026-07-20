// Newsletter subscribe → marketing-segment membership (docs/51 §7).
//
// End-to-end for the storefront "Email signup" capture: customerService.subscribe
// upserts a consenting prospect AND drives the in-process segment evaluator so the
// subscriber lands in the built-in "Newsletter Subscribers" segment — which is how
// an email broadcast resolves its recipients. Covers: fresh capture, idempotent
// re-subscribe (no duplicate member), and that the evaluator drops a do-not-contact
// contact when it re-evaluates (membership tracks consent state).

import crypto from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { withTenant } from '@sparx/db';
import { NEWSLETTER_SEGMENT_SLUG } from '@sparx/crm-schemas/builtins';
import {
  customerService,
  registerCrmConsumers,
  resetDedupeForTesting,
  resetPlatformBusForTesting,
  type PlatformEventBus,
} from '../../src/index.js';
import { createTestTenant, dropTestTenant, type TestTenant } from '../helpers.js';

describe('newsletter subscribe → segment membership', () => {
  let bus: PlatformEventBus;
  let teardown: () => void;
  let tenant: TestTenant;
  let ctx: { tenantId: string; userId: string };

  beforeAll(async () => {
    bus = resetPlatformBusForTesting();
    resetDedupeForTesting();
    const registration = registerCrmConsumers({ bus });
    teardown = () => registration.unregister();

    tenant = await createTestTenant('owner');
    ctx = { tenantId: tenant.tenantId, userId: tenant.userId };
  });

  afterAll(async () => {
    teardown();
    await dropTestTenant(tenant.tenantId);
  });

  beforeEach(() => {
    resetDedupeForTesting();
  });

  /** The customer's membership rows in the newsletter segment. */
  async function newsletterMembers(email: string): Promise<string[]> {
    return withTenant(ctx, async (tx) => {
      // Built-in segments are tenant-wide (property_id null); the unique is now
      // (tenant, property, slug), so findFirst on the null-property row.
      const segment = await tx.segment.findFirst({
        where: { propertyId: null, slug: NEWSLETTER_SEGMENT_SLUG },
      });
      if (!segment) return [];
      const members = await tx.segmentMember.findMany({
        where: { segmentId: segment.id, customer: { email } },
        select: { customerId: true },
      });
      return members.map((m) => m.customerId);
    });
  }

  it('captures a consenting prospect and adds them to the newsletter segment', async () => {
    const email = 'newsub@example.test';
    const { customer, created } = await customerService.subscribe(ctx, { email, source: 'signup' });
    await bus.drain();

    expect(created).toBe(true);
    expect(customer.type).toBe('prospect');
    expect(customer.doNotContact).toBe(false);
    expect((customer.gdprConsent as { scope?: string[] }).scope).toContain('marketing');

    // The built-in segment was ensured + the evaluator materialized membership.
    expect(await newsletterMembers(email)).toHaveLength(1);
  });

  it('re-subscribe is idempotent — no duplicate customer or membership', async () => {
    const email = 'repeat@example.test';
    const first = await customerService.subscribe(ctx, { email, source: 'signup' });
    await bus.drain();
    const second = await customerService.subscribe(ctx, { email, source: 'signup' });
    await bus.drain();

    expect(first.customer.id).toBe(second.customer.id);
    expect(second.created).toBe(false);

    const customers = await withTenant(ctx, (tx) => tx.customer.findMany({ where: { email } }));
    expect(customers).toHaveLength(1);
    expect(await newsletterMembers(email)).toHaveLength(1);
  });

  it('unsubscribe removes the contact from the marketing segment (real path)', async () => {
    const email = 'optout@example.test';
    const { customer } = await customerService.subscribe(ctx, { email, source: 'signup' });
    await bus.drain();
    expect(await newsletterMembers(email)).toHaveLength(1);

    // The production unsubscribe chain: an `email.unsubscribed` platform event
    // (what the Mailgun webhook publishes) → the email-events consumer flips
    // do_not_contact AND emits crm.customer.updated → the platform-bus fan-out
    // delivers that to the evaluator → it drops the now-ineligible member.
    await bus.publish({
      id: crypto.randomUUID(),
      topic: 'email.unsubscribed',
      tenantId: ctx.tenantId,
      occurredAt: new Date(),
      payload: { customerId: customer.id, email, messageId: 'mailgun-msg-1' },
    });
    await bus.drain();

    const updated = await customerService.get(ctx, customer.id);
    expect(updated.doNotContact).toBe(true);
    expect(await newsletterMembers(email)).toHaveLength(0);
  });
});
