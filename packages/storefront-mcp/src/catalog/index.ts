// The storefront tool catalog (docs/113 §6) — the single source of truth for
// shopper tools, aggregated from the per-domain files. Both the mcp-storefront
// service and the storefront concierge consume this array.

import type { StorefrontTool } from '../types.js';
import { storeTools } from './store.js';
import { commerceTools } from './commerce.js';
import { schedulingTools } from './scheduling.js';
import { cartTools } from './cart.js';
import { checkoutTools } from './checkout.js';

/** All Phase-1 shopper tools (anonymous `read` + `guest_write`). Phase-2
 *  `customer`-tier tools are appended here when that tier lands (docs/113 §5). */
export const STOREFRONT_TOOLS: StorefrontTool[] = [
  ...storeTools,
  ...commerceTools,
  ...schedulingTools,
  ...cartTools,
  ...checkoutTools,
];

export const TOOLS_BY_NAME: ReadonlyMap<string, StorefrontTool> = new Map(
  STOREFRONT_TOOLS.map((t) => [t.name, t])
);

export function getStorefrontTool(name: string): StorefrontTool | undefined {
  return TOOLS_BY_NAME.get(name);
}

/** Tools whose module (if any) is NOT in `disabledModules` — used by a host to
 *  skip registering tools for modules the tenant has switched off (cleaner
 *  tools/list). Tools with no module are always kept. */
export function toolsForModules(disabledModules: readonly string[]): StorefrontTool[] {
  const off = new Set(disabledModules);
  return STOREFRONT_TOOLS.filter((t) => !t.module || !off.has(t.module));
}
