// eBay adapter — the bidirectional ORDER-shape channel (docs/106). eBay owns
// checkout: sparx pushes the catalog OUT through the Sell Inventory API, ingests
// the orders eBay captures (by POLL — eBay has no reliable order webhook, so this
// adapter implements `fetchOrders`, NOT `ingestOrder`/`verifyWebhook`), pushes
// tracking + inventory BACK, and pulls revenue for the analytics breakdown.
//
// NO SDKs — pure `fetch` via the shared `fetchT` helper, mirroring the dropship
// printify adapter and the other channel adapters. The adapter is pure I/O — the
// channel-sync-worker owns every DB write.
//
// Auth: eBay OAuth 2.0 (authorization-code grant → access + refresh token). eBay's
// quirk is that the OAuth `redirect_uri` is NOT the raw callback URL but a "RuName"
// (Redirect URL name) registered in the eBay developer console — so when
// `EBAY_RU_NAME` is set we send it as `redirect_uri` on both authorize and the
// code exchange; otherwise we fall back to the raw `ctx.redirectUri` (dev/local).
// After the code exchange we resolve the seller identity from the Commerce Identity
// API and carry the eBay userId as `externalId`, username as `shopName`.
//
// ── eBay specifics that need human verification before go-live (see final report):
//   • LISTING requires three SELLER BUSINESS POLICY ids (fulfillment / payment /
//     return) AND a leaf `categoryId`. These are seller- and catalog-specific and
//     are NOT discoverable generically, so they ride `auth.params` (set on the
//     connection by ops/onboarding). Placeholder constants below are used only when
//     a param is absent so the request shape is complete — a real publish will fail
//     against eBay until the real ids are supplied. Documented at each use site.
//   • The marketplace is pinned to EBAY_US (`X-EBAY-C-MARKETPLACE-ID`); a
//     multi-marketplace seller would carry the marketplace id via auth.params too.

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
  ChannelAnalytics,
  ChannelOrderPollCursor,
  NormalizedChannelOrder,
  ChannelAddress,
  ChannelOrderLine,
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

// ── Endpoints ────────────────────────────────────────────────────────────────────

const AUTHORIZE_URL = 'https://auth.ebay.com/oauth2/authorize';
const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const IDENTITY_URL = 'https://apiz.ebay.com/commerce/identity/v1/user/';
const INVENTORY_BASE = 'https://api.ebay.com/sell/inventory/v1';
const FULFILLMENT_BASE = 'https://api.ebay.com/sell/fulfillment/v1';

// App ID (client id) + Cert ID (client secret) are sparx's PLATFORM OAuth creds.
const ID_VAR = 'EBAY_CLIENT_ID';
const SECRET_VAR = 'EBAY_CLIENT_SECRET';
// eBay's registered RuName ("Redirect URL name"); used AS the OAuth redirect_uri.
const RU_NAME_VAR = 'EBAY_RU_NAME';

// Sell scopes the catalog/order/inventory/identity calls need (space-separated).
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
].join(' ');

const MARKETPLACE_ID = 'EBAY_US';
const DEFAULT_CONTENT_LANGUAGE = 'en-US';

// Placeholder business-policy + category ids used ONLY when auth.params omits the
// real, seller-specific values. A live publish requires the real ids (see header).
const PLACEHOLDER_CATEGORY_ID = '00000';
const PLACEHOLDER_FULFILLMENT_POLICY_ID = '00000';
const PLACEHOLDER_PAYMENT_POLICY_ID = '00000';
const PLACEHOLDER_RETURN_POLICY_ID = '00000';

// eBay access tokens live ~2h; refresh tokens ~18 months.
const ACCESS_TOKEN_FALLBACK_SECONDS = 7200;

// ── API payload shapes ─────────────────────────────────────────────────────────────

interface EbayTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

interface EbayIdentity {
  userId?: string;
  username?: string;
}

interface EbayOfferResponse {
  offerId?: string;
}

interface EbayPublishResponse {
  listingId?: string;
}

interface EbayPrice {
  value?: string;
  currency?: string;
}

interface EbayPostalAddress {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateOrProvince?: string;
  postalCode?: string;
  countryCode?: string;
}

interface EbayPhone {
  phoneNumber?: string;
}

interface EbayShipTo {
  fullName?: string;
  contactAddress?: EbayPostalAddress;
  primaryPhone?: EbayPhone;
}

interface EbayShippingStep {
  shipTo?: EbayShipTo;
}

interface EbayFulfillmentStartInstruction {
  shippingStep?: EbayShippingStep;
}

interface EbayLineItemCost {
  value?: string;
  currency?: string;
}

interface EbayLineItem {
  lineItemId?: string;
  sku?: string;
  quantity?: number;
  lineItemCost?: EbayLineItemCost;
}

interface EbayPricingSummary {
  total?: EbayPrice;
}

interface EbayBuyer {
  username?: string;
}

interface EbayOrder {
  orderId?: string;
  orderFulfillmentStatus?: string;
  creationDate?: string;
  pricingSummary?: EbayPricingSummary;
  buyer?: EbayBuyer;
  fulfillmentStartInstructions?: EbayFulfillmentStartInstruction[];
  lineItems?: EbayLineItem[];
  totalMarketplaceFee?: EbayPrice;
}

interface EbayOrderSearchResponse {
  orders?: EbayOrder[];
}

const ORDER_PAGE_LIMIT = 100;
const ANALYTICS_PAGE_CAP = 50;

export class EbayAdapter implements ChannelAdapter {
  readonly id = 'ebay' as const;
  readonly name = 'eBay';
  readonly shape = 'order' as const;

  // Re-read in each method that needs the creds (process.env can change between a
  // cold isConfigured() check and a later connect/push call).
  private creds(): PlatformOAuthCreds | null {
    return readPlatformCreds(ID_VAR, SECRET_VAR);
  }

  /** The OAuth redirect_uri eBay expects: the registered RuName when ops sets it,
   *  else the raw callback URL (dev/local). eBay validates the RuName server-side. */
  private redirectUri(ctx: ChannelConnectContext): string {
    return process.env[RU_NAME_VAR] ?? ctx.redirectUri;
  }

  /** Headers for authenticated Sell API calls (Bearer + marketplace/language). */
  private headers(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE_ID,
      'Content-Language': DEFAULT_CONTENT_LANGUAGE,
    };
  }

  isConfigured(): boolean {
    return this.creds() !== null;
  }

  // ── install / auth ───────────────────────────────────────────────────────────────

  connectUrl(ctx: ChannelConnectContext): string {
    const { clientId } = requireCreds(this.creds(), this.name);
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri(ctx),
      scope: SCOPES,
      state: ctx.state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, ctx: ChannelConnectContext): Promise<ChannelTokens> {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    const res = await fetchT(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(clientId, clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri(ctx),
      }),
    });
    if (!res.ok) {
      throw new Error(`eBay token exchange failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as EbayTokenResponse;

    // Resolve the seller identity (userId → externalId, username → shopName).
    const identity = await this.resolveIdentity(data.access_token);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: expiresInSeconds(data.expires_in, ACCESS_TOKEN_FALLBACK_SECONDS),
      scope: SCOPES,
      externalId: identity?.userId,
      shopName: identity?.username,
    };
  }

  /** Best-effort seller identity lookup; a hiccup doesn't fail the whole connect —
   *  the worker can re-resolve later (mirrors Google's authinfo handling). */
  private async resolveIdentity(accessToken: string): Promise<EbayIdentity | undefined> {
    try {
      const res = await fetchT(IDENTITY_URL, { headers: this.headers(accessToken) });
      if (!res.ok) return undefined;
      return (await res.json()) as EbayIdentity;
    } catch {
      return undefined;
    }
  }

  async refresh(refreshToken: string): Promise<ChannelTokens> {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    const res = await fetchT(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(clientId, clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: SCOPES,
      }),
    });
    if (!res.ok) {
      throw new Error(`eBay token refresh failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as EbayTokenResponse;
    return {
      accessToken: data.access_token,
      // eBay refresh grants don't return a new refresh_token (it's long-lived).
      refreshToken: undefined,
      expiresInSeconds: expiresInSeconds(data.expires_in, ACCESS_TOKEN_FALLBACK_SECONDS),
      scope: SCOPES,
    };
  }

  // ── catalog out ────────────────────────────────────────────────────────────────────

  // The Inventory API is a three-step publish PER VARIANT: (1) PUT an inventory_item
  // keyed by sku, (2) POST an offer (carries price/category/business policies), (3)
  // POST the offer's /publish to mint a live listing. We map the FIRST minted
  // listingId as the product ref and each variant's offerId as its external variant
  // id (that offerId is what `removeProduct` later withdraws).
  async pushProduct(auth: ChannelAuth, product: ChannelProductInput): Promise<ChannelProductRef> {
    const variants: ChannelProductRef['variants'] = [];
    let firstListingId: string | undefined;

    for (const variant of product.variants) {
      const sku = variant.sku || variant.variantId;

      // 1. Inventory item — title/description/images/availability live here.
      await this.putInventoryItem(auth, sku, product, variant);

      // 2. Offer — price + category + the seller's required business policies.
      const offerId = await this.createOffer(auth, sku, product, variant);

      // 3. Publish — turns the offer into a live listing.
      const listingId = await this.publishOffer(auth, offerId);
      if (listingId && !firstListingId) firstListingId = listingId;

      variants.push({
        variantId: variant.variantId,
        externalSku: sku,
        // The offerId is the durable handle the worker stores + passes to removeProduct.
        externalVariantId: offerId,
      });
    }

    return {
      externalProductId: firstListingId ?? product.productId,
      variants,
    };
  }

  /** PUT the inventory_item for one sku (availability + product descriptors). */
  private async putInventoryItem(
    auth: ChannelAuth,
    sku: string,
    product: ChannelProductInput,
    variant: ChannelProductInput['variants'][number]
  ): Promise<void> {
    const body: Record<string, unknown> = {
      availability: {
        shipToLocationAvailability: { quantity: variant.availableQuantity },
      },
      condition: 'NEW',
      product: {
        title: variant.title || product.title,
        description: product.description ?? product.title,
        imageUrls: product.imageUrls,
        aspects: product.brand ? { Brand: [product.brand] } : {},
      },
    };
    const res = await fetchT(`${INVENTORY_BASE}/inventory_item/${encodeURIComponent(sku)}`, {
      method: 'PUT',
      headers: this.headers(auth.accessToken),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`eBay inventory_item upsert failed (${sku}): ${await describeResponse(res)}`);
    }
  }

  /** POST an offer for one sku and return its offerId. The categoryId + business
   *  policy ids are seller-/catalog-specific — carried via auth.params, with
   *  placeholders only so the request shape is complete (see header). */
  private async createOffer(
    auth: ChannelAuth,
    sku: string,
    product: ChannelProductInput,
    variant: ChannelProductInput['variants'][number]
  ): Promise<string> {
    const params = auth.params ?? {};
    const body = {
      sku,
      marketplaceId: MARKETPLACE_ID,
      format: 'FIXED_PRICE',
      availableQuantity: variant.availableQuantity,
      // REQUIRED leaf category — eBay rejects an offer without one. Real value rides
      // auth.params.categoryId (resolved at onboarding); placeholder otherwise.
      categoryId: params.categoryId ?? PLACEHOLDER_CATEGORY_ID,
      // REQUIRED seller business-policy ids — fulfillment/payment/return. eBay rejects
      // a publish without all three; they're seller-account-specific (auth.params).
      listingPolicies: {
        fulfillmentPolicyId: params.fulfillmentPolicyId ?? PLACEHOLDER_FULFILLMENT_POLICY_ID,
        paymentPolicyId: params.paymentPolicyId ?? PLACEHOLDER_PAYMENT_POLICY_ID,
        returnPolicyId: params.returnPolicyId ?? PLACEHOLDER_RETURN_POLICY_ID,
      },
      pricingSummary: {
        price: {
          value: (variant.priceCents / 100).toFixed(2),
          currency: product.currency.toUpperCase(),
        },
      },
    };
    const res = await fetchT(`${INVENTORY_BASE}/offer`, {
      method: 'POST',
      headers: this.headers(auth.accessToken),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`eBay offer create failed (${sku}): ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as EbayOfferResponse;
    const offerId = data.offerId;
    if (!offerId) {
      throw new Error(`eBay offer create returned no offerId (${sku}).`);
    }
    return offerId;
  }

  /** Publish an offer → a live listing; returns the listingId. */
  private async publishOffer(auth: ChannelAuth, offerId: string): Promise<string | undefined> {
    const res = await fetchT(`${INVENTORY_BASE}/offer/${encodeURIComponent(offerId)}/publish`, {
      method: 'POST',
      headers: this.headers(auth.accessToken),
    });
    if (!res.ok) {
      throw new Error(`eBay offer publish failed (${offerId}): ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as EbayPublishResponse;
    return data.listingId;
  }

  // The worker passes the per-variant external id we stored as externalVariantId —
  // i.e. the OFFER id, NOT a listing id. Deleting the offer withdraws the listing;
  // a 404 means it's already gone (idempotent).
  async removeProduct(auth: ChannelAuth, externalProductId: string): Promise<void> {
    const res = await fetchT(`${INVENTORY_BASE}/offer/${encodeURIComponent(externalProductId)}`, {
      method: 'DELETE',
      headers: this.headers(auth.accessToken),
    });
    if (res.ok || res.status === 404) return;
    throw new Error(`eBay offer delete failed: ${await describeResponse(res)}`);
  }

  // ── order ingest (POLL) ────────────────────────────────────────────────────────────

  // eBay has no reliable order webhook, so orders ingest by POLLING the Fulfillment
  // API filtered on creationdate >= the cursor. `ingestOrder`/`verifyWebhook`/
  // `webhookShopId` are intentionally NOT implemented (poll-only channel).
  async fetchOrders(
    auth: ChannelAuth,
    opts: ChannelOrderPollCursor
  ): Promise<NormalizedChannelOrder[]> {
    // creationdate:[<since>..] — the open-ended ISO range, URL-encoded ([ → %5B).
    const filter = `creationdate:%5B${encodeURIComponent(opts.since)}..%5D`;
    const url = `${FULFILLMENT_BASE}/order?filter=${filter}&limit=${ORDER_PAGE_LIMIT}`;
    const res = await fetchT(url, { headers: this.headers(auth.accessToken) });
    if (!res.ok) {
      throw new Error(`eBay order poll failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as EbayOrderSearchResponse;
    return (data.orders ?? []).map((order) => this.normalizeOrder(order));
  }

  private normalizeOrder(order: EbayOrder): NormalizedChannelOrder {
    const instruction = order.fulfillmentStartInstructions?.[0];
    const shipTo = instruction?.shippingStep?.shipTo;
    const shippingAddress = this.normalizeAddress(shipTo);

    // eBay masks the buyer email; name falls back through shipTo → buyer username.
    const name = shipTo?.fullName ?? order.buyer?.username ?? null;

    const result: NormalizedChannelOrder = {
      externalId: order.orderId ?? '',
      externalStatus: order.orderFulfillmentStatus ?? '',
      placedAt: order.creationDate ?? new Date().toISOString(),
      currency: order.pricingSummary?.total?.currency ?? 'USD',
      customer: {
        email: null,
        name,
        phone: shipTo?.primaryPhone?.phoneNumber ?? null,
      },
      shippingAddress,
      lines: this.normalizeLines(order.lineItems ?? []),
    };

    const fee = this.deriveFee(order);
    if (fee !== undefined) result.channelFeeCents = fee;
    return result;
  }

  private normalizeAddress(shipTo: EbayShipTo | undefined): ChannelAddress | null {
    if (!shipTo) return null;
    const addr = shipTo.contactAddress;
    if (!addr) return null;
    const result: ChannelAddress = {
      name: shipTo.fullName ?? '',
      line1: addr.addressLine1 ?? '',
      city: addr.city ?? '',
      postalCode: addr.postalCode ?? '',
      countryCode: addr.countryCode ?? '',
    };
    if (addr.addressLine2) result.line2 = addr.addressLine2;
    if (addr.stateOrProvince) result.region = addr.stateOrProvince;
    const phone = shipTo.primaryPhone?.phoneNumber;
    if (phone) result.phone = phone;
    return result;
  }

  private normalizeLines(lineItems: EbayLineItem[]): ChannelOrderLine[] {
    return lineItems.map((li) => ({
      externalSku: li.sku ?? '',
      quantity: li.quantity ?? 0,
      unitPriceCents: Math.round(Number(li.lineItemCost?.value ?? 0) * 100),
    }));
  }

  /** Marketplace commission, when eBay reports it on the order — omitted otherwise. */
  private deriveFee(order: EbayOrder): number | undefined {
    const raw = order.totalMarketplaceFee?.value;
    if (raw === undefined) return undefined;
    const cents = Math.round(Number(raw) * 100);
    return Number.isFinite(cents) ? cents : undefined;
  }

  // ── fulfillment push ─────────────────────────────────────────────────────────────

  // Shipping a fulfillment needs the order's lineItem ids + quantities, which the
  // worker doesn't carry — so we GET the order first to build the lineItems array,
  // then POST a shipping_fulfillment with the tracking + carrier.
  async pushFulfillment(auth: ChannelAuth, f: ChannelFulfillment): Promise<void> {
    const orderRes = await fetchT(
      `${FULFILLMENT_BASE}/order/${encodeURIComponent(f.externalOrderId)}`,
      { headers: this.headers(auth.accessToken) }
    );
    if (!orderRes.ok) {
      throw new Error(
        `eBay order fetch for fulfillment failed (${f.externalOrderId}): ${await describeResponse(orderRes)}`
      );
    }
    const order = (await orderRes.json()) as EbayOrder;
    const lineItems = (order.lineItems ?? [])
      .filter((li): li is EbayLineItem & { lineItemId: string } => Boolean(li.lineItemId))
      .map((li) => ({ lineItemId: li.lineItemId, quantity: li.quantity ?? 1 }));
    if (lineItems.length === 0) {
      throw new Error(`eBay order ${f.externalOrderId} has no line items to fulfill.`);
    }

    const body = {
      lineItems,
      shippedDate: new Date().toISOString(),
      shippingCarrierCode: f.carrier,
      trackingNumber: f.trackingNumber,
    };
    const res = await fetchT(
      `${FULFILLMENT_BASE}/order/${encodeURIComponent(f.externalOrderId)}/shipping_fulfillment`,
      {
        method: 'POST',
        headers: this.headers(auth.accessToken),
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      throw new Error(
        `eBay shipping_fulfillment failed (${f.externalOrderId}): ${await describeResponse(res)}`
      );
    }
  }

  // ── inventory push ───────────────────────────────────────────────────────────────

  async pushInventory(auth: ChannelAuth, u: ChannelInventoryUpdate): Promise<void> {
    const body = {
      requests: [
        {
          sku: u.externalSku,
          shipToLocationAvailability: { quantity: u.availableQuantity },
        },
      ],
    };
    const res = await fetchT(`${INVENTORY_BASE}/bulk_update_price_quantity`, {
      method: 'POST',
      headers: this.headers(auth.accessToken),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(
        `eBay inventory update failed (${u.externalSku}): ${await describeResponse(res)}`
      );
    }
  }

  // ── analytics ────────────────────────────────────────────────────────────────────

  // eBay paginates orders via an `offset`; sum each order's pricingSummary.total and
  // count rows over the period. We cap pages defensively (ANALYTICS_PAGE_CAP).
  async getAnalytics(auth: ChannelAuth, period: ChannelPeriod): Promise<ChannelAnalytics> {
    const filter = `creationdate:%5B${encodeURIComponent(period.start)}..${encodeURIComponent(period.end)}%5D`;

    let revenueCents = 0;
    let orderCount = 0;

    for (let page = 0; page < ANALYTICS_PAGE_CAP; page += 1) {
      const offset = page * ORDER_PAGE_LIMIT;
      const url = `${FULFILLMENT_BASE}/order?filter=${filter}&limit=${ORDER_PAGE_LIMIT}&offset=${offset}`;
      const res = await fetchT(url, { headers: this.headers(auth.accessToken) });
      if (!res.ok) {
        throw new Error(`eBay analytics poll failed: ${await describeResponse(res)}`);
      }
      const data = (await res.json()) as EbayOrderSearchResponse;
      const orders = data.orders ?? [];
      for (const order of orders) {
        revenueCents += Math.round(Number(order.pricingSummary?.total?.value ?? 0) * 100);
        orderCount += 1;
      }
      if (orders.length < ORDER_PAGE_LIMIT) break;
    }

    return { revenueCents, orderCount };
  }
}
