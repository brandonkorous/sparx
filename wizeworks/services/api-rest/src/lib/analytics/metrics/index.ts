// Registers every metric. Importing this file is the side effect that populates
// the registry — the query executor imports it once, the same shape the workbench
// surface catalog uses. New metric modules are added to the list below and
// nowhere else.

import { registerMetrics } from '../registry.js';
import { BUILDER_TRAFFIC_METRICS } from './builder-traffic.js';
import { COMMERCE_SALES_METRICS } from './commerce-sales.js';
import { CRM_CUSTOMERS_METRICS } from './crm-customers.js';

let registered = false;

/** Idempotent — safe to call from every request path; only the first populates. */
export function ensureMetricsRegistered(): void {
  if (registered) return;
  registerMetrics(BUILDER_TRAFFIC_METRICS);
  registerMetrics(COMMERCE_SALES_METRICS);
  registerMetrics(CRM_CUSTOMERS_METRICS);
  registered = true;
}
