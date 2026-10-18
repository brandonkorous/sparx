// WizeLens: request tracing (timeline, Prisma calls, outgoing fetches).
//
// On in development, with its dashboard at /_wizelens on this service. In
// production it runs only with WIZELENS_ENABLED=true (set in
// k8s/apps/api-mcp.yaml), and then it is SEND-ONLY: traces go to WIZELENS_HUB
// (WizeLens Cloud) with WIZELENS_HUB_TOKEN, sampled by WIZELENS_SAMPLE_RATE,
// and `/_wizelens` serves no dashboard or read API. Off in tests.
//
// index.ts imports this module FIRST. The Prisma hook below must be on
// `globalThis` before @wizeworks/db builds its client, and ES modules evaluate
// in import order, so a later import would leave every query untraced.

import { createWizeLens, prismaExtension, wizelensFastify } from '@wizeworks/lens-node';
import { env } from './env.js';

const enabled = env.NODE_ENV === 'development' || process.env.WIZELENS_ENABLED === 'true';

export const wizelens = createWizeLens({ serviceName: 'api-mcp', enabled });

if (enabled) {
  (globalThis as { __wizelensPrisma?: unknown }).__wizelensPrisma = prismaExtension(wizelens, {
    system: 'postgresql',
  });
}

/** Fastify plugin. Register before every other plugin so its span wraps them all. */
export const wizelensPlugin = wizelensFastify(wizelens);
