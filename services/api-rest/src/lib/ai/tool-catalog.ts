// The MCP tool catalog, as the tool-policy surface sees it (docs/07 §3 + §9).
//
// The authoritative tool set is code-defined: each module exports a `*McpTools`
// array, and services/api-mcp/src/tool-registry.ts aggregates them into the live
// registry. This file projects the SAME arrays to lightweight metadata
// (name/description/scope/write/module) so the dashboard can render a per-tool
// allow/deny toggle. We import the identical set api-mcp registers — no parallel
// hardcoded list — plus a small supplement for the 4 domain tools that live inside
// api-mcp itself (services/api-mcp/src/domain-tools.ts) rather than a package.
//
// Drift guard: if a module adds a tool, it appears here automatically (same import).
// The api-mcp domain tools are the one manual mirror — kept tiny + co-documented.

import { crmMcpTools, invoicingMcpTools } from '@sparx/crm';
import { commerceMcpTools } from '@sparx/commerce';
import { inventoryMcpTools } from '@sparx/inventory/mcp';
import { sitebuilderMcpTools } from '@sparx/sitebuilder';
import { builderMcpTools } from '@sparx/builder/mcp';
import { emailMcpTools } from '@sparx/email-platform';
import { searchMcpTools } from '@sparx/search';
import { automationMcpTools } from '@sparx/automation';
import { schedulingMcpTools } from '@sparx/scheduling';

/** The shared shape across every module's tool definition (api-mcp's AnyMcpTool,
 *  narrowed to the metadata the catalog needs — scope is a plain string). */
interface RawMcpTool {
  name: string;
  description: string;
  scope: string;
  confirmation?: boolean;
}

export interface ToolCatalogEntry {
  name: string;
  description: string;
  scope: string;
  module: string | null;
  write: boolean;
}

// Mirror of services/api-mcp/src/domain-tools.ts (api-mcp-local, not a package).
const DOMAIN_TOOLS: RawMcpTool[] = [
  {
    name: 'get_domains',
    description:
      'List all web domains registered or connected to this tenant, with status and expiry.',
    scope: 'read:domains',
    confirmation: false,
  },
  {
    name: 'check_domain_availability',
    description: 'Check whether a specific domain name is available for registration, with price.',
    scope: 'read:domains',
    confirmation: false,
  },
  {
    name: 'suggest_domains',
    description: 'Given a business name or keyword, suggest available domain names with pricing.',
    scope: 'read:domains',
    confirmation: false,
  },
  {
    name: 'purchase_domain',
    description: 'Register a new domain and connect it to this tenant. Irreversible — confirms.',
    scope: 'write:domains',
    confirmation: true,
  },
];

const MODULE_TOOL_ARRAYS = [
  crmMcpTools,
  commerceMcpTools,
  inventoryMcpTools,
  sitebuilderMcpTools,
  builderMcpTools,
  emailMcpTools,
  searchMcpTools,
  automationMcpTools,
  invoicingMcpTools,
  schedulingMcpTools,
] as unknown as RawMcpTool[][];

/** Map a tool scope (`read:crm`, `write:commerce_bulk`, …) to the module slug it
 *  belongs to, or null for platform-wide capabilities (search/automations/domains
 *  have no module flag — reachable whenever MCP itself is). */
function moduleForScope(scope: string): string | null {
  const resource = scope.split(':')[1] ?? '';
  if (resource.startsWith('crm')) return 'crm';
  if (resource.startsWith('commerce')) return 'commerce';
  if (resource.startsWith('inventory')) return 'inventory';
  if (resource.startsWith('email')) return 'email';
  if (resource.startsWith('builder')) return 'builder';
  if (resource.startsWith('invoicing')) return 'invoicing';
  if (resource.startsWith('scheduling')) return 'scheduling';
  // search, automations, domains — platform-level, no per-module gate.
  return null;
}

function toEntry(t: RawMcpTool): ToolCatalogEntry {
  return {
    name: t.name,
    description: t.description,
    scope: t.scope,
    module: moduleForScope(t.scope),
    write: t.scope.startsWith('write:'),
  };
}

/** Every MCP tool, in a stable order (by module, then name) for the policy UI. */
export const TOOL_CATALOG: ToolCatalogEntry[] = [...MODULE_TOOL_ARRAYS.flat(), ...DOMAIN_TOOLS]
  .map(toEntry)
  .sort((a, b) => {
    const am = a.module ?? 'zzz';
    const bm = b.module ?? 'zzz';
    return am === bm ? a.name.localeCompare(b.name) : am.localeCompare(bm);
  });

const CATALOG_NAMES = new Set(TOOL_CATALOG.map((t) => t.name));

/** True when `name` is a real registered MCP tool (guards policy writes against
 *  typos / stale tool names). */
export function isKnownTool(name: string): boolean {
  return CATALOG_NAMES.has(name);
}
