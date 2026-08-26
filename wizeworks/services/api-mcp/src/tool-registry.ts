// The merged MCP tool registry across modules, plus small lookup helpers that
// don't need the SDK. Kept separate from server.ts so the rate limiter can ask
// "is this a write tool call?" without pulling in the SDK.

import type { z } from 'zod';
import { crmMcpTools, invoicingMcpTools } from '@wizeworks/crm';
import { commerceMcpTools } from '@wizeworks/commerce';
import { inventoryMcpTools } from '@wizeworks/inventory/mcp';
import { sitebuilderMcpTools } from '@wizeworks/sitebuilder';
import { builderMcpTools } from '@wizeworks/builder/mcp';
import { mediaMcpTools } from '@wizeworks/media/mcp';
import { emailMcpTools } from '@wizeworks/email-platform';
import { searchMcpTools } from '@wizeworks/search';
import { automationMcpTools } from '@wizeworks/automation';
import { schedulingMcpTools } from '@wizeworks/scheduling';
import { cmsMcpTools } from '@wizeworks/cms/mcp';
import { socialMcpTools } from '@wizeworks/social/mcp';
import { b2bMcpTools } from '@wizeworks/b2b/mcp';
import { funnelsMcpTools } from '@wizeworks/funnels/mcp';
import { domainMcpTools } from './domain-tools.js';
import { searchAdminMcpTools } from './search-admin-tools.js';

// Structural type spanning every module's tool definition. Each module declares
// its own scope union; here we only need the shared shape (scope is a string).
export interface AnyMcpTool {
  name: string;
  description: string;
  scope: string;
  input: z.ZodType;
  confirmation: boolean;
  run(ctx: { tenantId: string; userId: string }, input: unknown): Promise<unknown>;
}

// Every tool the MCP server publishes. Add a module's tool array here to expose
// it. Same service layer the REST transport uses (one service, many transports).
export const ALL_MCP_TOOLS: AnyMcpTool[] = [
  ...(crmMcpTools as unknown as AnyMcpTool[]),
  ...(commerceMcpTools as unknown as AnyMcpTool[]),
  // Inventory (docs/100 P6c) — own read:inventory / write:inventory scopes;
  // additionally gated on the `inventory` module flag in server.ts (MODULE_BY_SCOPE).
  ...(inventoryMcpTools as unknown as AnyMcpTool[]),
  ...(sitebuilderMcpTools as unknown as AnyMcpTool[]),
  ...(builderMcpTools as unknown as AnyMcpTool[]),
  // Media (image upload / reference) — write:builder scope (media is a builder/
  // site input; not module-gated). Server-side upload lands originals in the
  // media bucket + fans out media.uploaded → media-worker transcodes.
  ...(mediaMcpTools as unknown as AnyMcpTool[]),
  ...(emailMcpTools as unknown as AnyMcpTool[]),
  ...(searchMcpTools as unknown as AnyMcpTool[]),
  // Index maintenance lives here, not in @wizeworks/search — see search-admin-tools.ts
  // for why the one WRITE search tool is kept out of that package.
  ...(searchAdminMcpTools as unknown as AnyMcpTool[]),
  // Automations are a PLATFORM capability (no module slug); the tools are
  // reachable whenever MCP itself is (the `ai` module gate in auth.ts).
  ...(automationMcpTools as unknown as AnyMcpTool[]),
  ...(domainMcpTools as unknown as AnyMcpTool[]),
  // Invoicing (docs/87 §12) — own scopes; additionally gated on the `invoicing`
  // module flag in server.ts dispatch (MODULE_BY_SCOPE).
  ...(invoicingMcpTools as unknown as AnyMcpTool[]),
  // Scheduling (docs/79 §11) — own read:scheduling / write:scheduling scopes;
  // additionally gated on the `scheduling` module flag in server.ts.
  ...(schedulingMcpTools as unknown as AnyMcpTool[]),
  // CMS (docs/12) — content types + entries; own read:cms / write:cms scopes,
  // additionally gated on the `cms` module flag in server.ts. Thin wrappers over
  // the @wizeworks/cms service layer the REST routes drive (one service, many transports).
  ...(cmsMcpTools as unknown as AnyMcpTool[]),
  // Social (docs/133) — post compose + lifecycle; own read:social / write:social
  // scopes, additionally gated on the `social` module flag in server.ts. Thin
  // wrappers over @wizeworks/social/service (extracted from api-rest so REST + MCP
  // share one service — one service, many transports).
  ...(socialMcpTools as unknown as AnyMcpTool[]),
  // B2B / wholesale (docs/10) — pricing tiers + overrides, account trade config +
  // fleet, purchase-approval rules + queue, net-terms AR invoices; own read:b2b /
  // write:b2b scopes, additionally gated on the `b2b` module flag in server.ts.
  // Thin wrappers over @wizeworks/b2b's service layer (extracted from the api-rest
  // routes so REST + MCP share one implementation — one service, many transports).
  ...(b2bMcpTools as unknown as AnyMcpTool[]),
  // Funnels (docs/151) — campaigns and whether they worked; own read:funnels /
  // write:funnels scopes, additionally gated on the `funnels` module flag in
  // server.ts. The report tool is the one that matters: docs/152 A1 found that
  // the conversion funnel was reachable ONLY by asking an AI, so the answer an
  // agent gets has to be the whole ladder rather than a row count.
  ...(funnelsMcpTools as unknown as AnyMcpTool[]),
];

/**
 * Tools that can honour a SITE restriction (docs/131 §3.2).
 *
 * Derived from the tool arrays rather than hand-listed by name, so a new builder
 * or sitebuilder tool is covered the day it is added — a hand-kept list would
 * silently deny it instead, and "the new tool doesn't work with site keys" is a
 * bug nobody would trace back to here.
 *
 * These three families resolve their target site through `toPropertyContext`,
 * which is where the ceiling is applied. Everything else — CRM, commerce,
 * inventory, invoicing, scheduling, email, CMS — reads tenant-wide today, so a
 * site-scoped key is REFUSED rather than served cross-business data. Each moves
 * onto this list as its services become site-aware (docs/131 §4–5).
 *
 * Refusing is the deliberate choice over silently widening: a key that cannot
 * yet do something is a limitation someone reports, whereas a key that quietly
 * returns another business's customers is the defect this exists to remove.
 */
/**
 * Commerce REPORT tools, listed BY NAME rather than derived from the array.
 *
 * The three families above are whole packages whose every tool resolves a site
 * through `toPropertyContext`, so deriving from the array is right for them.
 * Commerce is different: only its reporting half became site-aware (docs/152 A2
 * — each of these now takes an optional `propertyId` and passes the credential's
 * ceiling), while the rest of `commerceMcpTools` still reads tenant-wide. Adding
 * the array would quietly declare products, carts, reviews and fitment scopable
 * when they are not, which is the exact defect the refusal exists to prevent.
 *
 * The cost of a by-name list is the one the comment above warns about: a new
 * report added to the service is NOT covered here until someone adds it, and the
 * symptom is a site key refusing a tool that would have worked. That is the safe
 * direction to fail in, and it is why this list stays short and separate rather
 * than growing into a hand-kept mirror of the whole module.
 */
export const SITE_SCOPABLE_COMMERCE_REPORTS: readonly string[] = [
  'get_revenue_summary',
  'get_top_products',
  'get_top_customers_by_revenue',
  'get_conversion_funnel',
  'get_abandoned_carts',
  'get_channel_revenue',
  'get_channel_comparison',
  'get_channel_top_products',
  'get_sales_by_traffic_source',
];

const SITE_SCOPABLE_TOOL_NAMES: ReadonlySet<string> = new Set([
  ...[
    ...(sitebuilderMcpTools as unknown as AnyMcpTool[]),
    ...(builderMcpTools as unknown as AnyMcpTool[]),
    ...(mediaMcpTools as unknown as AnyMcpTool[]),
  ].map((t) => t.name),
  ...SITE_SCOPABLE_COMMERCE_REPORTS,
]);

/** Can this tool run under a site-restricted credential? */
export function isSiteScopableTool(name: string): boolean {
  return SITE_SCOPABLE_TOOL_NAMES.has(name);
}

const WRITE_SCOPES: ReadonlySet<string> = new Set([
  'write:crm',
  'write:crm_bulk',
  'write:commerce',
  'write:commerce_bulk',
  'write:inventory',
  'write:builder',
  'write:email',
  'write:email_bulk',
  'write:automations',
  'write:domains',
  'write:invoicing',
  'write:scheduling',
  'write:cms',
  'write:social',
  'write:b2b',
  'write:funnels',
  'write:search',
]);

const TOOLS_BY_NAME: ReadonlyMap<string, AnyMcpTool> = new Map(
  ALL_MCP_TOOLS.map((t) => [t.name, t])
);

/** True when `body` is a JSON-RPC `tools/call` for a write-scope tool.
 *  Anything else (initialize, tools/list, read-scope calls, unknown names)
 *  returns false so it counts only against the per-minute / per-day quotas. */
export function isWriteToolCall(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const b = body as { method?: unknown; params?: unknown };
  if (b.method !== 'tools/call') return false;
  const params = b.params as { name?: unknown } | undefined;
  const name = typeof params?.name === 'string' ? params.name : null;
  if (!name) return false;
  const tool = TOOLS_BY_NAME.get(name);
  if (!tool) return false;
  return WRITE_SCOPES.has(tool.scope);
}
