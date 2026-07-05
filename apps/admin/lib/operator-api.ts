import { createOperatorApiClient } from '@sparx/operator';

// Server-only factory for the api-rest /internal/operator/* client (docs/apps/
// admin/build-plan.md §2 D6). Reads the in-cluster api-rest origin + the shared
// internal token from env. NEVER import this into a client component — the token
// must never reach the browser.
export function operatorApi() {
  const baseUrl = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';
  const token = process.env.SPARX_INTERNAL_OPERATOR_TOKEN ?? '';
  return createOperatorApiClient({ baseUrl, token });
}
