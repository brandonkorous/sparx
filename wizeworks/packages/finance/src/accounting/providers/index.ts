// The live accounting adapters (docs/146 Phase 10.7–10.8).
//
// Two, and no placeholders. A registry entry with nothing behind it is the thing
// `IntegrationCategory` in @wizeworks/integrations refuses to carry, for the reason
// documented there: two categories were once listed with no implementer and the
// panel rendered empty headings for months.

import type { AccountingAdapter } from './types';
import { quickbooksAdapter } from './quickbooks';
import { xeroAdapter } from './xero';

export * from './types';
export { quickbooksAdapter } from './quickbooks';
export { xeroAdapter } from './xero';

const ADAPTERS: Record<string, AccountingAdapter> = {
  quickbooks_online: quickbooksAdapter,
  xero: xeroAdapter,
};

export function accountingAdapter(provider: string): AccountingAdapter | undefined {
  return ADAPTERS[provider];
}

export function accountingAdapters(): AccountingAdapter[] {
  return Object.values(ADAPTERS);
}

/**
 * Whether this deployment can offer a direct connection to a provider.
 *
 * The adapters are complete; whether a tenant can press "connect" depends on
 * whether an OAuth app is registered with that vendor for this installation,
 * which is an environment variable. Reporting it here keeps the catalogue
 * honest — "not switched on here, and here is the export that works today"
 * rather than a button that dies at the redirect.
 */
export function accountingProviderAvailability(provider: string): {
  available: boolean;
  reason?: string;
} {
  const adapter = accountingAdapter(provider);
  if (!adapter) return { available: false, reason: 'That system is not supported.' };
  return adapter.isConfigured()
    ? { available: true }
    : { available: false, reason: adapter.unavailableReason() };
}
