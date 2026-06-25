// Built-in channel adapters + their registration entrypoint (docs/106 §4.1).
//
// Concrete adapters live here (one file per channel), alongside the shared
// `_http` helpers — mirroring @sparx/dropship's `src/adapters/`. The server-safe
// channel CATALOG (display metadata) stays in `../catalog.ts` with NO adapter
// import, so the dashboard renders the connect cards without pulling network code.
//
// Both api-rest (connect/callback) and channel-sync-worker (catalog/inventory
// push) call `registerBuiltinChannels()` once at boot. Adding a channel = one
// adapter file + one line here, with no change to the worker dispatch core.

import { hasChannel, registerChannel } from '../registry.js';
import { GoogleShoppingAdapter } from './google-shopping.js';
import { MetaAdapter } from './meta.js';
import { PinterestAdapter } from './pinterest.js';

let registered = false;

/** Register every built-in channel adapter into the singleton registry. Idempotent
 *  — safe across repeated calls / HMR. Adapters register regardless of whether
 *  their platform OAuth credentials are set; connectability is gated separately by
 *  `adapter.isConfigured()` so a channel lights up the instant ops sets its env. */
export function registerBuiltinChannels(): void {
  if (registered) return;
  const adapters = [new GoogleShoppingAdapter(), new MetaAdapter(), new PinterestAdapter()];
  for (const adapter of adapters) {
    if (!hasChannel(adapter.id)) registerChannel(adapter);
  }
  registered = true;
}

export { GoogleShoppingAdapter } from './google-shopping.js';
export { MetaAdapter } from './meta.js';
export { PinterestAdapter } from './pinterest.js';
