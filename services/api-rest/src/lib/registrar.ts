// Registrar composition root for api-rest.
//
// Selects the active domain registrar by env (REGISTRAR) and caches the single
// instance for the process. GoDaddy is the only provider today; adding name.com
// is a one-line `case` + provider import here (and the matching workspace dep) —
// no route code changes, because everything downstream depends on the
// `RegistrarClient` interface, not on GoDaddy.
//
// Re-exports the provider-agnostic contract (shared types, RegistrarError, and
// the registrar-neutral DNS/DKIM helpers) so route handlers import everything
// registrar-related from this one module.

import type { RegistrarClient } from '@sparx/registrar';
import { createGoDaddyRegistrar } from '@sparx/godaddy';
import { env } from '../env.js';

export * from '@sparx/registrar';

let instance: RegistrarClient | undefined;

/** The active registrar for this process (constructed lazily, then cached).
 *  Construction touches no network or credentials — those are read per call. */
export function getRegistrar(): RegistrarClient {
  if (!instance) {
    switch (env.REGISTRAR) {
      // case 'namecom':
      //   instance = createNameComRegistrar();
      //   break;
      case 'godaddy':
      default:
        instance = createGoDaddyRegistrar();
    }
  }
  return instance;
}
