// WizeLens: request tracing (timeline, Prisma calls, GraphQL operations, outgoing fetches, the signed-in user).
//
// On in development, with its dashboard at /_wizelens on this service. In
// production it runs only with WIZELENS_ENABLED=true (set in
// k8s/apps/api-graphql.yaml), and then it is SEND-ONLY: traces go to WIZELENS_HUB
// (WizeLens Cloud) with WIZELENS_HUB_TOKEN, sampled by WIZELENS_SAMPLE_RATE,
// and `/_wizelens` serves no dashboard or read API. Off in tests.
//
// index.ts imports this module FIRST. The Prisma hook below must be on
// `globalThis` before @wizeworks/db builds its client, and ES modules evaluate
// in import order, so a later import would leave every query untraced.

import { createRequire } from 'node:module';
import {
  createWizeLens,
  instrumentGraphql,
  prismaExtension,
  wizelensFastify,
} from '@wizeworks/lens-node';
import { env } from './env.js';

const enabled = env.NODE_ENV === 'development' || process.env.WIZELENS_ENABLED === 'true';

export const wizelens = createWizeLens({ serviceName: 'api-graphql', enabled });

if (enabled) {
  (globalThis as { __wizelensPrisma?: unknown }).__wizelensPrisma = prismaExtension(wizelens, {
    system: 'postgresql',
  });
  // Mercurius's own copy of graphql, patched before Mercurius loads it: each request is named by its
  // operation (`POST /v1/graphql (GetDeals)`) and gets a span with the document, values hidden.
  const local = createRequire(import.meta.url);
  instrumentGraphql(wizelens, createRequire(local.resolve('mercurius'))('graphql'));
  (globalThis as { __wizelensAuth?: unknown }).__wizelensAuth = onWizeLensAuth;
}

/** The shared auth plugin (@wizeworks/api-core) calls this after it reads a caller: the signed-in user shows on WizeLens's Users page, and every request carries its tenant as a tag. */
function onWizeLensAuth(caller: {
  actorId: string;
  actorType: string;
  tenantId: string;
  name?: string | null;
}): void {
  if (caller.actorType === 'user')
    wizelens.setUser(caller.actorId, caller.name ? { name: caller.name } : {});
  wizelens.tag('tenant', caller.tenantId);
}

/** Fastify plugin. Register before every other plugin so its span wraps them all. */
export const wizelensPlugin = wizelensFastify(wizelens);
