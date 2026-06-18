// Inventory MCP tools (docs/100 P6c). A pure-registry section proves the tool
// names are globally unique (a duplicate makes the SDK throw at registration →
// the server can't boot) and that the supply tools moved out of commerce now
// carry inventory scopes. An integration section proves the `inventory` module
// gate (MODULE_BY_SCOPE) + scope enforcement end-to-end.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@sparx/db';
import { invalidateModuleCache, issueApiKey } from '@sparx/auth';
import { createApp } from '../src/app.js';
import { ALL_MCP_TOOLS } from '../src/tool-registry.js';

const INVENTORY_READ = ['get_low_inventory', 'get_inventory_valuation', 'suggest_reorders'];
const INVENTORY_WRITE = ['update_inventory', 'create_purchase_order', 'receive_stock'];

describe('inventory MCP registry', () => {
  it('has globally unique tool names', () => {
    const names = ALL_MCP_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('exposes the inventory supply tools with inventory scopes', () => {
    const byName = new Map(ALL_MCP_TOOLS.map((t) => [t.name, t]));
    for (const name of INVENTORY_READ) {
      expect(byName.get(name)?.scope).toBe('read:inventory');
    }
    for (const name of INVENTORY_WRITE) {
      expect(byName.get(name)?.scope).toBe('write:inventory');
      expect(byName.get(name)?.confirmation).toBe(true);
    }
  });

  it('no longer carries the inventory tools under commerce scope', () => {
    const commerceScoped = ALL_MCP_TOOLS.filter((t) => t.scope === 'read:commerce').map(
      (t) => t.name
    );
    expect(commerceScoped).not.toContain('get_low_inventory');
    expect(commerceScoped).not.toContain('get_inventory_valuation');
  });
});

interface McpTenant {
  tenantId: string;
  userId: string;
}

async function createTenant(inventoryEnabled: boolean): Promise<McpTenant> {
  const slug = `mcpinv-${crypto.randomBytes(4).toString('hex')}`;
  const email = `${slug}@sparx.test`;
  const modules: Record<string, { enabled: boolean }> = { ai: { enabled: true } };
  if (inventoryEnabled) modules.inventory = { enabled: true };
  const tenant = await prisma.tenant.create({
    data: { slug, name: `MCP ${slug}`, email, status: 'active', settings: { modules } },
  });
  const userId = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);
    const u = await tx.user.create({
      data: { tenantId: tenant.id, email, name: `MCP ${slug}`, role: 'owner' },
    });
    return u.id;
  });
  return { tenantId: tenant.id, userId };
}

function jsonRpc(method: string, params: object, id = 1): Record<string, unknown> {
  return { jsonrpc: '2.0', id, method, params };
}

async function callTool(
  app: FastifyInstance,
  token: string,
  name: string
): Promise<{ statusCode: number; body: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    payload: jsonRpc('tools/call', { name, arguments: {} }, 7),
  });
  return { statusCode: res.statusCode, body: res.body };
}

describe('inventory MCP dispatch + module gate', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.SPARX_INTERNAL_JWT_SECRET ??= 'a'.repeat(40);
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('dispatches get_low_inventory when inventory is active + scope granted', async () => {
    const t = await createTenant(true);
    invalidateModuleCache();
    try {
      const key = await issueApiKey({
        tenantId: t.tenantId,
        name: 'inv key',
        scopes: ['read:inventory'],
        createdByUserId: t.userId,
      });
      const res = await callTool(app, key.plaintext, 'get_low_inventory');
      expect(res.statusCode).toBeLessThan(400);
      // Empty tenant → an empty array serialized in the content block.
      expect(res.body).toContain('[]');
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });

  it('refuses inventory tools when the module is off', async () => {
    const t = await createTenant(false);
    invalidateModuleCache();
    try {
      const key = await issueApiKey({
        tenantId: t.tenantId,
        name: 'inv key',
        scopes: ['read:inventory'],
        createdByUserId: t.userId,
      });
      const res = await callTool(app, key.plaintext, 'get_low_inventory');
      expect(res.statusCode).toBeLessThan(500);
      expect(res.body.toLowerCase()).toContain('inventory module is not active');
    } finally {
      await prisma.tenant.delete({ where: { id: t.tenantId } });
    }
  });
});
