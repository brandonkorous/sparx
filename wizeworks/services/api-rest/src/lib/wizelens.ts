// WizeLens: request tracing (timeline, Prisma calls, outgoing fetches).
//
// On in development, with its dashboard at http://localhost:3100/_wizelens.
// In production it runs only with WIZELENS_ENABLED=true (set in
// k8s/apps/api-rest.yaml), and then it is SEND-ONLY: traces go to
// WIZELENS_HUB (WizeLens Cloud) with WIZELENS_HUB_TOKEN, sampled by
// WIZELENS_SAMPLE_RATE, and `/_wizelens` serves no dashboard or read API.
// Off in tests and everywhere else: no hooks, no Prisma extension.
//
// index.ts imports this module FIRST. The Prisma hook below must be on
// `globalThis` before @wizeworks/db builds its client, and ES modules evaluate
// in import order, so a later import would leave every query untraced.

import { createWizeLens, prismaExtension, wizelensFastify } from '@wizeworks/lens-node';
import { env } from '../env.js';

const development = env.NODE_ENV === 'development';
const enabled = development || process.env.WIZELENS_ENABLED === 'true';

export const wizelens = createWizeLens({ serviceName: 'api-rest', enabled });

if (enabled) {
  (globalThis as { __wizelensPrisma?: unknown }).__wizelensPrisma = prismaExtension(wizelens, {
    system: 'postgresql',
  });
}

/** Fastify plugin. Register before every other plugin so its span wraps them all. */
export const wizelensPlugin = wizelensFastify(wizelens);

/** The local dashboard and its API: kept out of the rate limit so its polling never starves the app. Development only. */
export function isWizeLensPath(url: string): boolean {
  return development && (url === '/_wizelens' || url.startsWith('/_wizelens/'));
}
