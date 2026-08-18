// Amazon adapter — the bidirectional ORDER-shape channel (docs/106), and the most
// complex sparx integrates. Like TikTok/Walmart/Etsy (and unlike the feed channels
// Google/Meta/Pinterest), Amazon owns checkout: sparx pushes the catalog OUT via
// SP-API FEEDS, POLLS the Orders API for new orders, pushes tracking + inventory
// BACK (also via feeds), and pages orders for the analytics breakdown. Pure `fetch`
// against the Selling Partner API — NO SDKs; the channel-sync-worker owns every DB
// write.
//
// AUTH MODEL — LWA token ALONE, no AWS signing. Amazon REMOVED the AWS SigV4 / IAM
// role-assumption requirement from SP-API: a call now authenticates with the
// Login-with-Amazon (LWA) access token alone, sent as the `x-amz-access-token`
// header. We therefore do NOT implement AWS SigV4, STS AssumeRole, or any aws4
// signing — there is intentionally no crypto-signing path here (contrast TikTok's
// HMAC scheme). The platform creds are the LWA app's client id/secret; the per-tenant
// token is the LWA refresh→access exchange resolved by the worker.
//
// OUTBOUND via FEEDS (token-scoped — NO seller-id in any path). The Listings/Pricing
// REST APIs are seller-id-scoped (`/listings/2021-08-01/items/{sellerId}/{sku}`), but
// the worker only carries the marketplace id, not the canonical selling_partner_id
// (the callback's `selling_partner_id` would be it — see exchangeCode). The Feeds API
// 2021-06-30 is authorized by the TOKEN, so every feed path is seller-id-free. That is
// precisely why all catalog/inventory/fulfillment writes go through `submitFeed` — a
// 3-step document→S3-upload→feed-create flow — rather than the REST endpoints.
//
// INBOUND is POLL-only. Order notifications need an SQS queue + EventBridge wiring
// (the SP-API Notifications API delivers to a seller-owned SQS, not an HTTP webhook),
// which is per-tenant AWS infra sparx doesn't provision in v1. So `ingestOrder`/
// `verifyWebhook`/`webhookShopId` are intentionally omitted and the scheduled poller
// drives `fetchOrders`. Buyer email + shipping address are RESTRICTED PII gated behind
// a Restricted Data Token (RDT) — see `fetchOrders`.
//
// THROTTLING. SP-API is aggressively rate-limited (per-operation token buckets). The
// poller's per-tenant SEQUENTIAL loop plus the 5-minute cron cadence keep us within
// the default buckets; a 429 surfaces as a recorded sync error and simply retries on
// the next tick, so no special backoff/jitter is implemented in v1.
//
// SP-API reference: https://developer-docs.amazon.com/sp-api/

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
  describeResponse,
  expiresInSeconds,
  fetchT,
  formBody,
  readPlatformCreds,
  requireCreds,
  type PlatformOAuthCreds,
} from './_http.js';

// LWA token endpoint (region-independent) + the Seller Central consent host.
const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
const CONSENT_URL = 'https://sellercentral.amazon.com/apps/authorize/consent';

// LWA app creds (the platform OAuth credentials, read via readPlatformCreds).
const ID_VAR = 'AMAZON_LWA_CLIENT_ID';
const SECRET_VAR = 'AMAZON_LWA_CLIENT_SECRET';

// Non-secret config read straight from process.env (NOT secrets):
//   AMAZON_SP_APP_ID         — the SP-API application id for the consent URL.
//   AMAZON_MARKETPLACE_ID    — default marketplace (US when unset).
//   AMAZON_REGION            — na | eu | fe (default na).
const DEFAULT_MARKETPLACE_ID = 'ATVPDKIKX0DER'; // amazon.com (US)
const DEFAULT_REGION = 'na';

// Regional SP-API hosts. na/eu/fe are the three SP-API endpoints; the marketplace id
// selects the actual storefront WITHIN a region (US/CA/MX all live on `na`).
const REGION_HOSTS: Record<string, string> = {
  na: 'https://sellingpartnerapi-na.amazon.com',
  eu: 'https://sellingpartnerapi-eu.amazon.com',
  fe: 'https://sellingpartnerapi-fe.amazon.com',
};

// Feed types (the Amazon-canonical feed-type enums for the legacy XML feed schemas).
const FEED_PRODUCT = 'POST_PRODUCT_DATA';
const FEED_INVENTORY = 'POST_INVENTORY_AVAILABILITY_DATA';
const FEED_FULFILLMENT = 'POST_ORDER_FULFILLMENT_DATA';

// Cap the order pages we walk per poll/analytics window (defends against a runaway
// cursor; the poller re-runs to drain a deep backlog with a fresh `since`).
const ORDER_PAGE_CAP = 20;
const ORDERS_PAGE_SIZE = 100;

// ── SP-API response shapes ──────────────────────────────────────────────────────

interface LwaTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

interface SpMarketplace {
  id?: string;
  name?: string;
  countryCode?: string;
}

interface SpParticipation {
  isParticipating?: boolean;
  hasSuspendedListings?: boolean;
}

interface SpMarketplaceParticipation {
  marketplace?: SpMarketplace;
  storeName?: string;
  participation?: SpParticipation;
}

interface SpMarketplaceParticipationsResponse {
  payload?: SpMarketplaceParticipation[];
}

interface SpFeedDocumentResponse {
  feedDocumentId: string;
  url: string;
}

interface SpCreateFeedResponse {
  feedId: string;
}

interface SpRestrictedDataTokenResponse {
  restrictedDataToken?: string;
  expiresIn?: number;
}

interface SpMoney {
  CurrencyCode?: string;
  Amount?: string;
}

interface SpAddress {
  Name?: string;
  AddressLine1?: string;
  AddressLine2?: string;
  City?: string;
  StateOrRegion?: string;
  PostalCode?: string;
  CountryCode?: string;
  Phone?: string;
}

interface SpBuyerInfo {
  BuyerEmail?: string;
  BuyerName?: string;
}

interface SpOrder {
  AmazonOrderId?: string;
  OrderStatus?: string;
  PurchaseDate?: string;
  OrderTotal?: SpMoney;
  BuyerInfo?: SpBuyerInfo;
  BuyerEmail?: string;
  ShippingAddress?: SpAddress;
}

interface SpOrdersPayload {
  Orders?: SpOrder[];
  NextToken?: string;
}

interface SpOrdersResponse {
  payload?: SpOrdersPayload;
}

interface SpOrderItem {
  SellerSKU?: string;
  ASIN?: string;
  OrderItemId?: string;
  QuantityOrdered?: number;
  ItemPrice?: SpMoney;
}

interface SpOrderItemsPayload {
  OrderItems?: SpOrderItem[];
}

interface SpOrderItemsResponse {
  payload?: SpOrderItemsPayload;
}

export class AmazonAdapter implements ChannelAdapter {
  readonly id = 'amazon' as const;
  readonly name = 'Amazon';
  readonly shape = 'order' as const;

  // Re-read in each method that needs the creds (process.env can change between a
  // cold isConfigured() check and a later connect/push call).
  private creds(): PlatformOAuthCreds | null {
    return readPlatformCreds(ID_VAR, SECRET_VAR);
  }

  /** Resolve the regional SP-API host from the connection params (or env default). */
  private host(auth: ChannelAuth): string {
    const region = auth.params?.region ?? process.env.AMAZON_REGION ?? DEFAULT_REGION;
    return REGION_HOSTS[region] ?? REGION_HOSTS[DEFAULT_REGION] ?? REGION_HOSTS.na!;
  }

  /** The marketplace id this connection operates in (or the env default). */
  private marketplaceId(auth: ChannelAuth): string {
    return (
      auth.params?.marketplaceId ?? process.env.AMAZON_MARKETPLACE_ID ?? DEFAULT_MARKETPLACE_ID
    );
  }

  /**
   * Auth headers every SP-API call carries. SP-API authenticates with the LWA access
   * token ALONE — there is NO AWS SigV4 / IAM signing (Amazon removed that
   * requirement), so the only auth header is `x-amz-access-token`. `tokenOverride`
   * lets a restricted call swap in a Restricted Data Token for the same header.
   */
  private headers(auth: ChannelAuth, tokenOverride?: string): Record<string, string> {
    return {
      'x-amz-access-token': tokenOverride ?? auth.accessToken,
      'Content-Type': 'application/json',
    };
  }

  isConfigured(): boolean {
    return this.creds() !== null;
  }

  // ── install / auth (Login with Amazon) ─────────────────────────────────────────

  // The seller authorizes the sparx app in Seller Central. The consent callback
  // returns `spapi_oauth_code` (the auth code we exchange) PLUS `selling_partner_id`
  // (the seller's canonical id). We don't receive the latter here — the api-rest
  // callback handler does — so externalId is keyed on the marketplace id; the
  // framework can forward selling_partner_id onto the connection later (see
  // exchangeCode). AMAZON_SP_APP_ID is the SP-API application id (NOT the LWA client
  // id) the consent page expects.
  connectUrl(ctx: ChannelConnectContext): string {
    // Guard the non-secret app id the same way requireCreds guards the LWA creds.
    requireCreds(this.creds(), this.name);
    const appId = process.env.AMAZON_SP_APP_ID;
    if (!appId) {
      throw new Error(
        `${this.name} SP-API application id is not configured (set AMAZON_SP_APP_ID).`
      );
    }
    const params = new URLSearchParams({
      application_id: appId,
      state: ctx.state,
      redirect_uri: ctx.redirectUri,
    });
    return `${CONSENT_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, ctx: ChannelConnectContext): Promise<ChannelTokens> {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    const data = await this.lwaToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: ctx.redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    // Resolve the store — pick the first PARTICIPATING marketplace so externalId +
    // params land on a real, sellable storefront.
    const region = process.env.AMAZON_REGION ?? DEFAULT_REGION;
    const resolved = await this.resolveStore(data.access_token, region);
    const marketplaceId = resolved?.marketplaceId ?? this.envMarketplaceId();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: expiresInSeconds(data.expires_in, 3600),
      // Amazon is poll-based, so externalId is just an identifier (the marketplace id).
      // The callback's `selling_partner_id` is the canonical seller id; the framework
      // can forward it onto the connection once it's persisting the callback params.
      externalId: marketplaceId,
      shopName: resolved?.storeName,
      // marketplaceId + region every later SP-API call needs; the worker persists them
      // and surfaces them back as ChannelAuth.params.
      params: { marketplaceId, region },
    };
  }

  /** Resolve the connected store (first PARTICIPATING marketplace) via
   *  marketplaceParticipations. Best-effort: a hiccup here doesn't fail the whole
   *  connect — the worker falls back to the env marketplace and can re-resolve later. */
  private async resolveStore(
    accessToken: string,
    region: string
  ): Promise<{ marketplaceId: string; storeName?: string } | undefined> {
    try {
      const host = REGION_HOSTS[region] ?? REGION_HOSTS[DEFAULT_REGION] ?? REGION_HOSTS.na!;
      const res = await fetchT(`${host}/sellers/v1/marketplaceParticipations`, {
        headers: { 'x-amz-access-token': accessToken, 'Content-Type': 'application/json' },
      });
      if (!res.ok) return undefined;
      const body = (await res.json()) as SpMarketplaceParticipationsResponse;
      const entries = body.payload ?? [];
      const participating =
        entries.find((e) => e.participation?.isParticipating && e.marketplace?.id) ?? entries[0];
      const marketplaceId = participating?.marketplace?.id;
      if (!marketplaceId) return undefined;
      return { marketplaceId, storeName: participating?.storeName };
    } catch {
      return undefined;
    }
  }

  async refresh(refreshToken: string): Promise<ChannelTokens> {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    const data = await this.lwaToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });
    return {
      accessToken: data.access_token,
      // LWA returns the same refresh token; surface it when present so a rotated grant
      // is honored, else the worker keeps the stored one.
      refreshToken: data.refresh_token,
      expiresInSeconds: expiresInSeconds(data.expires_in, 3600),
    };
  }

  /** POST the LWA token endpoint (form-encoded) for both the code exchange + refresh. */
  private async lwaToken(params: Record<string, string>): Promise<LwaTokenResponse> {
    const res = await fetchT(LWA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody(params),
    });
    if (!res.ok) {
      const op = params.grant_type === 'refresh_token' ? 'token refresh' : 'token exchange';
      throw new Error(`Amazon ${op} failed: ${await describeResponse(res)}`);
    }
    return (await res.json()) as LwaTokenResponse;
  }

  // ── catalog out (FEEDS — token-scoped, no seller-id) ────────────────────────────

  // A minimal POST_PRODUCT_DATA feed: one <Message> per variant carrying the SKU, an
  // optional StandardProductID (the barcode), and the item's name/description/brand.
  // ASIN is assigned ASYNCHRONOUSLY by Amazon after the feed processes, so we map by
  // SKU (the durable key) and let the worker reconcile ASINs later if needed.
  //
  // GO-LIVE NOTE: real listings need per-category REQUIRED attributes resolved via the
  // Product Type Definitions API + the Listings Items API (the modern JSON_LISTINGS
  // feed / REST PUT). This minimal XML product feed is the baseline that creates the
  // SKU; category-correct attribute coverage is the documented go-live refinement.
  async pushProduct(auth: ChannelAuth, product: ChannelProductInput): Promise<ChannelProductRef> {
    const messages = product.variants.map((variant, index) =>
      productMessage(index + 1, 'Update', variant, product)
    );
    const xml = buildEnvelope('Product', messages);
    await this.submitFeed(auth, FEED_PRODUCT, xml);

    return {
      // SKU is the durable key (ASIN is assigned async); map every variant by sku.
      externalProductId: product.productId,
      variants: product.variants.map((v) => ({ variantId: v.variantId, externalSku: v.sku })),
    };
  }

  // Retire a listing by SKU via a POST_PRODUCT_DATA feed with OperationType=Delete.
  // The worker passes our externalProductId — but the product feed is keyed by SKU, so
  // we delete the SKU directly. (sparx maps products by SKU on Amazon, so the
  // externalProductId carried back is the SKU for a single-variant product; the worker
  // issues one removeProduct per mapped SKU.)
  async removeProduct(auth: ChannelAuth, externalProductId: string): Promise<void> {
    const message = deleteProductMessage(1, externalProductId);
    const xml = buildEnvelope('Product', [message]);
    await this.submitFeed(auth, FEED_PRODUCT, xml);
  }

  // ── inventory push (FEED) ──────────────────────────────────────────────────────

  async pushInventory(auth: ChannelAuth, update: ChannelInventoryUpdate): Promise<void> {
    const message = inventoryMessage(1, update.externalSku, update.availableQuantity);
    const xml = buildEnvelope('Inventory', [message]);
    await this.submitFeed(auth, FEED_INVENTORY, xml);
  }

  // ── fulfillment push (FEED) ────────────────────────────────────────────────────

  async pushFulfillment(auth: ChannelAuth, fulfillment: ChannelFulfillment): Promise<void> {
    const message = fulfillmentMessage(1, fulfillment, new Date().toISOString());
    const xml = buildEnvelope('OrderFulfillment', [message]);
    await this.submitFeed(auth, FEED_FULFILLMENT, xml);
  }

  /**
   * The 3-step SP-API Feeds 2021-06-30 submit flow. Token-scoped — NO seller-id in any
   * path, which is exactly why outbound writes use feeds:
   *   1. POST /feeds/2021-06-30/documents → a feedDocumentId + a presigned S3 `url`.
   *   2. PUT the raw XML to that S3 `url` (NO x-amz-access-token — the presigned URL is
   *      already authorized; sending the token would break the S3 signature).
   *   3. POST /feeds/2021-06-30/feeds referencing the document → a feedId.
   * The feed then processes async; the feedId can be polled for a processing report,
   * but the worker treats submission as success (a rejected feed surfaces as a later
   * reconciliation, not a synchronous error here).
   */
  private async submitFeed(auth: ChannelAuth, feedType: string, xmlBody: string): Promise<string> {
    const host = this.host(auth);

    // 1. Create the feed document (declare the content type up front).
    const docRes = await fetchT(`${host}/feeds/2021-06-30/documents`, {
      method: 'POST',
      headers: this.headers(auth),
      body: JSON.stringify({ contentType: 'text/xml; charset=UTF-8' }),
    });
    if (!docRes.ok) {
      throw new Error(`Amazon create feed document failed: ${await describeResponse(docRes)}`);
    }
    const doc = (await docRes.json()) as SpFeedDocumentResponse;

    // 2. PUT the raw XML to the presigned S3 URL. The URL is pre-authorized, so we send
    //    NO x-amz-access-token — only the content type, which MUST match step 1.
    const uploadRes = await fetchT(doc.url, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/xml; charset=UTF-8' },
      body: xmlBody,
    });
    if (!uploadRes.ok) {
      throw new Error(`Amazon feed document upload failed: ${await describeResponse(uploadRes)}`);
    }

    // 3. Create the feed referencing the uploaded document.
    const feedRes = await fetchT(`${host}/feeds/2021-06-30/feeds`, {
      method: 'POST',
      headers: this.headers(auth),
      body: JSON.stringify({
        feedType,
        marketplaceIds: [this.marketplaceId(auth)],
        inputFeedDocumentId: doc.feedDocumentId,
      }),
    });
    if (!feedRes.ok) {
      throw new Error(`Amazon create feed failed: ${await describeResponse(feedRes)}`);
    }
    const created = (await feedRes.json()) as SpCreateFeedResponse;
    return created.feedId;
  }

  // ── order ingest (POLL — Notifications/SQS is a documented future optimization) ──

  async fetchOrders(
    auth: ChannelAuth,
    opts: ChannelOrderPollCursor
  ): Promise<NormalizedChannelOrder[]> {
    const host = this.host(auth);
    const marketplaceId = this.marketplaceId(auth);

    const orders: NormalizedChannelOrder[] = [];
    let nextToken: string | undefined;

    for (let page = 0; page < ORDER_PAGE_CAP; page += 1) {
      const query = new URLSearchParams();
      if (nextToken) {
        // NextToken supersedes the other filters; URLSearchParams encodes it for us.
        query.set('NextToken', nextToken);
      } else {
        query.set('MarketplaceIds', marketplaceId);
        query.set('CreatedAfter', new Date(opts.since).toISOString());
        query.set('MaxResultsPerPage', String(ORDERS_PAGE_SIZE));
      }

      const res = await fetchT(`${host}/orders/v0/orders?${query.toString()}`, {
        headers: this.headers(auth),
      });
      if (!res.ok) {
        throw new Error(`Amazon fetch orders failed: ${await describeResponse(res)}`);
      }
      const body = (await res.json()) as SpOrdersResponse;
      const pageOrders = body.payload?.Orders ?? [];

      for (const order of pageOrders) {
        const normalized = await this.normalizeOrder(auth, order);
        if (normalized) orders.push(normalized);
      }

      nextToken = body.payload?.NextToken;
      if (!nextToken) break;
    }

    return orders;
  }

  /**
   * Normalize one Amazon order. Buyer email + shipping address are RESTRICTED PII, so
   * we enrich via a Restricted Data Token (RDT) and the order-items call. ROBUST to RDT
   * failure: if the RDT enrichment throws (token denied, items 404, network), we fall
   * back to the masked order data rather than DROP the order — a missing address is
   * recoverable downstream; a dropped order is not.
   */
  private async normalizeOrder(
    auth: ChannelAuth,
    order: SpOrder
  ): Promise<NormalizedChannelOrder | null> {
    const externalId = order.AmazonOrderId;
    if (!externalId) return null;

    let enriched: SpOrder = order;
    let lines: ChannelOrderLine[] = [];
    try {
      const detail = await this.enrichRestricted(auth, externalId);
      enriched = { ...order, ...detail.order };
      lines = detail.lines;
    } catch {
      // RDT enrichment failed — keep the masked order (no address, no line items). The
      // ingest synthesizes a customer from the masked email; lines stay empty and the
      // worker can re-poll once the RDT path recovers.
    }

    const total = enriched.OrderTotal;
    return {
      externalId,
      externalStatus: order.OrderStatus ?? 'Unshipped',
      placedAt: order.PurchaseDate ?? new Date().toISOString(),
      currency: total?.CurrencyCode ?? 'USD',
      customer: {
        // Amazon masks the buyer email as `...@marketplace.amazon.com` — that's fine,
        // the ingest synthesizes a customer from it; null when not even masked is shown.
        email: enriched.BuyerInfo?.BuyerEmail ?? enriched.BuyerEmail ?? null,
        name: enriched.ShippingAddress?.Name ?? enriched.BuyerInfo?.BuyerName ?? null,
      },
      shippingAddress: toAddress(enriched.ShippingAddress),
      lines,
      // Amazon marketplace fees come from the FINANCES API (a separate
      // /finances/v0/... surface keyed by the order id), not the Orders API — leave
      // channelFeeCents undefined; net-revenue reconciliation tolerates an absent fee.
    };
  }

  /**
   * Enrich one order with its RESTRICTED PII (buyer email + shipping address) and its
   * line items. Amazon gates these behind a Restricted Data Token: we request an RDT
   * scoped to exactly the order + order-items resources, then re-issue the GETs with
   * the RDT as the `x-amz-access-token`.
   */
  private async enrichRestricted(
    auth: ChannelAuth,
    orderId: string
  ): Promise<{ order: SpOrder; lines: ChannelOrderLine[] }> {
    const host = this.host(auth);
    const rdt = await this.restrictedDataToken(auth, orderId);

    // Re-fetch the order WITH the RDT to unmask the buyer info + shipping address.
    const orderRes = await fetchT(`${host}/orders/v0/orders/${encodeURIComponent(orderId)}`, {
      headers: this.headers(auth, rdt),
    });
    if (!orderRes.ok) {
      throw new Error(`Amazon restricted order fetch failed: ${await describeResponse(orderRes)}`);
    }
    const orderBody = (await orderRes.json()) as { payload?: SpOrder };
    const order = orderBody.payload ?? {};

    // Fetch the order items (also RDT-scoped) and normalize the lines.
    const itemsRes = await fetchT(
      `${host}/orders/v0/orders/${encodeURIComponent(orderId)}/orderItems`,
      { headers: this.headers(auth, rdt) }
    );
    if (!itemsRes.ok) {
      throw new Error(`Amazon order items fetch failed: ${await describeResponse(itemsRes)}`);
    }
    const itemsBody = (await itemsRes.json()) as SpOrderItemsResponse;
    const lines = (itemsBody.payload?.OrderItems ?? []).map(toOrderLine);

    return { order, lines };
  }

  /**
   * Request a Restricted Data Token scoped to one order's PII resources. The RDT is a
   * short-lived token that re-authorizes ONLY the listed paths + dataElements; we send
   * it as `x-amz-access-token` on the restricted GETs.
   */
  private async restrictedDataToken(auth: ChannelAuth, orderId: string): Promise<string> {
    const host = this.host(auth);
    const encoded = encodeURIComponent(orderId);
    const res = await fetchT(`${host}/tokens/2021-03-01/restrictedDataToken`, {
      method: 'POST',
      headers: this.headers(auth),
      body: JSON.stringify({
        restrictedResources: [
          {
            method: 'GET',
            path: `/orders/v0/orders/${encoded}`,
            dataElements: ['buyerInfo', 'shippingAddress'],
          },
          {
            method: 'GET',
            path: `/orders/v0/orders/${encoded}/orderItems`,
            dataElements: ['buyerInfo'],
          },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`Amazon restricted data token failed: ${await describeResponse(res)}`);
    }
    const body = (await res.json()) as SpRestrictedDataTokenResponse;
    if (!body.restrictedDataToken) {
      throw new Error('Amazon restricted data token response had no token.');
    }
    return body.restrictedDataToken;
  }

  // ── analytics ──────────────────────────────────────────────────────────────────

  async getAnalytics(auth: ChannelAuth, period: ChannelPeriod): Promise<ChannelAnalytics> {
    const host = this.host(auth);
    const marketplaceId = this.marketplaceId(auth);

    let revenueCents = 0;
    let orderCount = 0;
    let nextToken: string | undefined;

    for (let page = 0; page < ORDER_PAGE_CAP; page += 1) {
      const query = new URLSearchParams();
      if (nextToken) {
        query.set('NextToken', nextToken);
      } else {
        query.set('MarketplaceIds', marketplaceId);
        query.set('CreatedAfter', new Date(period.start).toISOString());
        query.set('CreatedBefore', new Date(period.end).toISOString());
        query.set('MaxResultsPerPage', String(ORDERS_PAGE_SIZE));
      }

      const res = await fetchT(`${host}/orders/v0/orders?${query.toString()}`, {
        headers: this.headers(auth),
      });
      if (!res.ok) {
        throw new Error(`Amazon analytics fetch failed: ${await describeResponse(res)}`);
      }
      const body = (await res.json()) as SpOrdersResponse;
      const orders = body.payload?.Orders ?? [];
      for (const order of orders) {
        const amount = Number(order.OrderTotal?.Amount ?? 0);
        if (Number.isFinite(amount)) revenueCents += Math.round(amount * 100);
        orderCount += 1;
      }

      nextToken = body.payload?.NextToken;
      if (!nextToken) break;
    }

    return { revenueCents, orderCount };
  }

  // ── internals ──────────────────────────────────────────────────────────────────

  /** The env-configured marketplace id (the connect-time fallback when the store
   *  resolve hiccups). */
  private envMarketplaceId(): string {
    return process.env.AMAZON_MARKETPLACE_ID ?? DEFAULT_MARKETPLACE_ID;
  }
}

// ── module-private XML feed builders ────────────────────────────────────────────

// Amazon's legacy feed schemas wrap an array of <Message> in an <AmazonEnvelope>. The
// Header's MerchantIdentifier is VESTIGIAL — the feed is authorized by the LWA token,
// not the XML id — so we send a placeholder 'M'. DocumentVersion is the schema-pinned
// 1.01 every legacy feed uses.
function buildEnvelope(messageType: string, messages: string[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">\n` +
    `  <Header>\n` +
    `    <DocumentVersion>1.01</DocumentVersion>\n` +
    `    <MerchantIdentifier>M</MerchantIdentifier>\n` +
    `  </Header>\n` +
    `  <MessageType>${messageType}</MessageType>\n` +
    messages.join('\n') +
    `\n</AmazonEnvelope>`
  );
}

/** One POST_PRODUCT_DATA upsert message: SKU + optional StandardProductID + descriptors. */
function productMessage(
  messageId: number,
  operation: 'Update',
  variant: ChannelProductInput['variants'][number],
  product: ChannelProductInput
): string {
  const standardProductId = variant.barcode
    ? `      <StandardProductID>\n` +
      `        <Type>EAN</Type>\n` +
      `        <Value>${escapeXml(variant.barcode)}</Value>\n` +
      `      </StandardProductID>\n`
    : '';
  const brand = product.brand ? `        <Brand>${escapeXml(product.brand)}</Brand>\n` : '';
  const description = product.description
    ? `        <Description>${escapeXml(product.description)}</Description>\n`
    : '';

  return (
    `  <Message>\n` +
    `    <MessageID>${messageId}</MessageID>\n` +
    `    <OperationType>${operation}</OperationType>\n` +
    `    <Product>\n` +
    `      <SKU>${escapeXml(variant.sku)}</SKU>\n` +
    standardProductId +
    `      <DescriptionData>\n` +
    `        <Title>${escapeXml(variant.title || product.title)}</Title>\n` +
    brand +
    description +
    `      </DescriptionData>\n` +
    `    </Product>\n` +
    `  </Message>`
  );
}

/** A POST_PRODUCT_DATA delete message keyed by SKU. */
function deleteProductMessage(messageId: number, sku: string): string {
  return (
    `  <Message>\n` +
    `    <MessageID>${messageId}</MessageID>\n` +
    `    <OperationType>Delete</OperationType>\n` +
    `    <Product>\n` +
    `      <SKU>${escapeXml(sku)}</SKU>\n` +
    `    </Product>\n` +
    `  </Message>`
  );
}

/** A POST_INVENTORY_AVAILABILITY_DATA message: SKU + absolute available quantity. */
function inventoryMessage(messageId: number, sku: string, quantity: number): string {
  return (
    `  <Message>\n` +
    `    <MessageID>${messageId}</MessageID>\n` +
    `    <OperationType>Update</OperationType>\n` +
    `    <Inventory>\n` +
    `      <SKU>${escapeXml(sku)}</SKU>\n` +
    `      <Quantity>${Math.max(0, Math.trunc(quantity))}</Quantity>\n` +
    `    </Inventory>\n` +
    `  </Message>`
  );
}

/** A POST_ORDER_FULFILLMENT_DATA message: order id + carrier + tracking number. */
function fulfillmentMessage(
  messageId: number,
  fulfillment: ChannelFulfillment,
  fulfillmentDate: string
): string {
  return (
    `  <Message>\n` +
    `    <MessageID>${messageId}</MessageID>\n` +
    `    <OrderFulfillment>\n` +
    `      <AmazonOrderID>${escapeXml(fulfillment.externalOrderId)}</AmazonOrderID>\n` +
    `      <FulfillmentDate>${escapeXml(fulfillmentDate)}</FulfillmentDate>\n` +
    `      <FulfillmentData>\n` +
    `        <CarrierName>${escapeXml(fulfillment.carrier)}</CarrierName>\n` +
    `        <ShipperTrackingNumber>${escapeXml(fulfillment.trackingNumber)}</ShipperTrackingNumber>\n` +
    `      </FulfillmentData>\n` +
    `    </OrderFulfillment>\n` +
    `  </Message>`
  );
}

/** Escape the five XML predefined entities in any interpolated feed value. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── module-private order mappers ────────────────────────────────────────────────

/** Map an SP-API ShippingAddress → the normalized ChannelAddress (null when absent). */
function toAddress(addr: SpAddress | undefined): NormalizedChannelOrder['shippingAddress'] {
  if (!addr) return null;
  // Treat an address with no street/city/postal as effectively empty (masked/withheld).
  if (!addr.AddressLine1 && !addr.City && !addr.PostalCode) return null;
  return {
    name: addr.Name ?? '',
    line1: addr.AddressLine1 ?? '',
    ...(addr.AddressLine2 ? { line2: addr.AddressLine2 } : {}),
    city: addr.City ?? '',
    ...(addr.StateOrRegion ? { region: addr.StateOrRegion } : {}),
    postalCode: addr.PostalCode ?? '',
    countryCode: addr.CountryCode ?? '',
    ...(addr.Phone ? { phone: addr.Phone } : {}),
  };
}

/**
 * Map an SP-API order item → a normalized line. ItemPrice is the LINE total (price for
 * ALL units of the item), so we divide by the quantity for the unit price — guarding a
 * zero/invalid quantity to avoid a divide-by-zero.
 */
function toOrderLine(item: SpOrderItem): ChannelOrderLine {
  const quantity = Number(item.QuantityOrdered ?? 0);
  const safeQty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const lineTotal = Number(item.ItemPrice?.Amount ?? 0);
  const unitPriceCents = Number.isFinite(lineTotal) ? Math.round((lineTotal / safeQty) * 100) : 0;
  return {
    externalSku: item.SellerSKU ?? '',
    ...(item.ASIN ? { externalVariantId: item.ASIN } : {}),
    quantity: safeQty,
    unitPriceCents,
  };
}
