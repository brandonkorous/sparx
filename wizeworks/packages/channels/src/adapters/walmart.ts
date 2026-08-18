// Walmart Marketplace adapter — the bidirectional ORDER-shape channel (docs/106).
// Like TikTok (and unlike the feed channels Google/Meta/Pinterest), Walmart owns
// checkout: sparx pushes the catalog OUT via item feeds, POLLS the orders Walmart
// captures, pushes tracking + inventory BACK, and pulls revenue for the analytics
// breakdown. NO SDKs; pure `fetch` (via the shared `fetchT` helper), mirroring the
// dropship printify adapter. The adapter is pure I/O — the channel-sync-worker owns
// every DB write.
//
// Auth: Walmart uses CLIENT-CREDENTIALS tokens, NOT a user-redirect OAuth dance.
// There is no consumer authorize page — Solution-Provider (SP) delegated access is
// finalized at partner approval, after which each seller's API client id/secret are
// the platform creds. `POST /v3/token` with HTTP Basic over the client id/secret and
// `grant_type=client_credentials` returns a short-lived (~900s) bearer token with NO
// refresh token, so `refresh` simply re-mints one the same way `exchangeCode` does.
//
// Required headers on EVERY call: `WM_SEC.ACCESS_TOKEN` (the bearer), a fresh
// `WM_QOS.CORRELATION_ID` (a per-request UUID Walmart echoes in support traces),
// `WM_SVC.NAME`, plus JSON Accept/Content-Type.
//
// Ingest is POLL-only (Walmart has no first-class order webhook for SP integrations),
// so `verifyWebhook`/`webhookShopId`/`ingestOrder` are intentionally omitted — the
// scheduled poller drives `fetchOrders` per connection and advances the cursor.
//
// Walmart Marketplace API docs: https://developer.walmart.com/

import { randomUUID } from 'node:crypto';

import type {
  ChannelAdapter,
  ChannelAnalytics,
  ChannelAuth,
  ChannelConnectContext,
  ChannelFulfillment,
  ChannelInventoryUpdate,
  ChannelOrderLine,
  ChannelOrderPollCursor,
  ChannelPeriod,
  ChannelProductInput,
  ChannelProductRef,
  ChannelTokens,
  NormalizedChannelOrder,
} from '../types.js';
import {
  basicAuth,
  describeResponse,
  expiresInSeconds,
  fetchT,
  formBody,
  readPlatformCreds,
  requireCreds,
  type PlatformOAuthCreds,
} from './_http.js';

const API_BASE = 'https://marketplace.walmartapis.com/v3';
const TOKEN_URL = `${API_BASE}/token`;
const SVC_NAME = 'Walmart Marketplace';

const ID_VAR = 'WALMART_CLIENT_ID';
const SECRET_VAR = 'WALMART_CLIENT_SECRET';

// Walmart prices/charges are decimal currency strings; sparx stores integer cents.
const CURRENCY = 'USD';
// Cap the order pages we walk per poll/analytics window (defends against a runaway
// cursor; the poller re-runs to drain a deep backlog with a fresh `since`).
const ORDER_PAGE_CAP = 20;

// ── Walmart token + order payload shapes ────────────────────────────────────────

interface WalmartTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

interface WalmartAmount {
  currency?: string;
  amount?: string | number;
}

interface WalmartCharge {
  chargeType?: string;
  chargeName?: string;
  chargeAmount?: WalmartAmount;
}

interface WalmartOrderLineStatus {
  status?: string;
}

interface WalmartOrderLine {
  lineNumber?: string;
  item?: { sku?: string; productName?: string };
  orderLineQuantity?: { unitOfMeasurement?: string; amount?: string | number };
  charges?: { charge?: WalmartCharge[] };
  orderLineStatuses?: { orderLineStatus?: WalmartOrderLineStatus[] };
}

interface WalmartPostalAddress {
  name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

interface WalmartShippingInfo {
  phone?: string;
  estimatedDeliveryDate?: string;
  estimatedShipDate?: string;
  methodCode?: string;
  postalAddress?: WalmartPostalAddress;
}

interface WalmartOrder {
  purchaseOrderId?: string;
  customerOrderId?: string;
  customerEmailId?: string;
  orderDate?: number | string;
  shippingInfo?: WalmartShippingInfo;
  orderLines?: { orderLine?: WalmartOrderLine[] };
}

interface WalmartOrdersResponse {
  list?: {
    meta?: { totalCount?: number; nextCursor?: string };
    elements?: { order?: WalmartOrder[] };
  };
}

export class WalmartAdapter implements ChannelAdapter {
  readonly id = 'walmart' as const;
  readonly name = 'Walmart Marketplace';
  readonly shape = 'order' as const;

  // Re-read in each method that needs the creds (process.env can change between a
  // cold isConfigured() check and a later connect/push call).
  private creds(): PlatformOAuthCreds | null {
    return readPlatformCreds(ID_VAR, SECRET_VAR);
  }

  isConfigured(): boolean {
    return this.creds() !== null;
  }

  // ── install / auth ───────────────────────────────────────────────────────────────

  // Walmart has NO consumer authorize page: SP delegated access is finalized at
  // partner approval, and each seller's API client id/secret ARE the platform creds.
  // We return the developer landing as a sensible destination, but the api-rest layer
  // reports the channel `coming_soon` until creds are set, so this is never hit live
  // prematurely — connect is via per-seller API credentials / SP delegation.
  connectUrl(_ctx: ChannelConnectContext): string {
    return 'https://developer.walmart.com/';
  }

  // The `code` is unused — Walmart issues tokens from the SP client-credentials grant,
  // not an authorization-code exchange. We mint a token to prove the creds work and
  // carry the client id as the seller/partner identity.
  async exchangeCode(_code: string, _ctx: ChannelConnectContext): Promise<ChannelTokens> {
    return this.mintTokens();
  }

  // No refresh token — re-mint via the same client-credentials grant as exchangeCode.
  async refresh(_refreshToken: string): Promise<ChannelTokens> {
    return this.mintTokens();
  }

  /** Mint ChannelTokens from a fresh client-credentials token (no refresh token). */
  private async mintTokens(): Promise<ChannelTokens> {
    const { clientId } = requireCreds(this.creds(), this.name);
    const token = await this.fetchToken();
    return {
      accessToken: token.access_token,
      expiresInSeconds: expiresInSeconds(token.expires_in, 900),
      externalId: clientId,
      shopName: 'Walmart Marketplace',
    };
  }

  /** Client-credentials token fetch shared by exchangeCode + refresh. */
  private async fetchToken(): Promise<WalmartTokenResponse> {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    const res = await fetchT(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(clientId, clientSecret),
        'WM_SVC.NAME': SVC_NAME,
        'WM_QOS.CORRELATION_ID': randomUUID(),
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody({ grant_type: 'client_credentials' }),
    });
    if (!res.ok) {
      throw new Error(`Walmart token fetch failed: ${await describeResponse(res)}`);
    }
    return (await res.json()) as WalmartTokenResponse;
  }

  /** Per-call headers every business endpoint requires (fresh correlation id each). */
  private headers(auth: ChannelAuth): Record<string, string> {
    return {
      'WM_SEC.ACCESS_TOKEN': auth.accessToken,
      'WM_QOS.CORRELATION_ID': randomUUID(),
      'WM_SVC.NAME': SVC_NAME,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  // ── catalog out ────────────────────────────────────────────────────────────────────

  // Walmart item publishing is ASYNC via FEEDS: we submit an MP_ITEM feed and Walmart
  // processes it out-of-band (the feed id can be polled for per-item status). The
  // minimal MPItemFeedHeader + per-variant Item body below is the publishing contract;
  // the FULL MP_ITEM spec (category-specific required attributes, fulfillment/shipping
  // templates, variant grouping) is a go-live refinement once a category model exists.
  async pushProduct(auth: ChannelAuth, product: ChannelProductInput): Promise<ChannelProductRef> {
    const [mainImageUrl] = product.imageUrls;
    const body = {
      MPItemFeedHeader: {
        sellingChannel: 'mpsetupbymatch',
        version: '4.2',
        locale: 'en',
      },
      MPItem: product.variants.map((variant) => ({
        Item: {
          sku: variant.sku,
          productName: variant.title || product.title,
          price: (variant.priceCents / 100).toFixed(2),
          shortDescription: product.description ?? product.title,
          ...(mainImageUrl ? { mainImageUrl } : {}),
          ...(product.brand ? { brand: product.brand } : {}),
        },
      })),
    };

    const res = await fetchT(`${API_BASE}/feeds?feedType=MP_ITEM`, {
      method: 'POST',
      headers: this.headers(auth),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Walmart pushProduct failed: ${await describeResponse(res)}`);
    }

    const firstSku = product.variants[0]?.sku;
    return {
      // The sku is Walmart's stable item key; the feed id is async-only, so we map by
      // sku (falling back to the sparx productId when a product has no variants).
      externalProductId: firstSku ?? product.productId,
      variants: product.variants.map((variant) => ({
        variantId: variant.variantId,
        externalSku: variant.sku,
      })),
    };
  }

  // Retire a listing by sku. Walmart retires items via the price/inventory lifecycle
  // (DELETE /items/{sku}); a 404 means it's already gone.
  async removeProduct(auth: ChannelAuth, externalProductId: string): Promise<void> {
    const res = await fetchT(`${API_BASE}/items/${encodeURIComponent(externalProductId)}`, {
      method: 'DELETE',
      headers: this.headers(auth),
    });
    if (res.ok || res.status === 404) return;
    throw new Error(`Walmart removeProduct failed: ${await describeResponse(res)}`);
  }

  // ── order ingest (POLL) ──────────────────────────────────────────────────────────

  async fetchOrders(
    auth: ChannelAuth,
    opts: ChannelOrderPollCursor
  ): Promise<NormalizedChannelOrder[]> {
    const params = new URLSearchParams({
      createdStartDate: new Date(opts.since).toISOString(),
      limit: '100',
    });
    const orders: NormalizedChannelOrder[] = [];
    for await (const order of this.walkOrders(auth, params, 'fetchOrders')) {
      const normalized = this.normalizeOrder(order);
      if (normalized) orders.push(normalized);
    }
    return orders;
  }

  /** Walk the /orders pages, yielding each raw order. Walmart returns the next page
   *  as an opaque cursor query string in `list.meta.nextCursor`. */
  private async *walkOrders(
    auth: ChannelAuth,
    params: URLSearchParams,
    op: string
  ): AsyncGenerator<WalmartOrder> {
    let path = `/orders?${params.toString()}`;
    for (let page = 0; page < ORDER_PAGE_CAP; page += 1) {
      const res = await fetchT(`${API_BASE}${path}`, {
        method: 'GET',
        headers: this.headers(auth),
      });
      if (!res.ok) {
        throw new Error(`Walmart ${op} failed: ${await describeResponse(res)}`);
      }
      const data = (await res.json()) as WalmartOrdersResponse;
      for (const order of data.list?.elements?.order ?? []) yield order;

      const nextCursor = data.list?.meta?.nextCursor;
      if (!nextCursor) break;
      // The cursor is the full `?...` query string; tolerate it with or without the `?`.
      path = nextCursor.startsWith('?') ? `/orders${nextCursor}` : `/orders?${nextCursor}`;
    }
  }

  /** Map one Walmart order → the normalized sparx order (null when it has no id). */
  private normalizeOrder(order: WalmartOrder): NormalizedChannelOrder | null {
    const externalId = order.purchaseOrderId;
    if (!externalId) return null;

    const orderLines = order.orderLines?.orderLine ?? [];
    const postalAddress = order.shippingInfo?.postalAddress;

    return {
      externalId,
      externalStatus: this.firstLineStatus(orderLines),
      placedAt: this.placedAt(order.orderDate),
      currency: CURRENCY,
      customer: {
        email: order.customerEmailId ?? null,
        name: postalAddress?.name ?? null,
      },
      shippingAddress: this.shippingAddress(order.shippingInfo),
      lines: this.orderLines(orderLines),
      ...this.deriveFee(orderLines),
    };
  }

  /** Status of the first order line, defaulting to 'Created' when none is present. */
  private firstLineStatus(orderLines: WalmartOrderLine[]): string {
    const first = orderLines[0]?.orderLineStatuses?.orderLineStatus?.[0]?.status;
    return first ?? 'Created';
  }

  /** orderDate is an epoch-millis number (or string); fall back to now if absent. */
  private placedAt(orderDate: number | string | undefined): string {
    if (orderDate === undefined) return new Date().toISOString();
    const ms = typeof orderDate === 'number' ? orderDate : Number(orderDate);
    const date = new Date(Number.isFinite(ms) ? ms : orderDate);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  private shippingAddress(
    info: WalmartShippingInfo | undefined
  ): NormalizedChannelOrder['shippingAddress'] {
    const addr = info?.postalAddress;
    if (!addr) return null;
    return {
      name: addr.name ?? '',
      line1: addr.address1 ?? '',
      ...(addr.address2 ? { line2: addr.address2 } : {}),
      city: addr.city ?? '',
      ...(addr.state ? { region: addr.state } : {}),
      postalCode: addr.postalCode ?? '',
      countryCode: addr.country ?? '',
      ...(info?.phone ? { phone: info.phone } : {}),
    };
  }

  /** Map Walmart order lines → normalized lines (PRODUCT charge = the unit price). */
  private orderLines(orderLines: WalmartOrderLine[]): ChannelOrderLine[] {
    return orderLines.map((line) => ({
      externalSku: line.item?.sku ?? '',
      quantity: this.lineQuantity(line),
      unitPriceCents: this.chargeCents(line, 'PRODUCT'),
    }));
  }

  private lineQuantity(line: WalmartOrderLine): number {
    const raw = line.orderLineQuantity?.amount;
    const n = typeof raw === 'number' ? raw : Number(raw ?? 1);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  /** Sum the charge of one type on a single line, in integer cents. */
  private chargeCents(line: WalmartOrderLine, type: string): number {
    const charges = line.charges?.charge ?? [];
    let cents = 0;
    for (const charge of charges) {
      if (charge.chargeType !== type) continue;
      const amount = charge.chargeAmount?.amount;
      const n = typeof amount === 'number' ? amount : Number(amount ?? 0);
      if (Number.isFinite(n)) cents += Math.round(n * 100);
    }
    return cents;
  }

  /** Marketplace commission across the order's lines, when Walmart reports it. */
  private deriveFee(orderLines: WalmartOrderLine[]): { channelFeeCents?: number } {
    let cents = 0;
    let seen = false;
    for (const line of orderLines) {
      for (const charge of line.charges?.charge ?? []) {
        if (charge.chargeType !== 'COMMISSION') continue;
        const amount = charge.chargeAmount?.amount;
        const n = typeof amount === 'number' ? amount : Number(amount ?? 0);
        if (Number.isFinite(n)) {
          cents += Math.round(n * 100);
          seen = true;
        }
      }
    }
    return seen ? { channelFeeCents: cents } : {};
  }

  // ── fulfillment push ─────────────────────────────────────────────────────────────

  // Shipping requires the order's LINE NUMBERS: we fetch the order first to enumerate
  // every orderLine and ship them together with the tracking number. (A future
  // refinement can ship a partial subset of lines once sparx models split shipments.)
  async pushFulfillment(auth: ChannelAuth, fulfillment: ChannelFulfillment): Promise<void> {
    const lineNumbers = await this.orderLineNumbers(auth, fulfillment.externalOrderId);
    const shipDateTime = new Date().toISOString();

    const body = {
      orderShipment: {
        orderLines: {
          orderLine: lineNumbers.map((lineNumber) => ({
            lineNumber,
            orderLineStatuses: {
              orderLineStatus: [
                {
                  status: 'Shipped',
                  trackingInfo: {
                    shipDateTime,
                    carrierName: { carrier: fulfillment.carrier },
                    methodCode: 'Standard',
                    trackingNumber: fulfillment.trackingNumber,
                    ...(fulfillment.trackingUrl ? { trackingURL: fulfillment.trackingUrl } : {}),
                  },
                },
              ],
            },
          })),
        },
      },
    };

    const res = await fetchT(
      `${API_BASE}/orders/${encodeURIComponent(fulfillment.externalOrderId)}/shipping`,
      { method: 'POST', headers: this.headers(auth), body: JSON.stringify(body) }
    );
    if (!res.ok) {
      throw new Error(`Walmart pushFulfillment failed: ${await describeResponse(res)}`);
    }
  }

  /** Fetch an order's line numbers — Walmart's shipping body is keyed by them. */
  private async orderLineNumbers(auth: ChannelAuth, purchaseOrderId: string): Promise<string[]> {
    const res = await fetchT(`${API_BASE}/orders/${encodeURIComponent(purchaseOrderId)}`, {
      method: 'GET',
      headers: this.headers(auth),
    });
    if (!res.ok) {
      throw new Error(`Walmart order lookup failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as { order?: WalmartOrder };
    const lines = data.order?.orderLines?.orderLine ?? [];
    const numbers: string[] = [];
    for (const [index, line] of lines.entries()) {
      // lineNumber is 1-based when Walmart omits it.
      numbers.push(line.lineNumber ?? String(index + 1));
    }
    if (numbers.length === 0) {
      throw new Error(`Walmart order ${purchaseOrderId} has no lines to ship.`);
    }
    return numbers;
  }

  // ── inventory push ───────────────────────────────────────────────────────────────

  async pushInventory(auth: ChannelAuth, update: ChannelInventoryUpdate): Promise<void> {
    const res = await fetchT(
      `${API_BASE}/inventory?sku=${encodeURIComponent(update.externalSku)}`,
      {
        method: 'PUT',
        headers: this.headers(auth),
        body: JSON.stringify({
          sku: update.externalSku,
          quantity: { unit: 'EACH', amount: update.availableQuantity },
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`Walmart pushInventory failed: ${await describeResponse(res)}`);
    }
  }

  // ── analytics ────────────────────────────────────────────────────────────────────

  async getAnalytics(auth: ChannelAuth, period: ChannelPeriod): Promise<ChannelAnalytics> {
    const params = new URLSearchParams({
      createdStartDate: new Date(period.start).toISOString(),
      createdEndDate: new Date(period.end).toISOString(),
      limit: '100',
    });
    let revenueCents = 0;
    let orderCount = 0;
    for await (const order of this.walkOrders(auth, params, 'getAnalytics')) {
      if (!order.purchaseOrderId) continue;
      orderCount += 1;
      for (const line of order.orderLines?.orderLine ?? []) {
        revenueCents += this.chargeCents(line, 'PRODUCT');
      }
    }
    return { revenueCents, orderCount };
  }
}
