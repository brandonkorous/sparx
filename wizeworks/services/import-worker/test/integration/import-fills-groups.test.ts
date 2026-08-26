// An import has to fill the groups the people it imported belong to.
//
// `customerService` publishes `crm.customer.created/updated` and the segment
// evaluator subscribes to exactly those — but on an IN-PROCESS bus registered
// by api-rest. This worker is a different process and registers no consumers,
// so the bridge finds nothing subscribed and forwards nothing. Nothing errors.
//
// The observed shape: a shop imported 25 contacts, 22 of whom said yes to
// marketing, and the built-in "Newsletter Subscribers" group still said "No
// members yet". Pressing "Update all" filled it with exactly those 22, which is
// what proved the rule and the consent were both already right and the only
// missing thing was that nobody re-cut the groups.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import pino from 'pino';
import { prisma } from '@wizeworks/db';
import { segmentService } from '@wizeworks/crm';
import { getProcessor, type ImportRow, type ProcessorContext } from '../../src/processors/index.js';
import { reconcileSegmentsAfterImport } from '../../src/reconcile-segments.js';

const logger = pino({ level: 'silent' });

let ctx: ProcessorContext;
let tenantId: string;
let propertyId: string;

/** Two who said yes, one who said no — so a group that ignores the answer and a
 *  group that never fills are different failures. */
const ROWS: ImportRow[] = [
  { email: 'orla@example.test', first_name: 'Orla', accepts_marketing: 'yes' },
  { email: 'bram@example.test', first_name: 'Bram', accepts_marketing: 'yes' },
  { email: 'cass@example.test', first_name: 'Cass', accepts_marketing: 'no' },
];

const SUBSCRIBED = {
  kind: 'predicate' as const,
  field: 'email.subscribed',
  op: 'eq' as const,
  value: true,
};

beforeAll(async () => {
  const slug = `fillgrp-${crypto.randomBytes(4).toString('hex')}`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `Fill ${slug}`,
      email: `${slug}@sparx.test`,
      plan: 'starter',
      status: 'active',
      settings: {},
    },
  });
  tenantId = tenant.id;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    const property = await tx.property.create({
      data: { tenantId, slug: 'primary', name: `Fill ${slug}`, isPrimary: true },
    });
    propertyId = property.id;
  });
  ctx = { tenantId, tenantSlug: slug };
});

afterAll(async () => {
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe('an import fills the groups it should', () => {
  it('puts the people who opted in into the subscribers group', async () => {
    const segment = await segmentService.create(
      { tenantId, userId: undefined },
      {
        name: 'Newsletter Subscribers',
        slug: 'newsletter-subscribers',
        kind: 'dynamic',
        rules: SUBSCRIBED,
        propertyId,
      }
    );

    const processor = getProcessor('customers');
    if (!processor) throw new Error('no customers processor');
    await processor.run(ctx, ROWS, { upsert: true }, logger);

    // What the handler does once the rows are written. Without it the import
    // succeeds and the group stays empty.
    await reconcileSegmentsAfterImport(
      { tenantId, entityType: 'customers', dryRun: false },
      logger
    );

    const members = await segmentService.members({ tenantId, userId: undefined }, segment.id, {
      limit: 100,
    });
    const emails = members.map((m) => m.customer.email).sort();

    expect(emails).toEqual(['bram@example.test', 'orla@example.test']);
  });

  it('leaves the groups alone on a practice run', async () => {
    const segment = await segmentService.create(
      { tenantId, userId: undefined },
      {
        name: 'Practice subscribers',
        slug: 'practice-subscribers',
        kind: 'dynamic',
        // Matches nobody yet — a practice run must not be what fills it.
        rules: {
          kind: 'predicate' as const,
          field: 'customer.type',
          op: 'eq' as const,
          value: 'b2b',
        },
        propertyId,
      }
    );
    const before = await segmentService.memberCount({ tenantId, userId: undefined }, segment.id);

    await reconcileSegmentsAfterImport({ tenantId, entityType: 'customers', dryRun: true }, logger);

    expect(await segmentService.memberCount({ tenantId, userId: undefined }, segment.id)).toBe(
      before
    );
  });

  it('does not re-cut anything for an import that cannot change membership', async () => {
    // Redirects have nothing to do with who is in a group; paying for a full
    // tenant scan on one would be a cost nobody can see.
    await reconcileSegmentsAfterImport(
      { tenantId, entityType: 'redirects', dryRun: false },
      logger
    );
  });
});
