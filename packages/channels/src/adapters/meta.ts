// Meta adapter — syncs a tenant's product catalog OUT to Meta's Graph API
// Commerce/Catalog so it surfaces in Facebook & Instagram Shops and powers
// dynamic ads. This is a FEED channel (`shape: 'feed'`): US on-platform checkout
// is sunset, so sparx pushes a catalog only — there is no order ingest or
// fulfillment back-sync. Checkout stays on the tenant's sparx site, which is why
// every item carries its storefront `productUrl`.
//
// NO SDKs — `fetch` only via the shared `fetchT` (mirrors the dropship printify
// adapter): typed request/response shapes, AbortSignal timeouts, surfaced errors.
//
// Auth quirk: Meta has NO refresh token. The OAuth code is exchanged for a
// short-lived (~1h) user token, then swapped for a long-lived (~60-day) token via
// `grant_type=fb_exchange_token`. To "refresh" you re-exchange the current
// long-lived token for a fresh one — `refresh()` does exactly that.
//
// Catalog id is resolved post-auth to the FIRST owned product catalog of the
// first business (a future refinement lets the merchant pick one explicitly).
//
// Graph API Marketing/Catalog reference: https://developers.facebook.com/docs/marketing-api/catalog
// items_batch: https://developers.facebook.com/docs/marketing-api/reference/product-catalog/items_batch
// See docs/106 (sales-channels & sparx.market) §2 (feed shape) + §4.

import type {
  ChannelAdapter,
  ChannelAuth,
  ChannelConnectContext,
  ChannelInventoryUpdate,
  ChannelProductInput,
  ChannelProductRef,
  ChannelTokens,
} from '../types.js';
import {
  describeResponse,
  expiresInSeconds,
  fetchT,
  priceString,
  readPlatformCreds,
  requireCreds,
} from './_http.js';

const GRAPH_VERSION = 'v21.0';
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const LONG_LIVED_FALLBACK_SECONDS = 60 * 24 * 3600; // ~60 days

const ID_VAR = 'META_APP_ID';
const SECRET_VAR = 'META_APP_SECRET';

// ── Graph API response shapes ─────────────────────────────────────────────────

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
}

interface EdgeListResponse {
  data?: Array<{ id?: string; name?: string }>;
}

// One entry in an items_batch `requests` array. `data` is omitted for DELETE.
interface ItemsBatchRequest {
  method: 'UPDATE' | 'DELETE';
  retailer_id: string;
  data?: Record<string, unknown>;
}

export class MetaAdapter implements ChannelAdapter {
  readonly id = 'meta' as const;
  readonly name = 'Meta (Facebook & Instagram Shops)';
  readonly shape = 'feed' as const;

  isConfigured(): boolean {
    return readPlatformCreds(ID_VAR, SECRET_VAR) !== null;
  }

  connectUrl(ctx: ChannelConnectContext): string {
    const { clientId } = requireCreds(readPlatformCreds(ID_VAR, SECRET_VAR), this.name);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: ctx.redirectUri,
      state: ctx.state,
      response_type: 'code',
      scope: 'catalog_management,business_management',
    });
    return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  }

  async exchangeCode(code: string, ctx: ChannelConnectContext): Promise<ChannelTokens> {
    const { clientId, clientSecret } = requireCreds(
      readPlatformCreds(ID_VAR, SECRET_VAR),
      this.name
    );

    // 1. code → short-lived (~1h) user token. Meta uses GET for token exchange.
    const shortParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: ctx.redirectUri,
      client_secret: clientSecret,
      code,
    });
    const shortRes = await fetchT(`${BASE}/oauth/access_token?${shortParams.toString()}`);
    if (!shortRes.ok)
      throw new Error(`Meta token exchange failed: ${await describeResponse(shortRes)}`);
    const shortBody = (await shortRes.json()) as TokenResponse;
    const shortLived = shortBody.access_token;
    if (!shortLived) throw new Error('Meta token exchange returned no access_token');

    // 2. short-lived → long-lived (~60-day) token. Meta has no refresh token.
    const long = await this.exchangeLongLived(shortLived, clientId, clientSecret);

    // 3. Resolve the catalog id: first business → its first owned product catalog.
    //    A failure here MUST NOT fail the whole connect — return without an
    //    externalId so the merchant is still connected; catalog can be resolved
    //    later. (Future refinement: let the merchant pick among owned catalogs.)
    const catalog = await this.resolveCatalog(long.accessToken).catch(() => null);

    return {
      accessToken: long.accessToken,
      refreshToken: undefined, // Meta issues no refresh token — re-exchange to renew.
      expiresInSeconds: long.expiresInSeconds,
      scope: 'catalog_management,business_management',
      externalId: catalog?.id,
      shopName: catalog?.name,
    };
  }

  async refresh(refreshToken: string): Promise<ChannelTokens> {
    // `refreshToken` here is the CURRENT long-lived token — Meta renews by
    // re-exchanging it for a fresh long-lived token (no dedicated refresh grant).
    const { clientId, clientSecret } = requireCreds(
      readPlatformCreds(ID_VAR, SECRET_VAR),
      this.name
    );
    const long = await this.exchangeLongLived(refreshToken, clientId, clientSecret);
    return {
      accessToken: long.accessToken,
      refreshToken: undefined,
      expiresInSeconds: long.expiresInSeconds,
      scope: 'catalog_management,business_management',
    };
  }

  async pushProduct(auth: ChannelAuth, product: ChannelProductInput): Promise<ChannelProductRef> {
    const catalogId = this.requireCatalog(auth);

    const requests: ItemsBatchRequest[] = product.variants.map((v) => {
      // retailer_id is the stable key we control; it round-trips as the external id.
      const retailerId = v.sku || v.variantId;
      const name =
        v.title && v.title !== product.title ? `${product.title} - ${v.title}` : product.title;
      const additionalImages = product.imageUrls.slice(1, 11);
      const data: Record<string, unknown> = {
        name,
        description: product.description ?? product.title,
        url: product.productUrl,
        image_url: product.imageUrls[0],
        availability: v.availableQuantity > 0 ? 'in stock' : 'out of stock',
        condition: 'new',
        price: priceString(v.priceCents, product.currency), // "19.99 USD"
        currency: product.currency.toUpperCase(),
        brand: product.brand ?? undefined,
        retailer_product_group_id: product.productId, // groups variants of one product
        google_product_category: product.category ?? undefined,
      };
      if (additionalImages.length > 0) data.additional_image_urls = additionalImages;
      // UPDATE upserts — creates the item if absent, edits it if present.
      return { method: 'UPDATE', retailer_id: retailerId, data };
    });

    await this.itemsBatch(catalogId, auth.accessToken, requests, 'push');

    // Meta's items_batch is async — it returns `handles`, not synchronous fb ids.
    // We map external ids to the retailer_id we control (the sku), which is the
    // stable lookup key for inventory/remove later.
    return {
      externalProductId: product.productId, // = retailer_product_group_id
      variants: product.variants.map((v) => {
        const retailerId = v.sku || v.variantId;
        return { variantId: v.variantId, externalVariantId: retailerId, externalSku: retailerId };
      }),
    };
  }

  async removeProduct(auth: ChannelAuth, externalProductId: string): Promise<void> {
    // The worker calls this per mapped variant with the retailer_id it stored as
    // the external id (items_batch DELETEs one retailer_id at a time).
    const catalogId = this.requireCatalog(auth);
    await this.itemsBatch(
      catalogId,
      auth.accessToken,
      [{ method: 'DELETE', retailer_id: externalProductId }],
      'remove'
    );
  }

  async pushInventory(auth: ChannelAuth, update: ChannelInventoryUpdate): Promise<void> {
    // Availability-only update keyed by the retailer_id (= externalSku).
    const catalogId = this.requireCatalog(auth);
    await this.itemsBatch(
      catalogId,
      auth.accessToken,
      [
        {
          method: 'UPDATE',
          retailer_id: update.externalSku,
          data: { availability: update.availableQuantity > 0 ? 'in stock' : 'out of stock' },
        },
      ],
      'inventory'
    );
  }

  // ── internals ────────────────────────────────────────────────────────────────

  /** Re-exchange a (short- OR long-lived) token for a fresh long-lived token. */
  private async exchangeLongLived(
    token: string,
    clientId: string,
    clientSecret: string
  ): Promise<{ accessToken: string; expiresInSeconds: number }> {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: token,
    });
    const res = await fetchT(`${BASE}/oauth/access_token?${params.toString()}`);
    if (!res.ok)
      throw new Error(`Meta long-lived token exchange failed: ${await describeResponse(res)}`);
    const body = (await res.json()) as TokenResponse;
    if (!body.access_token)
      throw new Error('Meta long-lived token exchange returned no access_token');
    return {
      accessToken: body.access_token,
      // expires_in may be absent on long-lived grants → default ~60 days.
      expiresInSeconds: expiresInSeconds(body.expires_in, LONG_LIVED_FALLBACK_SECONDS),
    };
  }

  /** Resolve the first owned product catalog of the account's first business. */
  private async resolveCatalog(accessToken: string): Promise<{ id: string; name?: string }> {
    const bizRes = await fetchT(
      `${BASE}/me/businesses?access_token=${encodeURIComponent(accessToken)}`
    );
    if (!bizRes.ok)
      throw new Error(`Meta businesses fetch failed: ${await describeResponse(bizRes)}`);
    const businessId = ((await bizRes.json()) as EdgeListResponse).data?.[0]?.id;
    if (!businessId) throw new Error('Meta account has no business');

    const catRes = await fetchT(
      `${BASE}/${businessId}/owned_product_catalogs?access_token=${encodeURIComponent(accessToken)}`
    );
    if (!catRes.ok)
      throw new Error(`Meta catalogs fetch failed: ${await describeResponse(catRes)}`);
    const catalog = ((await catRes.json()) as EdgeListResponse).data?.[0];
    if (!catalog?.id) throw new Error('Meta business has no owned product catalog');
    return { id: catalog.id, name: catalog.name };
  }

  /** POST a batch of UPDATE/DELETE requests to the catalog's items_batch edge. */
  private async itemsBatch(
    catalogId: string,
    accessToken: string,
    requests: ItemsBatchRequest[],
    label: string
  ): Promise<void> {
    const res = await fetchT(`${BASE}/${catalogId}/items_batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: accessToken,
        item_type: 'PRODUCT_ITEM',
        requests,
      }),
    });
    if (!res.ok)
      throw new Error(`Meta items_batch ${label} failed: ${await describeResponse(res)}`);
  }

  /** The catalog id lives on the connection's externalId; a push needs it set. */
  private requireCatalog(auth: ChannelAuth): string {
    if (!auth.externalId)
      throw new Error('Meta connection has no catalog id (externalId) — reconnect to resolve one.');
    return auth.externalId;
  }
}
