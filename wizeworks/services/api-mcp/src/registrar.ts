// Registrar composition root for api-mcp (mirrors api-rest's lib/registrar.ts).
//
// Selects the active domain registrar by env (REGISTRAR) and caches the single
// instance. GoDaddy today; adding name.com is a one-line `case` + provider
// import here, with no change to the domain MCP tools, which depend on the
// `RegistrarClient` interface. Re-exports the contract surface (types,
// RegistrarError, neutral DNS helper) for convenience.

import type { RegistrarClient } from '@wizeworks/registrar';
import { createGoDaddyRegistrar } from '@wizeworks/godaddy';
import { env } from './env.js';

export * from '@wizeworks/registrar';

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
