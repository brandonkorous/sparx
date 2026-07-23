// Built-in social adapters + their registration entrypoint (docs/133 §4).
//
// Concrete adapters live here (one file per platform) alongside the shared `_http`
// helpers — mirroring @sparx/channels' `src/adapters/`. The server-safe platform
// CATALOG (display metadata) stays in `../catalog.ts` with NO adapter import, so the
// composer UI renders the connect cards without pulling network code.
//
// Both api-rest (connect/callback + compose) and social-worker (publish) call
// `registerBuiltinSocialAdapters()` once at boot. Adding a platform = one adapter file
// + one line here, with no change to the worker dispatch core.

import { registerSocialAdapter } from '../registry.js';
import { GoogleBusinessAdapter } from './google-business.js';
import { LinkedInAdapter } from './linkedin.js';

let registered = false;

/** Register every built-in adapter (idempotent — safe to call from more than one
 *  route module / worker boot). */
export function registerBuiltinSocialAdapters(): void {
  if (registered) return;
  registerSocialAdapter(new GoogleBusinessAdapter());
  registerSocialAdapter(new LinkedInAdapter());
  // Meta/Instagram/Threads (Phase 2) register here as they land.
  registered = true;
}

export { GoogleBusinessAdapter } from './google-business.js';
export { LinkedInAdapter } from './linkedin.js';
