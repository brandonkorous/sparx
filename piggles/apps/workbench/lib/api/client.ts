// The browser's api-rest transport.
//
// Thin wrapper over @wizeworks/api-client's SparxClient, which is already
// zero-dependency and browser-safe. Two things are added here:
//
//   1. The base URL is resolved at RUNTIME from /api/token rather than baked in
//      as a NEXT_PUBLIC_* build arg. NEXT_PUBLIC vars are compiled into the
//      bundle, which means the same image can't be promoted across environments
//      — and the token route already has to tell us the API origin anyway, so
//      taking it from there costs nothing and keeps the image portable.
//   2. `x-sparx-property-id` is attached to every request, so panes never think
//      about the active property.

import { SparxClient, type RequestOptions, type ApiResponse } from '@wizeworks/api-client';
import { getTokenState, resolveToken } from './token';

let client: SparxClient | null = null;
let clientOrigin: string | null = null;

async function getClient(): Promise<{ client: SparxClient; propertyId: string | null }> {
  const state = await getTokenState();

  // Rebuild if the origin changed under us (environment switch in dev). Cheap —
  // SparxClient holds no connections or state beyond its options.
  if (!client || clientOrigin !== state.apiUrl) {
    client = new SparxClient({
      baseUrl: state.apiUrl,
      // Lazy resolver, so a long-lived pane's requests always carry a live token
      // without the pane knowing tokens exist.
      token: resolveToken,
      userAgent: 'piggles-console',
    });
    clientOrigin = state.apiUrl;
  }

  return { client, propertyId: state.propertyId };
}

/** Issues an authenticated api-rest request from the browser. */
export async function apiRequest<T>(options: RequestOptions): Promise<ApiResponse<T>> {
  const { client: sparx, propertyId } = await getClient();

  const headers = { ...options.headers };
  if (propertyId) headers['x-sparx-property-id'] = propertyId;

  return sparx.request<T>({ ...options, headers });
}

/** Convenience readers/writers — the shape panes actually call. */
export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) =>
    apiRequest<T>({ method: 'GET', path, query }).then((r) => r.data),

  post: <T>(path: string, body?: unknown, options?: Pick<RequestOptions, 'idempotencyKey'>) =>
    apiRequest<T>({ method: 'POST', path, body, ...options }).then((r) => r.data),

  patch: <T>(path: string, body?: unknown) =>
    apiRequest<T>({ method: 'PATCH', path, body }).then((r) => r.data),

  put: <T>(path: string, body?: unknown) =>
    apiRequest<T>({ method: 'PUT', path, body }).then((r) => r.data),

  delete: <T>(path: string) => apiRequest<T>({ method: 'DELETE', path }).then((r) => r.data),

  /**
   * A paged collection: the rows AND how many there are in total.
   *
   * Separate from `get` because `get` deliberately returns just the rows — most
   * callers want exactly that and shouldn't have to unwrap. A list that pages
   * needs the count too: without it the only honest thing a screen can say is
   * "here are some", and it can offer no way to jump to the end.
   *
   * `total` is undefined when the endpoint doesn't report one, which callers
   * must treat as "unknown", never as zero.
   */
  list: <T>(path: string, query?: RequestOptions['query']) =>
    apiRequest<T[]>({ method: 'GET', path, query }).then((r) => ({
      items: r.data,
      total: typeof r.page?.total === 'number' ? r.page.total : undefined,
    })),
};

/** Drops the memoized client — call alongside clearToken() on sign-out. */
export function resetClient(): void {
  client = null;
  clientOrigin = null;
}
