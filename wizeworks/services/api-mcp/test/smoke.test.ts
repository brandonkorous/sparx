// MCP server smoke — boots the Fastify app, lists tools via JSON-RPC, then
// dispatches a read-only tool (get_customers) against a fresh tenant. Proves
// auth + scope + tool dispatch + audit-log all wire together.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@wizeworks/db';
import { invalidateModuleCache, issueApiKey, revokeApiKey } from '@wizeworks/auth';
import { createApp } from '../src/app.js';

interface TestTenant {
  tenantId: string;
  userId: string;
}

async function createCrmTenant(): Promise<TestTenant> {
  const slug = `mcp-${crypto.randomBytes(4).toString('hex')}`;
  const email = `${slug}@sparx.test`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `MCP ${slug}`,
      email,
      status: 'active',
      // `ai` gates MCP access (module-based, not a plan); `crm` enables the
      // crm tools the smoke test dispatches.
      settings: { modules: { ai: { enabled: true }, crm: { enabled: true } } },
    },
  });
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);
    await tx.user.create({
      data: { tenantId: tenant.id, email, name: `MCP ${slug}`, role: 'owner' },
    });
  });
  const user = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);
    return tx.user.findFirstOrThrow({ where: { tenantId: tenant.id, email } });
  });
  return { tenantId: tenant.id, userId: user.id };
}

function jsonRpc(method: string, params: object, id = 1): Record<string, unknown> {
  return { jsonrpc: '2.0', id, method, params };
}

async function postMcp(
  app: FastifyInstance,
  token: string,
  body: Record<string, unknown>
): Promise<{ statusCode: number; body: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      // Streamable HTTP requires the client to advertise it can take either
      // a JSON body or an SSE stream back.
      accept: 'application/json, text/event-stream',
    },
    payload: body,
  });
  return { statusCode: res.statusCode, body: res.body };
}

describe('mcp-server smoke', () => {
  let app: FastifyInstance;
  let tenant: TestTenant;
  let token: string;

  beforeAll(async () => {
    process.env.SPARX_INTERNAL_JWT_SECRET ??= 'a'.repeat(40);
    process.env.DATABASE_URL ??= 'postgres://sparx:sparx@localhost:5432/sparx';
    app = await createApp();
    tenant = await createCrmTenant();
    token = app.jwt.sign(
      { sub: tenant.userId, tid: tenant.tenantId, role: 'owner' },
      { expiresIn: '5m' }
    );
    invalidateModuleCache();
  });

  afterAll(async () => {
    await app.close();
    await prisma.tenant.delete({ where: { id: tenant.tenantId } });
  });

  it('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('POST /mcp without auth returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: jsonRpc('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' },
      }),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('POST /v1 (deprecated alias) still reaches the MCP handler — 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: jsonRpc('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' },
      }),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('an unknown path returns a helpful JSON 404 naming /mcp', async () => {
    const res = await app.inject({ method: 'POST', url: '/wrong-path' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('/mcp');
  });

  it('accepts an external API key and rejects after revocation', async () => {
    const issued = await issueApiKey({
      tenantId: tenant.tenantId,
      name: 'smoke-test key',
      scopes: ['read:crm'],
      createdByUserId: tenant.userId,
    });

    // 1. live key + read:crm scope → tool call succeeds (200, empty result)
    const call = await postMcp(
      app,
      issued.plaintext,
      jsonRpc('tools/call', { name: 'get_customers', arguments: {} }, 11)
    );
    expect(call.statusCode).toBeLessThan(400);
    expect(call.body).toContain('\\"items\\":[]');

    // 2. revoke → next call is rejected with UNAUTHORIZED
    await revokeApiKey(tenant.tenantId, issued.id);
    const after = await postMcp(
      app,
      issued.plaintext,
      jsonRpc('tools/call', { name: 'get_customers', arguments: {} }, 12)
    );
    expect(after.statusCode).toBe(401);
    expect(JSON.parse(after.body).error.code).toBe('UNAUTHORIZED');
  });

  // docs/131 §3.2 — a key issued from one of the tenant's businesses must not
  // read another's. Before `property_id`, "issued from Bob's Parts" was a label
  // on a credential that reached the whole account.
  it('refuses a site-scoped key on a tool that cannot honour the restriction', async () => {
    const site = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.tenantId}'`);
      return tx.property.create({
        data: {
          tenantId: tenant.tenantId,
          slug: `donuts-${crypto.randomBytes(3).toString('hex')}`,
          name: 'Savory Donuts',
        },
        select: { id: true },
      });
    });

    const issued = await issueApiKey({
      tenantId: tenant.tenantId,
      name: 'donut-shop key',
      scopes: ['read:crm'],
      propertyId: site.id,
      createdByUserId: tenant.userId,
    });

    // get_customers reads tenant-wide — it has no way to honour the ceiling, so
    // it must be REFUSED rather than quietly return both businesses' customers.
    // The identical call with a tenant-wide key succeeds in the test above,
    // which is what makes this assertion about scoping rather than plumbing.
    const res = await postMcp(
      app,
      issued.plaintext,
      jsonRpc('tools/call', { name: 'get_customers', arguments: {} }, 31)
    );
    expect(res.statusCode).toBeLessThan(400);
    expect(res.body).toContain('limited to a single site');
    expect(res.body).toContain('get_customers');
  });

  it('rejects an API key whose scopes do not cover the requested tool', async () => {
    // No scopes at all → even a read tool is denied with FORBIDDEN.
    const issued = await issueApiKey({
      tenantId: tenant.tenantId,
      name: 'no-scope key',
      scopes: [],
      createdByUserId: tenant.userId,
    });
    const res = await postMcp(
      app,
      issued.plaintext,
      jsonRpc('tools/call', { name: 'get_customers', arguments: {} }, 21)
    );
    // SDK lifts tool-handler throws into the JSON-RPC error envelope; the
    // HTTP status stays 200 but the body contains the forbidden message.
    expect(res.statusCode).toBeLessThan(500);
    expect(res.body.toLowerCase()).toContain('scope');
    await revokeApiKey(tenant.tenantId, issued.id);
  });

  it('lists tools then dispatches get_customers', async () => {
    const init = await postMcp(
      app,
      token,
      jsonRpc('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' },
      })
    );
    expect(init.statusCode).toBeLessThan(400);

    const list = await postMcp(app, token, jsonRpc('tools/list', {}, 2));
    expect(list.statusCode).toBeLessThan(400);
    // SDK responses are SSE-framed; tool names should be in there.
    expect(list.body).toContain('get_customers');
    expect(list.body).toContain('get_pipeline');

    const call = await postMcp(
      app,
      token,
      jsonRpc('tools/call', { name: 'get_customers', arguments: {} }, 3)
    );
    expect(call.statusCode).toBeLessThan(400);
    // Empty tenant — the tool returns { items: [], total: 0 } serialized
    // inside a JSON-string content block, so quotes are escaped twice.
    expect(call.body).toContain('\\"items\\":[]');
    expect(call.body).toContain('\\"total\\":0');
  });
});
