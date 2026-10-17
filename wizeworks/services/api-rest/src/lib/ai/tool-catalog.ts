// The MCP tool catalog, as the tool-policy surface sees it (docs/07 §3 + §9).
//
// The authoritative tool set is code-defined: each module exports a `*McpTools`
// array, and wizeworks/services/api-mcp/src/tool-registry.ts aggregates them into the live
// registry. This file projects the SAME arrays to lightweight metadata
// (name/description/scope/write/module) so the dashboard can render a per-tool
// allow/deny toggle. We import the identical set api-mcp registers — no parallel
// hardcoded list — plus a small supplement for the 4 domain tools that live inside
// api-mcp itself (wizeworks/services/api-mcp/src/domain-tools.ts) rather than a package.
//
// Drift guard: if a module adds a tool, it appears here automatically (same import).
// The tools that live inside api-mcp itself (domains, and the handful in
// LOCAL_TOOLS below) are mirrored by hand, and api-mcp's
// `tool-catalog-parity.test.ts` fails when the two name lists differ. Before it,
// this file had quietly lost media, content, social, wholesale and campaign tools
// and every api-mcp-local one: about a hundred tools an AI app could call and the
// Permissions screen could not switch off (sparx persona issue 297).

import { crmMcpTools, invoicingMcpTools } from '@wizeworks/crm';
import { commerceMcpTools } from '@wizeworks/commerce';
import { inventoryMcpTools } from '@wizeworks/inventory/mcp';
import { sitebuilderMcpTools } from '@wizeworks/sitebuilder';
import { builderMcpTools } from '@wizeworks/builder/mcp';
import { emailMcpTools } from '@wizeworks/email-platform';
import { searchMcpTools } from '@wizeworks/search';
import { automationMcpTools } from '@wizeworks/automation';
import { schedulingMcpTools } from '@wizeworks/scheduling';
import { mediaMcpTools } from '@wizeworks/media/mcp';
import { cmsMcpTools } from '@wizeworks/cms/mcp';
import { socialMcpTools } from '@wizeworks/social/mcp';
import { b2bMcpTools } from '@wizeworks/b2b/mcp';
import { funnelsMcpTools } from '@wizeworks/funnels/mcp';

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

// Mirror of wizeworks/services/api-mcp/src/domain-tools.ts (api-mcp-local, not a package).
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
    description: 'Register a new domain and connect it to this tenant. Irreversible: confirms.',
    scope: 'write:domains',
    confirmation: true,
  },
];

// Mirror of the tools defined inside api-mcp (purchase-order-tools.ts,
// b2b-price-tools.ts, b2b-approval-tools.ts, scheduling-ending-tools.ts,
// search-admin-tools.ts). Names and scopes must match; the parity test checks.
const LOCAL_TOOLS: RawMcpTool[] = [
  {
    name: 'email_purchase_order',
    description: 'Email a purchase order to its supplier.',
    scope: 'write:inventory',
    confirmation: true,
  },
  {
    name: 'resolve_b2b_price',
    description: 'Work out the price a wholesale account pays for a product, and why.',
    scope: 'read:b2b',
    confirmation: false,
  },
  {
    name: 'approve_b2b_order',
    description: 'Approve a wholesale order held for sign-off.',
    scope: 'write:b2b',
    confirmation: true,
  },
  {
    name: 'reject_b2b_order',
    description: 'Turn down a wholesale order held for sign-off.',
    scope: 'write:b2b',
    confirmation: true,
  },
  {
    name: 'cancel_booking',
    description: "Cancel a booking, applying the service's booking rules to any card or deposit.",
    scope: 'write:scheduling',
    confirmation: true,
  },
  {
    name: 'no_show_booking',
    description: "Mark a booking as a no-show, applying the service's no-show fee.",
    scope: 'write:scheduling',
    confirmation: true,
  },
  {
    name: 'complete_booking',
    description: 'Mark a booking as completed.',
    scope: 'write:scheduling',
    confirmation: true,
  },
  {
    name: 'cancel_booking_series',
    description: 'Cancel the rest of a repeating booking.',
    scope: 'write:scheduling',
    confirmation: true,
  },
  {
    name: 'rebuild_search_index',
    description: 'Rebuild the search index for this business.',
    scope: 'write:search',
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
  mediaMcpTools,
  cmsMcpTools,
  socialMcpTools,
  b2bMcpTools,
  funnelsMcpTools,
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
  if (resource.startsWith('b2b')) return 'b2b';
  if (resource.startsWith('cms')) return 'cms';
  if (resource.startsWith('social')) return 'social';
  if (resource.startsWith('funnels')) return 'funnels';
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
export const TOOL_CATALOG: ToolCatalogEntry[] = [
  ...MODULE_TOOL_ARRAYS.flat(),
  ...DOMAIN_TOOLS,
  ...LOCAL_TOOLS,
]
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
