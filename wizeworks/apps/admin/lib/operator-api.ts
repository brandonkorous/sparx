import { headers } from 'next/headers';
import { forwardedFor } from '@wizeworks/app-kit/forwarded-for';
import { createOperatorApiClient } from '@wizeworks/operator';

// Server-only factory for the api-rest /internal/operator/* client (docs/apps/
// admin/build-plan.md §2 D6). Reads the in-cluster api-rest origin + the shared
// internal token from env. NEVER import this into a client component — the token
// must never reach the browser.
//
// Every call carries the operator's own client chain. Operator reads are all
// `no-store` (the client sets it), so there is no data-cache key to fragment, and
// without it api-rest would rate-limit and record this pod — one address for
// every operator — rather than the person at the console. The headers are read
// lazily, per request, so this is only ever resolved inside a console page or
// server action, which is the only place `operatorApi()` is called from.
export function operatorApi() {
  const baseUrl = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';
  const token = process.env.SPARX_INTERNAL_OPERATOR_TOKEN ?? '';
  return createOperatorApiClient({
    baseUrl,
    token,
    requestHeaders: async () => forwardedFor(await headers()),
  });
}
