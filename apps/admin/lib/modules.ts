// Module presentation for the operator console. api-rest returns raw module keys
// (+ prices/state); the console maps keys → labels + hues here so a tenant's
// modules read exactly as they do in the tenant's own dashboard (representation
// parity, D7). Keys are the platform ModuleSlug set (@sparx/modules).

import type { SparxModule } from '@sparx/ui';

/** Module key → display label — the same wording the dashboard's Finance →
 *  subscription screen uses (`B2B · Fleet`, `AI · MCP`, `Live Chat`). */
export const MODULE_LABELS: Record<string, string> = {
  builder: 'Builder',
  commerce: 'Commerce',
  cms: 'CMS',
  crm: 'CRM',
  email: 'Email',
  b2b: 'B2B · Fleet',
  ai: 'AI · MCP',
  dropship: 'Dropship',
  invoicing: 'Invoicing',
  inventory: 'Inventory',
  chat: 'Live Chat',
  scheduling: 'Scheduling',
};

export function moduleLabel(key: string): string {
  return MODULE_LABELS[key] ?? key;
}

// Module keys `ModuleProvider` can color. A key outside this set falls back to
// the neutral platform hue rather than rendering an unset custom property.
const MODULE_COLOR_KEYS: ReadonlySet<string> = new Set<SparxModule>([
  'builder',
  'commerce',
  'cms',
  'crm',
  'email',
  'b2b',
  'ai',
  'dropship',
  'inventory',
  'chat',
  'scheduling',
  'social',
  'finance',
]);

/** The `ModuleProvider` hue for a module key (`platform` fallback for unknowns). */
export function moduleColor(key: string): SparxModule {
  return (MODULE_COLOR_KEYS.has(key) ? key : 'platform') as SparxModule;
}
