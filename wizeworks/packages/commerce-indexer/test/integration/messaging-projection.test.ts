// "NOTHING IN YOUR RECORDS MATCHES" ABOUT A RECORD THAT IS ON SCREEN.
//
// Typing "welcome" into the console's search box, with **Welcome series** open in
// the pane behind it, answered:
//
//   "Nothing in your records matches “welcome”. Everything below is a screen."
//
// Campaigns, automatic emails and rules had no projector, so the record half of
// the search had never been able to see any of them. 16 campaigns, 15 sequences
// and 2,411 rules on this platform, measured 2026-09-18, and not one of them
// findable from the box that offers to find things.
//
// These run against real Postgres: they build the documents the indexer would
// send, from rows written through the same Prisma client the projectors use.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { prisma, withTenant } from '@wizeworks/db';
import { messagingUniversalProjectors } from '../../src/messaging-projection.js';
import type { UniversalSearchDocument } from '@wizeworks/search';

const byType = new Map(messagingUniversalProjectors.map((p) => [p.entityType, p]));

let tenantId = '';

async function project(entityType: string, id: string): Promise<UniversalSearchDocument | null> {
  const projector = byType.get(entityType);
  if (!projector) throw new Error(`no projector for ${entityType}`);
  return projector.project({ tenantId }, id);
}

async function listIds(entityType: string): Promise<string[]> {
  const projector = byType.get(entityType);
  if (!projector) throw new Error(`no projector for ${entityType}`);
  return projector.listIdsForTenant({ tenantId });
}

describe('making the messages app findable', () => {
  let sequenceId = '';
  let broadcastId = '';
  let automationId = '';

  beforeAll(async () => {
    const slug = `idx-${crypto.randomBytes(4).toString('hex')}`;
    const tenant = await prisma.tenant.create({
      data: {
        slug,
        name: `Index ${slug}`,
        email: `${slug}@sparx.test`,
        plan: 'starter',
        status: 'active',
        settings: {},
      },
    });
    tenantId = tenant.id;

    await withTenant({ tenantId }, async (tx) => {
      const sequence = await tx.emailSequence.create({
        data: {
          tenantId,
          name: 'Welcome series',
          description: 'Greets a new customer on day 0 and follows up on day 3.',
          status: 'draft',
          steps: [],
        },
        select: { id: true },
      });
      sequenceId = sequence.id;

      const broadcast = await tx.broadcast.create({
        data: {
          tenantId,
          name: 'Autumn drop announcement',
          subject: 'The last of the linen',
          preheader: 'Five pieces, and then they are gone',
          campaignTag: 'autumn-2026',
          status: 'sent',
        },
        select: { id: true },
      });
      broadcastId = broadcast.id;

      const automation = await tx.automation.create({
        data: {
          tenantId,
          name: 'Greet a new customer',
          description: 'Starts the welcome series when somebody first orders.',
          status: 'active',
          triggerType: 'customer.created',
          triggerConfig: {},
          conditions: {},
          actions: [],
        },
        select: { id: true },
      });
      automationId = automation.id;
    });
  });

  afterAll(async () => {
    if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('finds the sequence by the name she gave it', async () => {
    const doc = await project('email_sequence', sequenceId);
    expect(doc).toMatchObject({
      entity_type: 'email_sequence',
      module: 'email',
      title: 'Welcome series',
      status: 'draft',
      url: `/email/sequences/${sequenceId}`,
    });
  });

  it('carries a campaign under BOTH names, because she may remember either', async () => {
    // What she called it and what the customer read in their inbox are different
    // sentences, and only one of them is the title.
    const doc = await project('email_broadcast', broadcastId);
    expect(doc?.title).toBe('Autumn drop announcement');
    expect(doc?.subtitle).toBe('The last of the linen');
    expect(doc?.keywords).toContain('The last of the linen');
    expect(doc?.status).toBe('sent');
  });

  it('carries a rule, and its trigger as a keyword rather than as prose', async () => {
    const doc = await project('automation', automationId);
    expect(doc?.title).toBe('Greet a new customer');
    // `customer.created` is machine vocabulary. It should MATCH without being
    // read back at her, so it is a keyword and never the subtitle.
    expect(doc?.keywords).toContain('customer.created');
    expect(doc?.subtitle).not.toContain('customer.created');
  });

  it('gives every hit an address that opens the record', async () => {
    const docs = await Promise.all([
      project('email_sequence', sequenceId),
      project('email_broadcast', broadcastId),
      project('automation', automationId),
    ]);
    for (const doc of docs) {
      expect(doc?.url).toMatch(/^\/[\w/-]+\/[0-9a-f-]{36}$/);
      expect(doc?.tenant_id).toBe(tenantId);
      expect(doc?.id).toBe(`${tenantId}:${doc?.entity_type ?? ''}:${doc?.record_id ?? ''}`);
    }
  });

  it('answers null for a record that is gone, so the indexer removes it', async () => {
    // The indexer deletes on a null projection, which is what makes a deleted
    // record stop being findable without a separate delete path.
    await withTenant({ tenantId }, (tx) => tx.emailSequence.delete({ where: { id: sequenceId } }));
    expect(await project('email_sequence', sequenceId)).toBeNull();
  });

  it('enumerates every record for a reindex, not just the recent ones', async () => {
    expect(await listIds('email_broadcast')).toContain(broadcastId);
    expect(await listIds('automation')).toContain(automationId);
  });
});
