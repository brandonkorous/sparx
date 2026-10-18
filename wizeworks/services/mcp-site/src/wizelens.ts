// WizeLens: request tracing (timeline and the api-rest calls each tool makes).
//
// On in development, with its dashboard at /_wizelens on this service. In
// production it runs only with WIZELENS_ENABLED=true (set in
// k8s/apps/mcp-site.yaml), and then it is SEND-ONLY: traces go to WIZELENS_HUB
// (WizeLens Cloud) with WIZELENS_HUB_TOKEN, sampled by WIZELENS_SAMPLE_RATE,
// and `/_wizelens` serves no dashboard or read API. Off in tests.

import { createWizeLens, wizelensFastify } from '@wizeworks/lens-node';
import { env } from './env.js';

const enabled = env.NODE_ENV === 'development' || process.env.WIZELENS_ENABLED === 'true';

export const wizelens = createWizeLens({ serviceName: 'mcp-site', enabled });

/** Fastify plugin. Register before every other plugin so its span wraps them all. */
export const wizelensPlugin = wizelensFastify(wizelens);
