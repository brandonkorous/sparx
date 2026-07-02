// The site tool catalog (docs/113 §6) — the single source of truth for
// shopper tools, aggregated from the per-domain files. Both the mcp-site
// service and the site concierge consume this array.

import type { SiteTool } from '../types.js';
import { siteTools } from './site.js';
import { commerceTools } from './commerce.js';
import { schedulingTools } from './scheduling.js';
import { cartTools } from './cart.js';
import { checkoutTools } from './checkout.js';
import { accountTools } from './account.js';

/** Every shopper tool. `read` + `guest_write` are the anonymous surface; the
 *  `customer`-tier `accountTools` (docs/113 §5) are registered only once the
 *  shopper authorizes via OAuth (the host filters by `kind`). */
export const SITE_TOOLS: SiteTool[] = [
  ...siteTools,
  ...commerceTools,
  ...schedulingTools,
  ...cartTools,
  ...checkoutTools,
  ...accountTools,
];

export const TOOLS_BY_NAME: ReadonlyMap<string, SiteTool> = new Map(
  SITE_TOOLS.map((t) => [t.name, t])
);

export function getSiteTool(name: string): SiteTool | undefined {
  return TOOLS_BY_NAME.get(name);
}

/** Tools whose module (if any) is NOT in `disabledModules` — used by a host to
 *  skip registering tools for modules the tenant has switched off (cleaner
 *  tools/list). Tools with no module are always kept. */
export function toolsForModules(disabledModules: readonly string[]): SiteTool[] {
  const off = new Set(disabledModules);
  return SITE_TOOLS.filter((t) => !t.module || !off.has(t.module));
}
