// A free marketing tool's email capture counts on a campaign.
//
// Both marketing sites (sparx.works, meetpiggles.com) run seventeen free tools
// with an "email me my results" card. Every one of those leads landed in CRM and
// was INVISIBLE to the funnels module — so the easiest capture we own was the
// one nothing measured. `POST /v1/public/tools/deliver` now records a funnel
// stage too, matched the same way a builder form is.
//
// The join is `entryFormNodeId`. A marketing tool is a hand-built Next.js page
// with no builder node to name, so it declares itself as `tool:<slug>` — see
// `toolCaptureNodeId`. These tests pin that string, because it is a contract
// between this route and whoever sets up the campaign: change it silently and
// every campaign pointed at a tool stops counting, with nothing on screen
// saying so.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma, withTenant } from '@wizeworks/db';
import { createApp } from '../../src/app.js';
import { createTestTenant, dropTestTenant, type TestTenant } from '../helpers.js';

const LADDER = [
  { key: 'used_the_tool', name: 'Used the tool', kind: 'capture' },
  { key: 'became_a_customer', name: 'Became a customer', kind: 'convert' },
];

async function makeFunnel(
  fixture: TestTenant,
  entryFormNodeId: string | null,
  status: 'active' | 'draft'
): Promise<string> {
  // `funnels` is FORCE RLS, so even the fixture writes through withTenant —
  // a bare create is refused, which is the policy doing its job.
  const funnel = await withTenant({ tenantId: fixture.tenantId }, (tx) =>
    tx.funnel.create({
      data: {
        tenantId: fixture.tenantId,
        propertyId: fixture.propertyId,
        name: `Tool campaign ${entryFormNodeId ?? 'none'} ${status}`,
        kind: 'lead',
        status,
        stages: LADDER,
        ...(entryFormNodeId ? { entryFormNodeId } : {}),
      },
      select: { id: true },
    })
  );
  return funnel.id;
}

async function stageCount(funnelId: string, tenantId: string): Promise<number> {
  return withTenant({ tenantId }, (tx) => tx.funnelStageEvent.count({ where: { funnelId } }));
}

function deliver(app: FastifyInstance, slug: string, toolSlug: string, email: string) {
  return app.inject({
    method: 'POST',
    url: `/v1/public/tools/deliver?tenant=${slug}`,
    payload: {
      email,
      toolSlug,
      lines: [{ label: 'Margin', value: '42%' }],
    },
  });
}

describe('POST /v1/public/tools/deliver — a free tool feeds a campaign', () => {
  let app: FastifyInstance;
  let fixture: TestTenant;
  let slug: string;

  beforeAll(async () => {
    app = await createApp();
    fixture = await createTestTenant('owner');
    const t = await prisma.tenant.findUniqueOrThrow({
      where: { id: fixture.tenantId },
      select: { slug: true },
    });
    slug = t.slug;
  });

  afterAll(async () => {
    await dropTestTenant(fixture.tenantId);
    await app.close();
  });

  it('records a stage on the campaign that names the tool', async () => {
    const funnelId = await makeFunnel(fixture, 'tool:margin-calculator', 'active');

    const res = await deliver(app, slug, 'margin-calculator', 'margin@example.com');

    expect(res.statusCode).toBe(200);
    expect(await stageCount(funnelId, fixture.tenantId)).toBe(1);
  });

  it('leaves a campaign naming a DIFFERENT tool alone', async () => {
    // The bug this stops is one campaign swallowing every tool's leads, which
    // would read as one wildly successful campaign and sixteen dead ones.
    const funnelId = await makeFunnel(fixture, 'tool:qr-code', 'active');

    const res = await deliver(app, slug, 'utm-builder', 'utm@example.com');

    expect(res.statusCode).toBe(200);
    expect(await stageCount(funnelId, fixture.tenantId)).toBe(0);
  });

  it('does not count anybody for a DRAFT campaign', async () => {
    // The same rule the console states out loud — a draft counts nobody — held
    // at the write, not just in the surface that says it.
    const funnelId = await makeFunnel(fixture, 'tool:favicon', 'draft');

    const res = await deliver(app, slug, 'favicon', 'favicon@example.com');

    expect(res.statusCode).toBe(200);
    expect(await stageCount(funnelId, fixture.tenantId)).toBe(0);
  });

  it('still delivers the results when no campaign is watching', async () => {
    // The send is what the visitor asked for and the campaign is our reporting
    // nicety, so the absence of a funnel must be completely uneventful.
    const res = await deliver(app, slug, 'invoice', 'nobody-watching@example.com');

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true });
  });

  it('refuses a tool it does not know, before any of this runs', async () => {
    const res = await deliver(app, slug, 'not-a-real-tool', 'nope@example.com');

    // 422, not 400: this API answers a schema refusal with Unprocessable.
    expect(res.statusCode).toBe(422);
  });
});
