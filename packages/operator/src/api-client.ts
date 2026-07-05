// The typed api-rest `/internal/operator/*` client (docs/apps/admin build-plan
// §2 D6). The admin app holds NO cross-tenant DB role — every byte of tenant
// business data, read or written, flows through these Layer-5 internal calls.
//
// Trust model: apps/admin is the operator trust boundary. It authenticates the
// operator (Better Auth + capabilities) BEFORE calling here, then presents a
// shared secret proving "this is the admin app" plus the operator's id for the
// audit trail. api-rest verifies the secret (constant-time, fail-closed) and
// records the operator id it was told — it does not (and cannot, as sparx_app)
// read the wize_admin capability store itself.
//
// SERVER-ONLY. The secret must never reach a browser; construct the client in
// Next server components / route handlers, never in a client component.

import type { OperatorWhoAmIResult, OperatorApiErrorBody } from './types';

/** Shared-secret header — mirrors the existing `X-sparx-Internal-*-Token`
 *  Layer-5 convention (docs/16 §2.5). */
export const INTERNAL_OPERATOR_TOKEN_HEADER = 'x-sparx-internal-operator-token';
/** Carries the authenticated operator's id so api-rest can attribute + audit
 *  the action. Trusted because it rides inside the secret-authenticated call. */
export const OPERATOR_ID_HEADER = 'x-sparx-operator-id';

export interface OperatorApiClientConfig {
  /** api-rest origin, e.g. `http://api-rest.sparx-prod:3100` in-cluster or
   *  `http://localhost:3100` in dev. */
  baseUrl: string;
  /** The shared secret (env `SPARX_INTERNAL_OPERATOR_TOKEN`). */
  token: string;
}

export interface OperatorApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** The acting operator's id — sent as the audit header. */
  operatorId: string;
  /** JSON body for write calls. */
  body?: unknown;
  /** Optional AbortSignal for request cancellation / timeouts. */
  signal?: AbortSignal;
}

export class OperatorApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'OperatorApiError';
  }
}

export interface OperatorApiClient {
  request<T>(path: string, options: OperatorApiRequestOptions): Promise<T>;
  /** Slice-1 round-trip probe (see OperatorWhoAmIResult). */
  whoami(operatorId: string, signal?: AbortSignal): Promise<OperatorWhoAmIResult>;
}

export function createOperatorApiClient(config: OperatorApiClientConfig): OperatorApiClient {
  const base = config.baseUrl.replace(/\/+$/, '');

  async function request<T>(path: string, options: OperatorApiRequestOptions): Promise<T> {
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      [INTERNAL_OPERATOR_TOKEN_HEADER]: config.token,
      [OPERATOR_ID_HEADER]: options.operatorId,
    };
    if (options.body !== undefined) headers['content-type'] = 'application/json';

    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      // Operator data must never be served from a cached edge/runtime response.
      cache: 'no-store',
    });

    if (!res.ok) {
      const err = await safeErrorBody(res);
      throw new OperatorApiError(res.status, err.code, err.message);
    }
    // 204 / empty body → undefined (typed as T by the caller's expectation).
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    request,
    whoami: (operatorId, signal) =>
      request<OperatorWhoAmIResult>('/internal/operator/whoami', { operatorId, signal }),
  };
}

async function safeErrorBody(res: Response): Promise<OperatorApiErrorBody> {
  try {
    const parsed = (await res.json()) as Partial<OperatorApiErrorBody>;
    return {
      code: parsed.code ?? 'UPSTREAM_ERROR',
      message: parsed.message ?? `api-rest returned ${res.status}`,
    };
  } catch {
    return { code: 'UPSTREAM_ERROR', message: `api-rest returned ${res.status}` };
  }
}
