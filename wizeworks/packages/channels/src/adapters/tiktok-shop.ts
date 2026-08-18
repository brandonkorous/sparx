// TikTok Shop adapter — the bidirectional ORDER-shape channel (docs/27 + docs/106).
// Unlike the feed channels (Google/Meta/Pinterest), TikTok owns checkout: sparx
// pushes the catalog OUT, then ingests the orders TikTok captures, pushes tracking +
// inventory BACK, and pulls revenue for the analytics breakdown. Every method of the
// ChannelAdapter contract is implemented.
//
// NO SDKs — pure `fetch`. All BUSINESS calls go through the signed `callTikTok`
// client in `_tiktok.ts`; the OAuth token GET/refresh calls go through the unsigned
// `getToken`/`refreshToken` helpers there. The adapter is pure I/O — the
// channel-sync-worker owns every DB write.
//
// Signing scheme: every business-API call is HMAC-SHA256 signed over the sorted
// query params + request path + exact JSON body, double-wrapped in the app secret
// (full algorithm in `_tiktok.ts`). The signature is computed for us by `callTikTok`.
//
// shop_cipher: OAuth resolves an authorized shop whose opaque `cipher` scopes every
// later business call. We persist it on the connection params (`shopCipher`) and pass
// it to `callTikTok`; a connection missing it must be reconnected. The ONLY call that
// runs WITHOUT a cipher is the post-auth shop lookup (it's authorization-scoped).
//
// Live verification is gated on TikTok ISV partner approval — the app must pass
// review and the shop must be authorized before these endpoints respond outside the
// sandbox. The mapping below follows the published 202309 API surface.

import type {
  ChannelAdapter,
  ChannelAuth,
  ChannelConnectContext,
  ChannelFulfillment,
  ChannelInventoryUpdate,
  ChannelPeriod,
  ChannelProductInput,
  ChannelProductRef,
  ChannelTokens,
  ChannelWebhookRequest,
  ChannelAnalytics,
  NormalizedChannelOrder,
} from '../types.js';
import { fetchT, readPlatformCreds, requireCreds, type PlatformOAuthCreds } from './_http.js';
import {
  AUTH_URL,
  API_BASE,
  ID_VAR,
  SECRET_VAR,
  callTikTok,
  getToken,
  refreshToken,
  signRequest,
  tiktokExpiresInSeconds,
  verifyWebhookSignature,
  type TikTokCategoryRecommendation,
  type TikTokCreatedProduct,
  type TikTokImageUploadResult,
  type TikTokOrder,
  type TikTokOrderList,
  type TikTokOrderSearchPage,
  type TikTokPackageList,
  type TikTokShippingProviderList,
  type TikTokShopList,
  type TikTokWarehouseList,
  type TikTokWebhookPayload,
} from './_tiktok.js';

// Listing defaults TikTok requires but sparx doesn't yet model per-variant.
const DEFAULT_PACKAGE_WEIGHT = { value: '1', unit: 'POUND' as const };
const MAX_LISTING_IMAGES = 9;
const ANALYTICS_PAGE_SIZE = 50;
const ANALYTICS_PAGE_CAP = 20;

export class TikTokShopAdapter implements ChannelAdapter {
  readonly id = 'tiktok_shop' as const;
  readonly name = 'TikTok Shop';
  readonly shape = 'order' as const;

  // Re-read in each method that needs the creds (process.env can change between a
  // cold isConfigured() check and a later connect/push call).
  private creds(): PlatformOAuthCreds | null {
    return readPlatformCreds(ID_VAR, SECRET_VAR);
  }

  isConfigured(): boolean {
    return this.creds() !== null;
  }

  connectUrl(ctx: ChannelConnectContext): string {
    const { clientId } = requireCreds(this.creds(), this.name);
    // TikTok pins the redirect_uri in the app console — it is NOT a query param, so
    // ops must configure the dashboard callback URL there. We only pass app_key + state.
    const params = new URLSearchParams({ app_key: clientId, state: ctx.state });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, _ctx: ChannelConnectContext): Promise<ChannelTokens> {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    const token = await getToken(clientId, clientSecret, code);

    // Resolve the authorized shop — authorization-scoped, so NO shop_cipher yet.
    const shopList = await callTikTok<TikTokShopList>({
      appKey: clientId,
      appSecret: clientSecret,
      accessToken: token.access_token,
      method: 'GET',
      path: '/authorization/202309/shops',
    });
    const shop = shopList.shops[0];
    if (!shop) {
      throw new Error(
        'TikTok authorization returned no shops — the seller has no authorized shop.'
      );
    }

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresInSeconds: tiktokExpiresInSeconds(token.access_token_expire_in),
      externalId: shop.id,
      shopName: shop.name,
      // shopCipher + region every later business call needs; the worker persists
      // them and surfaces them back as ChannelAuth.params.
      params: { shopCipher: shop.cipher, shopRegion: shop.region },
    };
  }

  async refresh(refresh: string): Promise<ChannelTokens> {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    const token = await refreshToken(clientId, clientSecret, refresh);
    return {
      accessToken: token.access_token,
      // TikTok ROTATES the refresh token — surface the new one.
      refreshToken: token.refresh_token,
      expiresInSeconds: tiktokExpiresInSeconds(token.access_token_expire_in),
    };
  }

  // ── catalog out ────────────────────────────────────────────────────────────────

  async pushProduct(auth: ChannelAuth, product: ChannelProductInput): Promise<ChannelProductRef> {
    const creds = requireCreds(this.creds(), this.name);
    const shopCipher = this.requireCipher(auth);

    // 1. Recommend a leaf category — a listing with no resolvable category can't post.
    const recommendation = await callTikTok<TikTokCategoryRecommendation>({
      ...this.call(creds, auth, shopCipher),
      method: 'POST',
      path: '/product/202309/categories/recommend',
      body: { product_title: product.title, description: product.description ?? product.title },
    });
    const categoryId = recommendation.leaf_category_id;
    if (!categoryId) {
      throw new Error(`TikTok could not recommend a category for "${product.title}".`);
    }

    // 2. Resolve the first FULFILLMENT_WAREHOUSE — required for the SKU inventory rows.
    const warehouseId = await this.firstWarehouse(creds, auth, shopCipher);

    // 3. Upload each image (cap 9) and collect the returned uris.
    const uris: string[] = [];
    for (const url of product.imageUrls.slice(0, MAX_LISTING_IMAGES)) {
      uris.push(await this.uploadImage(creds, auth, shopCipher, url));
    }

    // 4. Create the product.
    const created = await callTikTok<TikTokCreatedProduct>({
      ...this.call(creds, auth, shopCipher),
      method: 'POST',
      path: '/product/202309/products',
      body: {
        title: product.title,
        description: product.description ?? product.title,
        category_id: categoryId,
        main_images: uris.map((uri) => ({ uri })),
        skus: product.variants.map((v) => this.buildSku(product, v, warehouseId)),
        // TikTok requires a package weight; sparx doesn't model it per-product yet, so
        // default to 1 POUND (refine once a shipping-profile model exists).
        package_weight: DEFAULT_PACKAGE_WEIGHT,
      },
    });

    return {
      externalProductId: created.product_id,
      variants: product.variants.map((v) => {
        const matched = created.skus.find((s) => s.seller_sku === v.sku);
        return {
          variantId: v.variantId,
          externalVariantId: matched?.id,
          externalSku: v.sku,
        };
      }),
    };
  }

  /** Shape one variant into the TikTok create-product SKU payload. */
  private buildSku(
    product: ChannelProductInput,
    variant: ChannelProductInput['variants'][number],
    warehouseId: string
  ): Record<string, unknown> {
    return {
      seller_sku: variant.sku,
      sales_attributes: Object.entries(variant.options).map(([name, value_name]) => ({
        name,
        value_name,
      })),
      original_price: {
        amount: (variant.priceCents / 100).toFixed(2),
        currency: product.currency,
      },
      inventory: [{ warehouse_id: warehouseId, quantity: variant.availableQuantity }],
    };
  }

  async removeProduct(auth: ChannelAuth, externalProductId: string): Promise<void> {
    const creds = requireCreds(this.creds(), this.name);
    const shopCipher = this.requireCipher(auth);
    try {
      await callTikTok<unknown>({
        ...this.call(creds, auth, shopCipher),
        method: 'POST',
        path: '/product/202309/products/deactivate',
        body: { product_ids: [externalProductId] },
      });
    } catch (err) {
      // Best-effort idempotent delete: swallow an already-gone product, rethrow else.
      if (this.isNotFound(err)) return;
      throw err;
    }
  }

  // ── order ingest ─────────────────────────────────────────────────────────────────

  async ingestOrder(auth: ChannelAuth, payload: unknown): Promise<NormalizedChannelOrder> {
    const creds = requireCreds(this.creds(), this.name);
    const shopCipher = this.requireCipher(auth);

    const hook = (payload ?? {}) as TikTokWebhookPayload;
    const orderId = hook.data?.order_id;
    if (!orderId) {
      throw new Error('TikTok order webhook payload is missing data.order_id.');
    }

    const list = await callTikTok<TikTokOrderList>({
      ...this.call(creds, auth, shopCipher),
      method: 'GET',
      path: '/order/202309/orders',
      query: { ids: orderId },
    });
    const order = list.orders[0];
    if (!order) {
      throw new Error(`TikTok order ${orderId} not found.`);
    }

    return this.normalizeOrder(order);
  }

  private normalizeOrder(order: TikTokOrder): NormalizedChannelOrder {
    const addr = order.recipient_address;
    const shippingAddress = addr
      ? {
          name: addr.name ?? '',
          line1: addr.full_address ?? addr.address_line1 ?? '',
          line2: addr.address_line2 ?? undefined,
          city: addr.city ?? '',
          region: addr.state ?? undefined,
          postalCode: addr.zipcode ?? '',
          countryCode: addr.region_code ?? '',
          phone: addr.phone_number ?? undefined,
        }
      : null;

    return {
      externalId: order.id,
      externalStatus: order.status,
      // TikTok create_time is unix epoch SECONDS.
      placedAt: new Date(Number(order.create_time) * 1000).toISOString(),
      currency: order.payment?.currency ?? 'USD',
      customer: {
        email: order.buyer_email ?? null,
        name: addr?.name ?? null,
        phone: addr?.phone_number ?? null,
      },
      shippingAddress,
      // TikTok line_items are ONE ROW PER UNIT (each unit is a separate line_item with
      // its own id), so quantity is always 1 here — the ingest service aggregates by sku.
      lines: order.line_items.map((li) => ({
        externalSku: li.seller_sku ?? '',
        externalVariantId: li.sku_id ?? undefined,
        quantity: 1,
        unitPriceCents: Math.round(Number(li.sale_price ?? 0) * 100),
      })),
      ...this.deriveFee(order),
    };
  }

  /** Marketplace fee, when the payment block carries one — omitted when not derivable. */
  private deriveFee(order: TikTokOrder): { channelFeeCents?: number } {
    const raw = order.payment?.platform_fee ?? order.payment?.platform_discount;
    if (raw === undefined) return {};
    const cents = Math.round(Number(raw) * 100);
    return Number.isFinite(cents) ? { channelFeeCents: cents } : {};
  }

  // ── fulfillment push ─────────────────────────────────────────────────────────────

  async pushFulfillment(auth: ChannelAuth, fulfillment: ChannelFulfillment): Promise<void> {
    const creds = requireCreds(this.creds(), this.name);
    const shopCipher = this.requireCipher(auth);

    // 1. List the order's packages.
    const packageList = await callTikTok<TikTokPackageList>({
      ...this.call(creds, auth, shopCipher),
      method: 'GET',
      path: `/fulfillment/202309/orders/${encodeURIComponent(fulfillment.externalOrderId)}/packages`,
    });
    const packages = packageList.packages;
    if (packages.length === 0) {
      throw new Error(`TikTok order ${fulfillment.externalOrderId} has no packages to ship.`);
    }

    // 2. Best-effort carrier → provider mapping: match a provider whose name contains
    //    the carrier (case-insensitive), else fall back to the first provider.
    const providerList = await callTikTok<TikTokShippingProviderList>({
      ...this.call(creds, auth, shopCipher),
      method: 'GET',
      path: '/logistics/202309/shipping_providers',
    });
    const providers = providerList.shipping_providers;
    if (providers.length === 0) {
      throw new Error('TikTok returned no shipping providers to map the carrier to.');
    }
    const carrier = fulfillment.carrier.toLowerCase();
    const matched = providers.find((p) => (p.name ?? '').toLowerCase().includes(carrier));
    const shippingProviderId = (matched ?? providers[0])?.id;

    // 3. Ship each package with the tracking number + resolved provider.
    for (const pkg of packages) {
      await callTikTok<unknown>({
        ...this.call(creds, auth, shopCipher),
        method: 'POST',
        path: `/fulfillment/202309/packages/${encodeURIComponent(pkg.id)}/ship`,
        body: {
          tracking_number: fulfillment.trackingNumber,
          shipping_provider_id: shippingProviderId,
        },
      });
    }
  }

  // ── inventory push ───────────────────────────────────────────────────────────────

  async pushInventory(auth: ChannelAuth, update: ChannelInventoryUpdate): Promise<void> {
    const creds = requireCreds(this.creds(), this.name);
    const shopCipher = this.requireCipher(auth);

    if (!update.externalProductId) {
      throw new Error('TikTok inventory update requires the external product id.');
    }
    if (!update.externalVariantId) {
      throw new Error('TikTok inventory update requires the external variant (sku) id.');
    }
    const warehouseId = await this.firstWarehouse(creds, auth, shopCipher);

    await callTikTok<unknown>({
      ...this.call(creds, auth, shopCipher),
      method: 'POST',
      path: `/product/202309/products/${encodeURIComponent(update.externalProductId)}/inventory/update`,
      body: {
        skus: [
          {
            id: update.externalVariantId,
            inventory: [{ warehouse_id: warehouseId, quantity: update.availableQuantity }],
          },
        ],
      },
    });
  }

  // ── analytics ────────────────────────────────────────────────────────────────────

  async getAnalytics(auth: ChannelAuth, period: ChannelPeriod): Promise<ChannelAnalytics> {
    const creds = requireCreds(this.creds(), this.name);
    const shopCipher = this.requireCipher(auth);

    const createTimeGe = Math.floor(new Date(period.start).getTime() / 1000);
    const createTimeLt = Math.floor(new Date(period.end).getTime() / 1000);

    let revenueCents = 0;
    let orderCount = 0;
    let pageToken: string | undefined;

    for (let page = 0; page < ANALYTICS_PAGE_CAP; page += 1) {
      const query: Record<string, string> = { page_size: String(ANALYTICS_PAGE_SIZE) };
      if (pageToken) query.page_token = pageToken;

      const result = await callTikTok<TikTokOrderSearchPage>({
        ...this.call(creds, auth, shopCipher),
        method: 'POST',
        path: '/order/202309/orders/search',
        query,
        body: { create_time_ge: createTimeGe, create_time_lt: createTimeLt },
      });

      for (const order of result.orders ?? []) {
        revenueCents += Math.round(Number(order.payment?.total_amount ?? 0) * 100);
        orderCount += 1;
      }

      pageToken = result.next_page_token;
      if (!pageToken) break;
    }

    return { revenueCents, orderCount };
  }

  // ── webhook verification ─────────────────────────────────────────────────────────

  verifyWebhook(req: ChannelWebhookRequest): boolean {
    const creds = this.creds();
    if (!creds) return false;
    // TikTok puts the signature in `authorization`; tolerate `x-tts-signature` too.
    const header =
      this.headerValue(req, 'authorization') ?? this.headerValue(req, 'x-tts-signature');
    return verifyWebhookSignature(req.rawBody, header, creds.clientId, creds.clientSecret);
  }

  /** Every TikTok webhook carries the originating `shop_id` at the top level — the
   *  routing key the public webhook uses to resolve the tenant connection. */
  webhookShopId(payload: unknown): string | null {
    if (payload && typeof payload === 'object') {
      const shopId = (payload as { shop_id?: unknown }).shop_id;
      if (typeof shopId === 'string') return shopId;
      if (typeof shopId === 'number') return String(shopId);
    }
    return null;
  }

  // ── internals ────────────────────────────────────────────────────────────────────

  /** Common signed-call options (creds + token + shop cipher) for `callTikTok`. */
  private call(
    creds: PlatformOAuthCreds,
    auth: ChannelAuth,
    shopCipher: string
  ): { appKey: string; appSecret: string; accessToken: string; shopCipher: string } {
    return {
      appKey: creds.clientId,
      appSecret: creds.clientSecret,
      accessToken: auth.accessToken,
      shopCipher,
    };
  }

  /** The shop cipher scopes every business call; a connection without it is unusable. */
  private requireCipher(auth: ChannelAuth): string {
    const shopCipher = auth.params?.shopCipher;
    if (!shopCipher) {
      throw new Error('TikTok connection is missing its shop cipher — reconnect the shop.');
    }
    return shopCipher;
  }

  /** Resolve the first FULFILLMENT_WAREHOUSE; listing + inventory both need it. */
  private async firstWarehouse(
    creds: PlatformOAuthCreds,
    auth: ChannelAuth,
    shopCipher: string
  ): Promise<string> {
    const list = await callTikTok<TikTokWarehouseList>({
      ...this.call(creds, auth, shopCipher),
      method: 'GET',
      path: '/logistics/202309/warehouses',
    });
    const warehouseId = list.warehouses[0]?.id;
    if (!warehouseId) {
      throw new Error('TikTok shop has no warehouse — a fulfillment warehouse is required.');
    }
    return warehouseId;
  }

  /**
   * Upload one product image and return its TikTok uri. Image upload is MULTIPART, so
   * we can't route it through `callTikTok` (which sends JSON). Per the signing
   * algorithm a multipart body is NOT appended to the signature, so we sign with an
   * EMPTY body string, build the signed query ourselves, and let fetch set the
   * multipart boundary (no content-type header).
   */
  private async uploadImage(
    creds: PlatformOAuthCreds,
    auth: ChannelAuth,
    shopCipher: string,
    imageUrl: string
  ): Promise<string> {
    const path = '/product/202309/images/upload';
    const query: Record<string, string> = {
      app_key: creds.clientId,
      timestamp: Math.floor(Date.now() / 1000).toString(),
      shop_cipher: shopCipher,
    };
    query.sign = signRequest(creds.clientSecret, path, query, '');

    const imgRes = await fetchT(imageUrl);
    if (!imgRes.ok) {
      throw new Error(`TikTok image fetch failed (${imageUrl}): ${imgRes.status}`);
    }
    const bytes = await imgRes.arrayBuffer();

    const form = new FormData();
    form.append('data', new Blob([bytes]));
    form.append('use_case', 'MAIN_IMAGE');

    const res = await fetchT(`${API_BASE}${path}?${new URLSearchParams(query).toString()}`, {
      method: 'POST',
      headers: { 'x-tts-access-token': auth.accessToken },
      body: form,
    });
    if (!res.ok) {
      throw new Error(`TikTok image upload failed: ${res.status}`);
    }
    const envelope = (await res.json()) as {
      code: number;
      message: string;
      data: TikTokImageUploadResult;
    };
    if (envelope.code !== 0) {
      throw new Error(`TikTok image upload failed: code ${envelope.code} ${envelope.message}`);
    }
    return envelope.data.uri;
  }

  /** Whether a thrown TikTok error denotes an already-gone / not-found product. */
  private isNotFound(err: unknown): boolean {
    const message = err instanceof Error ? err.message.toLowerCase() : '';
    return message.includes('not found') || message.includes('not exist');
  }

  /** Read a single header value (TikTok sends scalar header strings). */
  private headerValue(req: ChannelWebhookRequest, name: string): string | undefined {
    const value = req.headers[name];
    if (Array.isArray(value)) return value[0];
    return value ?? undefined;
  }
}
