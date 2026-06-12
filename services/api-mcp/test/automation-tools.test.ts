// Automation MCP tools (docs/84 Slice H) — boots the real Fastify MCP app and
// drives the automation authoring tools over JSON-RPC, the same transport
// Claude / ChatGPT use. Proves:
//   • the tools are PUBLISHED and reachable on a tenant with ONLY the `ai`
//     module active (no `crm`/`commerce`) — automations are a platform
//     capability, not a gated module;
//   • the authoring lifecycle (create → list → get → set status) runs through
//     the shared service layer;
//   • the LOCKED tier is enforced through MCP exactly as through REST — a
//     platform-managed rule rejects update but can be cloned;
//   • per-tool scope still gates writes (a read-only key can't author).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@sparx/db';
import { invalidateModuleCache, issueApiKey } from '@sparx/auth';
import { upsertSystemAutomation } from '@sparx/automation';
import { createApp } from '../src/app.js';

interface TestTenant {
  tenantId: string;
  userId: string;
}

const EVENT_TRIGGER = { kind: 'event' as const, eventType: 'crm.customer.created' };
const STOP_ACTION = { type: 'platform.stop' as const, config: { reason: 'test' } };

// An `ai`-only tenant — NO crm/commerce/etc. If the automation tools work here,
// they're reachable purely on the platform `ai` gate (not any feature module).
async function createAiOnlyTenant(): Promise<TestTenant> {
  const slug = `mcp-auto-${crypto.randomBytes(4).toString('hex')}`;
  const email = `${slug}@sparx.test`;
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: `MCP ${slug}`,
      email,
      status: 'active',
      settings: { modules: { ai: { enabled: true } } },
    },
  });
  const user = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);
    return tx.user.create({
      data: { tenantId: tenant.id, email, name: `MCP ${slug}`, role: 'owner' },
    });
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
    url: '/v1/mcp',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    payload: body,
  });
  return { statusCode: res.statusCode, body: res.body };
}

/** Pull the tool's JSON result out of the SSE-framed JSON-RPC response. The SDK
 *  serializes a successful tool result as content[0].text = JSON.stringify(...),
 *  so we parse the data frame then the inner text. Throws if none parses (e.g.
 *  an error result, whose text is a plain message, not JSON). */
function parseToolResult(body: string): unknown {
  const frames = body
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice('data:'.length).trim());
  for (const frame of frames) {
    try {
      const env = JSON.parse(frame) as {
        result?: { content?: { text?: string }[] };
      };
      const text = env.result?.content?.[0]?.text;
      if (typeof text === 'string') return JSON.parse(text);
    } catch {
      // non-JSON / partial frame — keep scanning
    }
  }
  throw new Error(`no parseable tool result in body: ${body}`);
}

describe('automation MCP tools', () => {
  let app: FastifyInstance;
  let tenant: TestTenant;
  let token: string;

  beforeAll(async () => {
    process.env.SPARX_INTERNAL_JWT_SECRET ??= 'a'.repeat(40);
    process.env.DATABASE_URL ??= 'postgres://sparx:sparx@localhost:5432/sparx';
    app = await createApp();
    tenant = await createAiOnlyTenant();
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

  it('publishes the automation tools (reachable on an ai-only tenant)', async () => {
    const list = await postMcp(app, token, jsonRpc('tools/list', {}, 2));
    expect(list.statusCode).toBeLessThan(400);
    expect(list.body).toContain('list_automations');
    expect(list.body).toContain('create_automation');
    expect(list.body).toContain('set_automation_status');
    expect(list.body).toContain('clone_automation');
    expect(list.body).toContain('get_automation_runs');
  });

  it('runs the authoring lifecycle: create → list → get → status → runs', async () => {
    const created = await postMcp(
      app,
      token,
      jsonRpc(
        'tools/call',
        {
          name: 'create_automation',
          arguments: {
            name: 'Greet new customers',
            trigger: EVENT_TRIGGER,
            actions: [STOP_ACTION],
          },
        },
        10
      )
    );
    expect(created.statusCode).toBeLessThan(400);
    const automation = parseToolResult(created.body) as {
      id: string;
      origin: string;
      status: string;
      locked: boolean;
    };
    expect(automation).toMatchObject({ origin: 'user', status: 'draft', locked: false });

    // appears in the list
    const listed = await postMcp(
      app,
      token,
      jsonRpc('tools/call', { name: 'list_automations', arguments: {} }, 11)
    );
    const rows = parseToolResult(listed.body) as { id: string }[];
    expect(rows.map((r) => r.id)).toContain(automation.id);

    // fetch one
    const got = await postMcp(
      app,
      token,
      jsonRpc(
        'tools/call',
        { name: 'get_automation', arguments: { automationId: automation.id } },
        12
      )
    );
    expect((parseToolResult(got.body) as { id: string }).id).toBe(automation.id);

    // activate
    const activated = await postMcp(
      app,
      token,
      jsonRpc(
        'tools/call',
        {
          name: 'set_automation_status',
          arguments: { automationId: automation.id, status: 'active' },
        },
        13
      )
    );
    expect((parseToolResult(activated.body) as { status: string }).status).toBe('active');

    // run history is empty (the automation just fired never)
    const runs = await postMcp(
      app,
      token,
      jsonRpc(
        'tools/call',
        { name: 'get_automation_runs', arguments: { automationId: automation.id } },
        14
      )
    );
    expect(parseToolResult(runs.body)).toEqual([]);
  });

  it('clones a locked system automation but cannot update it (AUTOMATION_LOCKED)', async () => {
    const locked = await upsertSystemAutomation(
      { tenantId: tenant.tenantId },
      {
        name: 'Locked system rule (mcp)',
        trigger: EVENT_TRIGGER,
        conditions: { logic: 'AND', conditions: [] },
        actions: [STOP_ACTION],
        locked: true,
        status: 'active',
      }
    );

    // update → error result mentioning the platform-managed lock
    const edit = await postMcp(
      app,
      token,
      jsonRpc(
        'tools/call',
        { name: 'update_automation', arguments: { automationId: locked.id, name: 'hijack' } },
        20
      )
    );
    expect(edit.body).toContain('platform-managed');

    // clone → a fresh user-origin editable copy
    const clone = await postMcp(
      app,
      token,
      jsonRpc(
        'tools/call',
        { name: 'clone_automation', arguments: { automationId: locked.id, name: 'My copy' } },
        21
      )
    );
    expect(parseToolResult(clone.body)).toMatchObject({
      name: 'My copy',
      origin: 'user',
      locked: false,
      clonedFrom: locked.id,
    });
  });

  it('enforces scope — a read-only key reads but cannot author', async () => {
    const issued = await issueApiKey({
      tenantId: tenant.tenantId,
      name: 'read-only automations key',
      scopes: ['read:automations'],
      createdByUserId: tenant.userId,
    });

    // read works
    const ok = await postMcp(
      app,
      issued.plaintext,
      jsonRpc('tools/call', { name: 'list_automations', arguments: {} }, 30)
    );
    expect(ok.statusCode).toBeLessThan(400);
    expect(Array.isArray(parseToolResult(ok.body))).toBe(true);

    // write is denied — the forbidden message names the missing scope
    const denied = await postMcp(
      app,
      issued.plaintext,
      jsonRpc(
        'tools/call',
        {
          name: 'create_automation',
          arguments: { name: 'nope', trigger: EVENT_TRIGGER, actions: [STOP_ACTION] },
        },
        31
      )
    );
    expect(denied.body.toLowerCase()).toContain('scope');
    expect(denied.body).toContain('write:automations');
  });
});
