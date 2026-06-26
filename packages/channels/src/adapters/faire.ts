// Faire adapter — the bidirectional WHOLESALE ORDER-shape channel (docs/106). Faire
// owns checkout: sparx pushes the catalog OUT, INGESTS the orders Faire captures (the
// ONLY P3 order channel with order WEBHOOKS), pushes tracking + inventory BACK, and
// pages orders for analytics. Pure `fetch` against the Faire External API v2 — NO SDKs;
// the channel-sync-worker owns every DB write.
//
// DUAL INGEST — webhook AND poll. The public app-level webhook calls `ingestOrder`
// (verified by `verifyWebhook`, routed by `webhookShopId`); `fetchOrders` is the polling
// backup that re-ingests anything a missed webhook dropped. Both funnel through the SAME
// private `normalizeOrder`, so the worker's idempotent commit (keyed on `externalId`)
// dedupes a webhook-ingested order against a polled one.
//
// CENTS-NATIVE. Faire expresses every price in integer cents already
// (`wholesale_price_cents`, `price_cents`, `commission_cents`), so sparx's cents pass
// straight through — no `/100` decimal round-trip anywhere.
//
// Auth: Faire partner-app OAuth 2.0. The platform `application_id`/`application_secret`
// are sparx's registered creds (FAIRE_CLIENT_ID / FAIRE_CLIENT_SECRET); post-exchange we
// resolve the connected BRAND and carry its id as `externalId`.
//
// !! UNCERTAINTY — Faire's partner surface is gated behind brand-partner approval and its
// exact field names vary by app version. The OAuth token fields, auth-header name, webhook
// signature header, shipments body, and webhook brand-id routing key below are BEST-EFFORT
// and MUST be reconciled at approval. Each is flagged inline + in the PR report.
//
// Faire External API reference: https://faire.github.io/external-api-v2-docs/

import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
  ChannelAdapter,
  ChannelAnalytics,
  ChannelAuth,
  ChannelConnectContext,
  ChannelFulfillment,
  ChannelInventoryUpdate,
  ChannelOrderPollCursor,
  ChannelPeriod,
  ChannelProductInput,
  ChannelProductRef,
  ChannelTokens,
  ChannelWebhookRequest,
  NormalizedChannelOrder,
} from '../types.js';
import {
  describeResponse,
  expiresInSeconds,
  fetchT,
  readPlatformCreds,
  requireCreds,
  type PlatformOAuthCreds,
} from './_http.js';

// ── Endpoints + env var names ───────────────────────────────────────────────────

const AUTH_URL = 'https://faire.com/oauth2/authorize';
const TOKEN_URL = 'https://www.faire.com/api/external-api-oauth2/token';
const API_BASE = 'https://www.faire.com/external-api/v2';
// Faire's partner OAuth grant scopes — read + write on products and orders.
const SCOPE = 'READ_PRODUCTS WRITE_PRODUCTS READ_ORDERS WRITE_ORDERS';

const ID_VAR = 'FAIRE_CLIENT_ID';
const SECRET_VAR = 'FAIRE_CLIENT_SECRET';
// Optional — the shared secret Faire signs webhook bodies with. Unset → verifyWebhook
// returns false (the public webhook rejects until ops provisions it).
const WEBHOOK_SECRET_VAR = 'FAIRE_WEBHOOK_SECRET';

// !! UNCERTAIN — the auth header name. Faire's documented convention is the custom
// `X-FAIRE-OAUTH-ACCESS-TOKEN` header (NOT a standard `Authorization: Bearer`). Confirm
// against the approved partner app — some app versions accept the bearer form instead.
const TOKEN_HEADER = 'X-FAIRE-OAUTH-ACCESS-TOKEN';

const ORDERS_PAGE_SIZE = 50;
// Cap the order pagination so a runaway window can't loop unbounded (poll + analytics).
const ORDERS_PAGE_CAP = 50;
// Multiplier applied to the wholesale cents to seed a retail (MSRP) price when sparx
// doesn't model a separate MSRP — Faire requires both on a wholesale listing.
const RETAIL_MULTIPLIER = 2;

// ── Faire API response shapes ───────────────────────────────────────────────────

interface FaireTokenResponse {
  // !! UNCERTAIN — exact OAuth response field names vary by Faire app version. These
  // are the documented v2 names; the brand id may arrive as `brand_id`, `brand_token`,
  // or be absent (then we resolve it via GET /brand). Reconcile at partner approval.
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  brand_id?: string;
  brand_token?: string;
}

interface FaireBrand {
  id: string;
  name?: string;
}

interface FaireBrandResponse {
  // GET /brand returns either the brand object directly or wrapped under `brand`.
  id?: string;
  name?: string;
  brand?: FaireBrand;
}

interface FaireCreatedVariant {
  id: string;
  sku?: string;
}

interface FaireCreatedProduct {
  id: string;
  variants?: FaireCreatedVariant[];
}

interface FaireOrderItem {
  sku?: string | null;
  product_id?: string | null;
  variant_id?: string | null;
  quantity?: number | null;
  // Cents-native: Faire already expresses the per-unit price in integer cents.
  price_cents?: number | null;
}

interface FaireOrderAddress {
  name?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  phone_number?: string | null;
}

interface FaireRetailer {
  name?: string | null;
  email?: string | null;
}

interface FaireOrder {
  id: string;
  state?: string | null;
  created_at?: string | null;
  currency?: string | null;
  // Faire's marketplace commission on this order, in cents (when present).
  commission_cents?: number | null;
  retailer?: FaireRetailer | null;
  address?: FaireOrderAddress | null;
  items?: FaireOrderItem[] | null;
}

interface FaireOrderList {
  orders?: FaireOrder[];
  // Pagination — Faire surfaces a `cursor` (newer) and/or page index across versions.
  cursor?: string | null;
  page?: number | null;
}

// Webhook envelopes Faire may POST: the bare order, `{order_id}`, or `{data:{order}}`.
interface FaireWebhookEnvelope {
  order_id?: string;
  brand_id?: string;
  brand_token?: string;
  data?: {
    order?: FaireOrder;
    brand_id?: string;
    order_id?: string;
  };
  // The bare-order shape also carries these top-level fields.
  id?: string;
  state?: string;
}

export class FaireAdapter implements ChannelAdapter {
  readonly id = 'faire' as const;
  readonly name = 'Faire';
  readonly shape = 'order' as const;

  // Re-read in each method that needs the creds (process.env can change between a
  // cold isConfigured() check and a later connect/push call).
  private creds(): PlatformOAuthCreds | null {
    return readPlatformCreds(ID_VAR, SECRET_VAR);
  }

  // !! UNCERTAIN — auth header. Faire's documented convention is the custom
  // `X-FAIRE-OAUTH-ACCESS-TOKEN` header carrying the raw access token (no `Bearer`
  // prefix), alongside a JSON content type. Reconcile at partner approval.
  private headers(accessToken: string): Record<string, string> {
    return {
      [TOKEN_HEADER]: accessToken,
      'Content-Type': 'application/json',
    };
  }

  isConfigured(): boolean {
    return this.creds() !== null;
  }

  // ── install / auth ───────────────────────────────────────────────────────────────

  connectUrl(ctx: ChannelConnectContext): string {
    const { clientId } = requireCreds(this.creds(), this.name);
    // Faire's authorize endpoint keys the app by `application_id` and the callback by
    // `redirect_url` (NOT the OAuth-standard `redirect_uri`). Scopes are space-joined.
    const params = new URLSearchParams({
      application_id: clientId,
      redirect_url: ctx.redirectUri,
      state: ctx.state,
      scope: SCOPE,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, ctx: ChannelConnectContext): Promise<ChannelTokens> {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    // !! UNCERTAIN — token request field names. Faire's documented partner grant posts
    // a JSON body keyed by `application_id` / `application_secret` / `redirect_url` with
    // an upper-case `grant_type`. These vary by app version; finalize at approval.
    const res = await fetchT(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        application_id: clientId,
        application_secret: clientSecret,
        redirect_url: ctx.redirectUri,
        grant_type: 'AUTHORIZATION_CODE',
        authorization_code: code,
        scope: SCOPE,
      }),
    });
    if (!res.ok) {
      throw new Error(`Faire token exchange failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as FaireTokenResponse;

    // Resolve the brand: prefer the id the token response carries, else look it up.
    const brand = await this.resolveBrand(data);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: expiresInSeconds(data.expires_in, 3600),
      scope: data.scope ?? SCOPE,
      externalId: brand?.id,
      shopName: brand?.name,
    };
  }

  /** Resolve the connected brand (id + name). Prefers the token response's brand id;
   *  falls back to GET /brand. Best-effort — a hiccup here doesn't fail the connect, the
   *  worker can re-resolve later (it just leaves `externalId` undefined for now). */
  private async resolveBrand(token: FaireTokenResponse): Promise<FaireBrand | undefined> {
    const tokenBrandId = token.brand_id ?? token.brand_token;
    if (tokenBrandId) return { id: tokenBrandId };
    try {
      const res = await fetchT(`${API_BASE}/brand`, { headers: this.headers(token.access_token) });
      if (!res.ok) return undefined;
      const body = (await res.json()) as FaireBrandResponse;
      const id = body.brand?.id ?? body.id;
      if (!id) return undefined;
      return { id, name: body.brand?.name ?? body.name };
    } catch {
      return undefined;
    }
  }

  async refresh(refreshToken: string): Promise<ChannelTokens> {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    // Same token endpoint, REFRESH_TOKEN grant. !! UNCERTAIN — Faire may or may not
    // rotate the refresh token; we surface whatever it returns.
    const res = await fetchT(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        application_id: clientId,
        application_secret: clientSecret,
        grant_type: 'REFRESH_TOKEN',
        refresh_token: refreshToken,
        scope: SCOPE,
      }),
    });
    if (!res.ok) {
      throw new Error(`Faire token refresh failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as FaireTokenResponse;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: expiresInSeconds(data.expires_in, 3600),
      scope: data.scope ?? SCOPE,
    };
  }

  // ── catalog out ──────────────────────────────────────────────────────────────────

  async pushProduct(auth: ChannelAuth, product: ChannelProductInput): Promise<ChannelProductRef> {
    // Cents-native: wholesale_price_cents is sparx's priceCents verbatim. Faire wants a
    // retail (MSRP) price too — seed it from the wholesale cents until sparx models MSRP.
    const body = {
      name: product.title,
      description: product.description ?? product.title,
      variants: product.variants.map((v) => ({
        sku: v.sku,
        prices: [
          {
            wholesale_price_cents: v.priceCents,
            retail_price_cents: Math.round(v.priceCents * RETAIL_MULTIPLIER),
            currency: product.currency,
          },
        ],
        available_quantity: v.availableQuantity,
      })),
    };

    const res = await fetchT(`${API_BASE}/products`, {
      method: 'POST',
      headers: this.headers(auth.accessToken),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Faire product create failed: ${await describeResponse(res)}`);
    }
    const created = (await res.json()) as FaireCreatedProduct;

    // Match each sparx variant to the returned Faire variant by sku to recover its id.
    const createdVariants = created.variants ?? [];
    return {
      externalProductId: created.id,
      variants: product.variants.map((v) => {
        const matched = createdVariants.find((cv) => cv.sku === v.sku);
        return {
          variantId: v.variantId,
          externalSku: v.sku,
          externalVariantId: matched?.id,
        };
      }),
    };
  }

  // The worker passes the Faire product id (our externalProductId). DELETE is the
  // documented removal; a 404 means it's already gone — treat as success so deletes
  // stay idempotent. (Faire also exposes a PATCH-to-INACTIVE path; DELETE is preferred
  // here as the cleaner removal — see the PR report.)
  async removeProduct(auth: ChannelAuth, externalProductId: string): Promise<void> {
    const res = await fetchT(`${API_BASE}/products/${encodeURIComponent(externalProductId)}`, {
      method: 'DELETE',
      headers: this.headers(auth.accessToken),
    });
    if (res.ok || res.status === 404) return;
    throw new Error(`Faire product delete failed: ${await describeResponse(res)}`);
  }

  // ── order ingest (WEBHOOK) ─────────────────────────────────────────────────────────

  /** Normalize an inbound webhook payload. Faire may POST the bare order object, a
   *  `{order_id}` reference, or `{data:{order}}` — we narrow `unknown` and, when handed
   *  only an id, GET the full order before normalizing through `normalizeOrder`. */
  async ingestOrder(auth: ChannelAuth, payload: unknown): Promise<NormalizedChannelOrder> {
    const order = await this.resolveOrderFromPayload(auth, payload);
    return this.normalizeOrder(order);
  }

  /** Extract a full FaireOrder from a webhook payload, fetching it by id if the payload
   *  carries only a reference. Throws when neither an order nor an id can be found. */
  private async resolveOrderFromPayload(auth: ChannelAuth, payload: unknown): Promise<FaireOrder> {
    const env = (payload ?? {}) as FaireWebhookEnvelope;

    // 1. Already the full order, nested or bare (a bare order has an `id` + `items`).
    const embedded = env.data?.order ?? (env.id ? (env as unknown as FaireOrder) : undefined);
    if (embedded?.id && embedded.items) return embedded;

    // 2. Only an id — fetch the full order.
    const orderId = env.order_id ?? env.data?.order_id ?? embedded?.id;
    if (!orderId) {
      throw new Error('Faire order webhook payload is missing an order id.');
    }
    return this.getOrder(auth, orderId);
  }

  /** GET a single order by id. */
  private async getOrder(auth: ChannelAuth, orderId: string): Promise<FaireOrder> {
    const res = await fetchT(`${API_BASE}/orders/${encodeURIComponent(orderId)}`, {
      headers: this.headers(auth.accessToken),
    });
    if (!res.ok) {
      throw new Error(`Faire get order failed: ${await describeResponse(res)}`);
    }
    return (await res.json()) as FaireOrder;
  }

  /** The SHARED order normalizer — both `ingestOrder` (webhook) and `fetchOrders`
   *  (poll) funnel through here so a webhook-ingested order and a polled order produce
   *  byte-for-byte identical NormalizedChannelOrders for the idempotent commit. */
  private normalizeOrder(order: FaireOrder): NormalizedChannelOrder {
    const addr = order.address ?? null;
    const shippingAddress: NormalizedChannelOrder['shippingAddress'] = addr
      ? {
          name: addr.name ?? order.retailer?.name ?? '',
          line1: addr.address1 ?? '',
          line2: addr.address2 ?? undefined,
          city: addr.city ?? '',
          region: addr.state ?? undefined,
          postalCode: addr.postal_code ?? '',
          countryCode: addr.country_code ?? '',
          phone: addr.phone_number ?? undefined,
        }
      : null;

    const items = order.items ?? [];
    // Faire is cents-native — price_cents passes straight through, no decimal round-trip.
    const lines = items.map((item) => ({
      externalSku: item.sku ?? '',
      externalVariantId: item.variant_id ?? undefined,
      quantity: item.quantity ?? 0,
      unitPriceCents: item.price_cents ?? 0,
    }));

    return {
      externalId: order.id,
      externalStatus: order.state ?? '',
      // Faire created_at is an ISO timestamp already; normalize through Date for safety.
      placedAt: order.created_at
        ? new Date(order.created_at).toISOString()
        : new Date().toISOString(),
      currency: this.deriveCurrency(order),
      customer: {
        email: order.retailer?.email ?? null,
        name: order.address?.name ?? order.retailer?.name ?? null,
        phone: order.address?.phone_number ?? null,
      },
      shippingAddress,
      lines,
      ...this.deriveFee(order),
    };
  }

  /** Resolve the order currency — the order field, else fall back to a sensible default. */
  private deriveCurrency(order: FaireOrder): string {
    return order.currency ?? 'USD';
  }

  /** Marketplace commission, in cents, when Faire exposes it on the order. */
  private deriveFee(order: FaireOrder): { channelFeeCents?: number } {
    const raw = order.commission_cents;
    if (raw === undefined || raw === null) return {};
    return Number.isFinite(raw) ? { channelFeeCents: raw } : {};
  }

  // ── order ingest (POLL backup) ─────────────────────────────────────────────────────

  /** Polling backup for the webhook path: pull orders updated since the cursor and
   *  normalize each EXACTLY like `ingestOrder` (shared `normalizeOrder`). Paginates via
   *  Faire's `cursor`/`page` until a short page or the page cap. */
  async fetchOrders(
    auth: ChannelAuth,
    opts: ChannelOrderPollCursor
  ): Promise<NormalizedChannelOrder[]> {
    // Faire's `updated_at_min` is epoch MILLISECONDS.
    const updatedAtMin = new Date(opts.since).getTime();

    const orders: NormalizedChannelOrder[] = [];
    let cursor: string | undefined;
    let page = 1;

    for (let i = 0; i < ORDERS_PAGE_CAP; i += 1) {
      const list = await this.listOrders(auth, updatedAtMin, undefined, cursor, page);
      const batch = list.orders ?? [];
      for (const order of batch) {
        orders.push(this.normalizeOrder(order));
      }

      // Advance: prefer an explicit cursor; else page-index forward. Stop on a short
      // page (no more) or when neither cursor nor a full page is available.
      const nextCursor = list.cursor ?? undefined;
      if (batch.length < ORDERS_PAGE_SIZE) break;
      if (nextCursor) {
        cursor = nextCursor;
      } else {
        page += 1;
      }
    }
    return orders;
  }

  /** GET /orders for a time window with optional cursor/page paging. `updatedAtMax` is
   *  used by analytics to bound the window's upper edge; the poll omits it. */
  private async listOrders(
    auth: ChannelAuth,
    updatedAtMin: number,
    updatedAtMax: number | undefined,
    cursor: string | undefined,
    page: number
  ): Promise<FaireOrderList> {
    const query = new URLSearchParams({
      updated_at_min: String(updatedAtMin),
      limit: String(ORDERS_PAGE_SIZE),
    });
    if (updatedAtMax !== undefined) query.set('updated_at_max', String(updatedAtMax));
    if (cursor) query.set('cursor', cursor);
    else query.set('page', String(page));

    const res = await fetchT(`${API_BASE}/orders?${query.toString()}`, {
      headers: this.headers(auth.accessToken),
    });
    if (!res.ok) {
      throw new Error(`Faire fetch orders failed: ${await describeResponse(res)}`);
    }
    return (await res.json()) as FaireOrderList;
  }

  // ── fulfillment push ───────────────────────────────────────────────────────────────

  // !! UNCERTAIN — shipments body shape. Faire's documented endpoint creates shipments
  // under an order; the field names (`carrier`, `tracking_code`, `tracking_url`) and the
  // `{shipments:[...]}` envelope are best-effort from the published surface. Reconcile at
  // partner approval.
  async pushFulfillment(auth: ChannelAuth, fulfillment: ChannelFulfillment): Promise<void> {
    const body = {
      shipments: [
        {
          carrier: fulfillment.carrier,
          tracking_code: fulfillment.trackingNumber,
          ...(fulfillment.trackingUrl ? { tracking_url: fulfillment.trackingUrl } : {}),
        },
      ],
    };
    const res = await fetchT(
      `${API_BASE}/orders/${encodeURIComponent(fulfillment.externalOrderId)}/shipments`,
      { method: 'POST', headers: this.headers(auth.accessToken), body: JSON.stringify(body) }
    );
    if (!res.ok) {
      throw new Error(`Faire push fulfillment failed: ${await describeResponse(res)}`);
    }
  }

  // ── inventory push ─────────────────────────────────────────────────────────────────

  /** Faire updates inventory PER VARIANT (product id + variant id), so the worker must
   *  pass the external variant id — without it the targeted variant is unknown. */
  async pushInventory(auth: ChannelAuth, update: ChannelInventoryUpdate): Promise<void> {
    if (!update.externalProductId) {
      throw new Error('Faire inventory update requires the external product id.');
    }
    if (!update.externalVariantId) {
      throw new Error('Faire inventory update requires the external variant id.');
    }
    const res = await fetchT(
      `${API_BASE}/products/${encodeURIComponent(update.externalProductId)}/variants/${encodeURIComponent(
        update.externalVariantId
      )}`,
      {
        method: 'PATCH',
        headers: this.headers(auth.accessToken),
        body: JSON.stringify({ available_quantity: update.availableQuantity }),
      }
    );
    if (!res.ok) {
      throw new Error(`Faire inventory update failed: ${await describeResponse(res)}`);
    }
  }

  // ── analytics ──────────────────────────────────────────────────────────────────────

  /** Page /orders across the window and sum line revenue (price_cents * quantity, all
   *  cents-native) + order count. Bounds the upper window edge with `updated_at_max`. */
  async getAnalytics(auth: ChannelAuth, period: ChannelPeriod): Promise<ChannelAnalytics> {
    const updatedAtMin = new Date(period.start).getTime();
    const updatedAtMax = new Date(period.end).getTime();

    let revenueCents = 0;
    let orderCount = 0;
    let cursor: string | undefined;
    let page = 1;

    for (let i = 0; i < ORDERS_PAGE_CAP; i += 1) {
      const list = await this.listOrders(auth, updatedAtMin, updatedAtMax, cursor, page);
      const batch = list.orders ?? [];
      for (const order of batch) {
        for (const item of order.items ?? []) {
          revenueCents += (item.price_cents ?? 0) * (item.quantity ?? 0);
        }
        orderCount += 1;
      }
      const nextCursor = list.cursor ?? undefined;
      if (batch.length < ORDERS_PAGE_SIZE) break;
      if (nextCursor) cursor = nextCursor;
      else page += 1;
    }

    return { revenueCents, orderCount };
  }

  // ── webhook verification ─────────────────────────────────────────────────────────

  /** Verify an inbound webhook: HMAC-SHA256 of FAIRE_WEBHOOK_SECRET over the raw body,
   *  hex, compared in constant time to the signature header. Unset secret → false (the
   *  public webhook rejects until ops provisions it). Mirrors TikTok's timing-safe path. */
  verifyWebhook(req: ChannelWebhookRequest): boolean {
    const secret = process.env[WEBHOOK_SECRET_VAR];
    if (!secret) return false;
    // !! UNCERTAIN — webhook signature header name. Faire's documented header is
    // `X-Faire-Hmac-Sha256`; tolerate the lower-case + `x-faire-signature` variants.
    const header =
      this.headerValue(req, 'x-faire-hmac-sha256') ??
      this.headerValue(req, 'x-faire-signature') ??
      this.headerValue(req, 'faire-hmac-sha256');
    if (!header) return false;
    try {
      const expected = createHmac('sha256', secret).update(req.rawBody).digest('hex');
      const a = Buffer.from(expected, 'utf8');
      const b = Buffer.from(header, 'utf8');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  // !! UNCERTAIN — webhook brand-id routing key. Faire's order webhook is app-level (one
  // URL for every tenant), so the public webhook resolves the tenant from the brand id in
  // the payload. The exact field name varies by app version; we read the documented
  // `brand_id` / `data.brand_id` / `brand_token` candidates. Reconcile at approval.
  webhookShopId(payload: unknown): string | null {
    if (payload && typeof payload === 'object') {
      const env = payload as FaireWebhookEnvelope;
      const id = env.brand_id ?? env.data?.brand_id ?? env.brand_token;
      if (typeof id === 'string' && id) return id;
    }
    return null;
  }

  // ── internals ────────────────────────────────────────────────────────────────────

  /** Read a single header value (Faire sends scalar header strings). */
  private headerValue(req: ChannelWebhookRequest, name: string): string | undefined {
    const value = req.headers[name];
    if (Array.isArray(value)) return value[0];
    return value ?? undefined;
  }
}
