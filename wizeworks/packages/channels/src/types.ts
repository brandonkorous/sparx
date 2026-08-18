// @wizeworks/channels — the ChannelAdapter contract + normalized types for external
// sales-channel and sparx.market integrations (docs/106).
//
// A "channel" is one of three SHAPES (docs/106 §2):
//   - 'order'       — bidirectional catalog↔order↔inventory (TikTok, Etsy, Amazon,
//                     Walmart, eBay, Faire). Implements the full interface.
//   - 'feed'        — catalog-out only; checkout stays on the tenant's sparx site
//                     (Google Shopping, Meta, Pinterest). Order/inventory methods
//                     are omitted (the adapter declares `shape: 'feed'`).
//   - 'first_party' — sparx.market; orders are born in sparx, settled by sparx.
//
// Adapters are pure I/O against the channel's API — they NEVER touch the database.
// The channel-sync-worker owns every DB write (the inventory ledger, the order
// spine) after calling adapter methods. Tokens are resolved by the worker via the
// integration-framework SecretReader and passed in `ChannelAuth`; adapters never
// read secrets directly. This mirrors the dropship `SupplierAdapter` contract.

// ── Channel identity ──────────────────────────────────────────────────────────

/** Every channel sparx integrates (docs/106 §3). Matches `channel_connections.channel`. */
export type ChannelSlug =
  | 'tiktok_shop'
  | 'etsy'
  | 'amazon'
  | 'walmart'
  | 'ebay'
  | 'faire'
  | 'meta'
  | 'google_shopping'
  | 'pinterest'
  | 'sparx_market';

/** The technical shape that gates which methods an adapter must implement. */
export type ChannelShape = 'order' | 'feed' | 'first_party';

/** OAuth-resolved credentials handed to every adapter call. The worker resolves
 *  the access token from Secret Manager (via SecretReader) before invoking — the
 *  adapter never reads secrets itself. */
export interface ChannelAuth {
  /** The connected shop/account id on the channel (e.g. the TikTok shop_id). */
  externalId: string;
  accessToken: string;
  /** Extra per-channel params (shop region, marketplace id, …); carried opaque. */
  params?: Record<string, string>;
}

// ── Token exchange (OAuth) ─────────────────────────────────────────────────────

export interface ChannelTokens {
  accessToken: string;
  refreshToken?: string;
  /** Seconds until the access token expires. */
  expiresInSeconds: number;
  scope?: string;
  /** The shop/account id the channel returns post-auth. */
  externalId?: string;
  shopName?: string;
  /** Channel-specific extras that every later API call needs but that aren't the
   *  token itself (TikTok's `shopCipher` + region, Amazon's marketplace id). The
   *  worker/api-rest persist these on the connection and surface them back as
   *  {@link ChannelAuth.params} on every adapter call. */
  params?: Record<string, string>;
}

export interface ChannelConnectContext {
  tenantId: string;
  /** Signed state correlating the OAuth callback to this tenant/connection. */
  state: string;
  redirectUri: string;
  scopes: string[];
}

// ── Normalized product (sparx → channel push) ──────────────────────────────────

export interface ChannelProductVariantInput {
  /** sparx variant id — round-tripped so the worker can persist the mapping. */
  variantId: string;
  sku: string;
  title: string;
  options: Record<string, string>;
  priceCents: number;
  /** Sellable quantity AFTER the inventory safety buffer (docs/106 §4.3). */
  availableQuantity: number;
  barcode?: string;
  weightGrams?: number;
}

export interface ChannelProductInput {
  productId: string;
  title: string;
  description: string | null;
  imageUrls: string[];
  category: string | null;
  tags: string[];
  /** Absolute URL of the product's page on the tenant's storefront. REQUIRED by
   *  every feed channel (Google/Meta/Pinterest) — checkout stays on the tenant's
   *  site, so the listing must link back. The worker resolves it from the tenant's
   *  primary site domain + product handle. */
  productUrl: string;
  /** ISO currency for `priceCents` (variants share the product currency). */
  currency: string;
  /** Brand/vendor — most feed channels want it for matching + ad eligibility. */
  brand: string | null;
  variants: ChannelProductVariantInput[];
}

/** What the channel returns after a successful push — the external ids the worker
 *  persists into ChannelProductMapping. */
export interface ChannelProductRef {
  externalProductId: string;
  /** Per-variant external ids, keyed by sparx variantId. */
  variants: Array<{
    variantId: string;
    externalVariantId?: string;
    externalSku?: string;
  }>;
}

// ── Normalized order (channel → sparx ingest) ──────────────────────────────────

export interface ChannelAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
}

export interface ChannelOrderLine {
  /** The external SKU — resolved to a sparx variant via ChannelProductMapping. */
  externalSku: string;
  externalVariantId?: string;
  quantity: number;
  unitPriceCents: number;
}

export interface ChannelOrderCustomer {
  email: string | null;
  name: string | null;
  phone?: string | null;
}

/** The polling cursor handed to {@link ChannelAdapter.fetchOrders}: pull orders
 *  created/updated at or after `since` (ISO). The poller derives it from the
 *  connection's last successful poll (with a small overlap; ingest is idempotent). */
export interface ChannelOrderPollCursor {
  since: string; // ISO
}

export interface NormalizedChannelOrder {
  /** The channel's own order id — the idempotency key on ingest (docs/106 §4.3). */
  externalId: string;
  externalStatus: string;
  placedAt: string; // ISO
  currency: string;
  customer: ChannelOrderCustomer;
  shippingAddress: ChannelAddress | null;
  lines: ChannelOrderLine[];
  /** Marketplace commission in cents, stored on the order so net revenue reconciles. */
  channelFeeCents?: number;
}

// ── Fulfillment + inventory push (sparx → channel) ─────────────────────────────

export interface ChannelFulfillment {
  externalOrderId: string;
  trackingNumber: string;
  carrier: string;
  trackingUrl?: string;
}

export interface ChannelInventoryUpdate {
  externalSku: string;
  externalVariantId?: string;
  /** The channel's product id (mapping.externalProductId). Required by channels
   *  whose inventory endpoint is product-scoped (TikTok updates stock by
   *  product_id + sku_id); omitted by sku-only channels. */
  externalProductId?: string;
  /** New sellable quantity after the safety buffer (docs/106 §4.3). */
  availableQuantity: number;
}

// ── Analytics ──────────────────────────────────────────────────────────────────

export interface ChannelPeriod {
  start: string; // ISO
  end: string; // ISO
}

export interface ChannelAnalytics {
  revenueCents: number;
  orderCount: number;
}

// ── Webhook verification ────────────────────────────────────────────────────────

export interface ChannelWebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
}

// ── The adapter contract ────────────────────────────────────────────────────────

export interface ChannelAdapter {
  /** Stable slug — matches a ChannelSlug and `channel_connections.channel`. */
  readonly id: ChannelSlug;
  /** Human label for the dashboard. */
  readonly name: string;
  /** Gates which optional methods the worker expects (docs/106 §2). */
  readonly shape: ChannelShape;

  /** Whether sparx's PLATFORM OAuth credentials for this channel are configured
   *  (the app id/secret sparx registered with the channel, read from env). False
   *  → the channel is registered but not yet connectable; the API reports it
   *  `coming_soon` and `connectUrl` would be incomplete. Lets a channel light up
   *  the instant ops sets its env, with no code change (docs/106 §4.6). */
  isConfigured(): boolean;

  // ── install / auth ──
  /** Build the OAuth authorize URL the dashboard redirects to. */
  connectUrl(ctx: ChannelConnectContext): string;
  /** Exchange the OAuth callback code for tokens. */
  exchangeCode(code: string, ctx: ChannelConnectContext): Promise<ChannelTokens>;
  /** Refresh an access token nearing expiry. Optional — feed channels may auth per-call. */
  refresh?(refreshToken: string): Promise<ChannelTokens>;

  // ── catalog out (all shapes) ──
  /** Create or update a listing on the channel; returns the external ids to map. */
  pushProduct(auth: ChannelAuth, product: ChannelProductInput): Promise<ChannelProductRef>;
  /** Remove / deactivate a listing. */
  removeProduct(auth: ChannelAuth, externalProductId: string): Promise<void>;

  // ── order shape only — bidirectional ──
  /** Normalize an inbound order webhook/poll payload into the sparx order spine. */
  ingestOrder?(auth: ChannelAuth, payload: unknown): Promise<NormalizedChannelOrder>;
  /** Pull orders placed/updated since a cursor — the POLLING ingest path for order
   *  channels without reliable order webhooks (Etsy/Walmart/eBay; Faire offers both).
   *  The scheduled poller advances the cursor per connection. Channels that ingest
   *  purely by webhook (TikTok) omit it. Returns the orders normalized like
   *  `ingestOrder`, ready for the same idempotent commit. */
  fetchOrders?(auth: ChannelAuth, opts: ChannelOrderPollCursor): Promise<NormalizedChannelOrder[]>;
  /** Push tracking back to the channel when a sparx order is fulfilled. */
  pushFulfillment?(auth: ChannelAuth, fulfillment: ChannelFulfillment): Promise<void>;
  /** Push a new sellable quantity for one mapped SKU. */
  pushInventory?(auth: ChannelAuth, update: ChannelInventoryUpdate): Promise<void>;

  // ── optional ──
  /** Pull channel revenue/orders for the analytics breakdown. */
  getAnalytics?(auth: ChannelAuth, period: ChannelPeriod): Promise<ChannelAnalytics>;
  /** Verify an inbound webhook signature. Returns true when the signature is valid. */
  verifyWebhook?(req: ChannelWebhookRequest): boolean;
  /** Extract the routing shop/account id from a webhook payload. An order channel's
   *  webhook URL is app-level (one URL for every tenant), so the public webhook
   *  resolves the tenant from this id via the shop directory (docs/106 §4.4). */
  webhookShopId?(payload: unknown): string | null;
}
