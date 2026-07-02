// Typed fetch wrapper over the public storefront REST API (docs/113 §3.3).
//
// Injects the resolved `?tenant=&property=` on every call, relays the guest
// cart token (`x-cart-token`) and — Phase 2 — the customer session cookie,
// unwraps the `{ success, data, meta }` envelope (packages/api-core/envelope),
// and turns a non-2xx / `success:false` body into a StorefrontApiError the tool
// layer can surface to the LLM. No SDK, no DB — just the public API contract.

import type { StorefrontCtx } from './types.js';

/** Pagination/facet metadata echoed from a paged public route. */
export interface StorefrontMeta {
  page?: number;
  per_page?: number;
  total?: number;
  total_pages?: number;
  next_cursor?: string | null;
  [key: string]: unknown;
}

export interface StorefrontResponse<T = unknown> {
  data: T;
  meta?: StorefrontMeta;
}

/** A public-API call that failed. `status` is the HTTP status; `code` is the
 *  platform error code (e.g. `MODULE_DISABLED`, `NOT_FOUND`) when present. */
export class StorefrontApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'StorefrontApiError';
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface StorefrontRequest {
  method: HttpMethod;
  /** Path under the api-rest origin, e.g. `/v1/public/commerce/products`. */
  path: string;
  /** Extra query params (tenant/property are injected automatically). */
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  /** Guest cart ownership token → `x-cart-token` header. */
  cartToken?: string;
}

interface EnvelopeBody {
  success?: boolean;
  data?: unknown;
  meta?: StorefrontMeta;
  error?: unknown;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export class StorefrontApiClient {
  /**
   * @param baseUrl api-rest origin (e.g. `http://localhost:3100` /
   *                `http://api-rest.sparx-prod.svc.cluster.local:3000`).
   * @param ctx     resolved storefront (tenant + optional property + session).
   */
  constructor(
    private readonly baseUrl: string,
    private readonly ctx: StorefrontCtx
  ) {}

  async request<T = unknown>(req: StorefrontRequest): Promise<StorefrontResponse<T>> {
    const url = new URL(req.path, this.baseUrl);
    url.searchParams.set('tenant', this.ctx.tenantSlug);
    if (this.ctx.propertySlug) url.searchParams.set('property', this.ctx.propertySlug);
    for (const [k, v] of Object.entries(req.query ?? {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }

    const headers: Record<string, string> = { accept: 'application/json' };
    if (req.body !== undefined) headers['content-type'] = 'application/json';
    if (req.cartToken) headers['x-cart-token'] = req.cartToken;
    // Returning-customer credential (customer-tier tools). The MCP holds a bearer;
    // the concierge holds a cookie. api-rest accepts either (lib/customer-session).
    if (this.ctx.customerBearer) {
      headers.authorization = `Bearer ${this.ctx.customerBearer}`;
    } else if (this.ctx.customerSession) {
      headers.cookie = `sparx_customer_session=${this.ctx.customerSession}`;
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: req.method,
        headers,
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new StorefrontApiError(
        0,
        'UPSTREAM_UNREACHABLE',
        `storefront API unreachable: ${message}`
      );
    }

    const text = await res.text();
    let parsed: EnvelopeBody | null = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as EnvelopeBody;
      } catch {
        parsed = null;
      }
    }

    if (!res.ok || parsed?.success !== true) {
      const err = isRecord(parsed?.error) ? parsed.error : {};
      const code = typeof err.code === 'string' ? err.code : `HTTP_${res.status}`;
      const message =
        typeof err.message === 'string' ? err.message : `request failed (${res.status})`;
      throw new StorefrontApiError(res.status, code, message);
    }

    return { data: parsed.data as T, meta: parsed.meta };
  }
}
