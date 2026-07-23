// Legal-page MCP tools (docs/42 §3) — an agent's window into the tenant's legal docs.
//
// Until these existed, an agent building a site was blind to legal: it couldn't tell
// that the footer's Privacy/Terms links resolve to real, tenant-approved pages (or that
// they're still missing), so it had no basis for wiring — or trusting — a footer's legal
// links. `get_legal_checklist` shares that state; `create_legal_page` scaffolds a missing
// one from the platform starter template as a DRAFT.
//
// Approval stays human: an agent may draft, but the tenant reviews the starter text,
// acknowledges the disclaimer, and publishes from the workbench (Content → Legal pages).
// There is deliberately no MCP tool to acknowledge or publish a legal page.

import { z } from 'zod';
import { publish } from '@sparx/api-core/pubsub';
import { LEGAL_KINDS, type LegalKind } from '@sparx/legal-templates';

import { getLegalChecklist, createLegalPage } from '../legal-service.js';
import { serializeEntry } from '../entries.js';

import type { McpToolDefinition } from './registry.js';

// `publish` wants a FastifyBaseLogger; the MCP service has none, so pass a console
// logger (same shim the CMS write tools use — no fastify dependency).
const mcpLogger = console as unknown as Parameters<typeof publish>[0];

export const getLegalChecklistTool: McpToolDefinition = {
  name: 'get_legal_checklist',
  description:
    "The tenant's legal-page checklist. For each platform legal template (privacy, terms, " +
    'cookie-policy, returns, shipping, refund) it reports whether a page exists and its state — ' +
    'missing / draft / stale / unplaced / complete — plus whether it is required (privacy always; ' +
    'returns/shipping/refund when the store is on), its slug, and whether it is placed in the footer. ' +
    'Call this before wiring or trusting a site footer’s legal links: a link resolves only once its ' +
    'page is PUBLISHED and placed. Read-only.',
  scope: 'read:cms',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => getLegalChecklist(ctx.tenantId),
};

export const createLegalPageTool: McpToolDefinition = {
  name: 'create_legal_page',
  description:
    'Scaffold a missing legal page from the platform starter template. `legalKind` is one of ' +
    'privacy | terms | cookie-policy | returns | shipping | refund. It lands as a DRAFT with a ' +
    'starter-text disclaimer and a footer placement. IMPORTANT: this does NOT publish or approve it — ' +
    'the tenant must review the wording, acknowledge the disclaimer, and publish it from the workbench ' +
    '(Content → Legal pages). Run get_legal_checklist first to see what is missing; refuses if a page ' +
    'of that kind (or one already at the template’s slug) exists.',
  scope: 'write:cms',
  confirmation: true,
  input: z.object({
    legalKind: z.enum(LEGAL_KINDS as unknown as [LegalKind, ...LegalKind[]]),
  }),
  run: async (ctx, input) => {
    const { legalKind } = input as { legalKind: LegalKind };
    const { entry, events } = await createLegalPage(
      { tenantId: ctx.tenantId, actorId: ctx.userId },
      legalKind
    );
    for (const ev of events) await publish(mcpLogger, ev.type, ctx.tenantId, ctx.userId, ev.data);
    return serializeEntry(entry);
  },
};

export const legalTools: McpToolDefinition[] = [getLegalChecklistTool, createLegalPageTool];
