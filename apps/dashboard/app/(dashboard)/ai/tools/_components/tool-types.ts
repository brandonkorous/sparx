// Shared shapes + module display vocabulary for the MCP tool-policy manager.
// The DTO mirrors api-rest's /v1/ai/tool-policies contract: the full MCP tool
// catalog with each tool's *effective* exposure for this tenant.

export interface ToolPolicyDto {
  name: string;
  description: string;
  scope: string;
  /** Owning module slug, or null for a platform tool. */
  module: string | null;
  /** A mutating tool (vs. read-only). */
  write: boolean;
  /** Effective exposure — default true unless the tenant disabled it. */
  enabled: boolean;
  /** The tenant has an explicit override row for this tool. */
  explicit: boolean;
}

// Human labels for the module slugs the catalog groups under. Anything not
// listed Title-cases its slug; a null module groups under "Platform" (rendered
// last — see tool-policy-manager).
const MODULE_LABELS: Record<string, string> = {
  ai: 'AI',
  cms: 'CMS',
  crm: 'CRM',
  b2b: 'B2B',
  seo: 'SEO',
  commerce: 'Commerce',
  builder: 'Builder',
  email: 'Email',
  inventory: 'Inventory',
  dropship: 'Dropship',
  invoicing: 'Invoicing',
  chat: 'Live Chat',
  scheduling: 'Scheduling',
  automations: 'Automations',
};

export const PLATFORM_GROUP_LABEL = 'Platform';

export function moduleGroupLabel(module: string | null): string {
  if (module == null) return PLATFORM_GROUP_LABEL;
  return MODULE_LABELS[module] ?? module.charAt(0).toUpperCase() + module.slice(1);
}
