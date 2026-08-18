// Pinterest adapter — pushes a tenant's catalog OUT to Pinterest via the Catalogs
// items batch endpoint on the Pinterest API v5 (docs/106). This is a FEED channel:
// shoppable Pins link back to the tenant's sparx storefront and checkout stays
// there, so the adapter implements catalog-out only — no order ingest, fulfillment,
// or analytics. NO SDKs; pure `fetch` (via the shared `fetchT` helper), mirroring
// the dropship printify adapter.
//
// Auth: standard Pinterest OAuth 2.0 — the token exchange/refresh authenticates
// with HTTP Basic (client_id:client_secret) and the body carries the grant. After
// the code exchange we resolve the connected account handle from `/user_account`
// and carry it as `externalId`. Pinterest may ROTATE the refresh token on refresh,
// so we surface whatever the response returns.
//
// Variants → catalog items: the Catalogs API has no product/variant hierarchy —
// each variant is a flat catalog item keyed by `item_id` (the variant SKU), grouped
// by `item_group_id` (set to the sparx productId). The item_id we send is the
// per-variant external id the worker maps and later passes back to `removeProduct`
// and `pushInventory`.
//
// Pinterest API v5 Catalogs docs:
//   https://developers.pinterest.com/docs/api/v5/catalogs_items_batch-create

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
  basicAuth,
  describeResponse,
  expiresInSeconds,
  fetchT,
  formBody,
  readPlatformCreds,
  requireCreds,
} from './_http.js';

const AUTH_URL = 'https://www.pinterest.com/oauth/';
const BASE = 'https://api.pinterest.com/v5';
const SCOPE = 'catalogs:read,catalogs:write,user_accounts:read';

const ID_VAR = 'PINTEREST_APP_ID';
const SECRET_VAR = 'PINTEREST_APP_SECRET';

// Catalog items are country/language-scoped; the feed targets US/English (mirrors
// the Google Shopping adapter's targetCountry/contentLanguage).
const COUNTRY = 'US';
const LANGUAGE = 'en';

// ── Pinterest API v5 payload shapes ─────────────────────────────────────────────

interface PinterestTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

interface PinterestUserAccount {
  username: string;
  id?: string;
}

// One catalog item's attributes — the shoppable-Pin fields the feed populates.
interface PinterestItemAttributes {
  title: string;
  description: string;
  link: string;
  image_link?: string;
  additional_image_link?: string[];
  availability: string;
  price: string;
  condition: string;
  brand?: string;
  item_group_id?: string;
  google_product_category?: string;
  gtin?: string;
}

interface PinterestCatalogItem {
  item_id: string;
  // Full attributes on UPSERT; a partial (availability-only) attributes object on an
  // inventory flip; absent on DELETE.
  attributes?: Partial<PinterestItemAttributes>;
}

interface PinterestBatchRequest {
  country: string;
  language: string;
  operation: 'UPSERT' | 'DELETE';
  items: PinterestCatalogItem[];
}

// The batch enqueues asynchronously and returns a `batch_id` to poll if desired.
interface PinterestBatchResponse {
  batch_id?: string;
}

export class PinterestAdapter implements ChannelAdapter {
  readonly id = 'pinterest' as const;
  readonly name = 'Pinterest';
  readonly shape = 'feed' as const;

  // Re-read in each method that needs the creds (process.env can change between a
  // cold isConfigured() check and a later connect/push call).
  private creds() {
    return readPlatformCreds(ID_VAR, SECRET_VAR);
  }

  private bearer(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  isConfigured(): boolean {
    return this.creds() !== null;
  }

  connectUrl(ctx: ChannelConnectContext): string {
    const { clientId } = requireCreds(this.creds(), this.name);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: ctx.redirectUri,
      response_type: 'code',
      scope: SCOPE,
      state: ctx.state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, ctx: ChannelConnectContext): Promise<ChannelTokens> {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    const res = await fetchT(`${BASE}/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(clientId, clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody({
        grant_type: 'authorization_code',
        code,
        redirect_uri: ctx.redirectUri,
      }),
    });
    if (!res.ok) {
      throw new Error(`Pinterest token exchange failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as PinterestTokenResponse;

    // Best-effort: resolve the connected account handle, but don't fail the whole
    // connect if /user_account hiccups — the worker can re-resolve later.
    const username = await this.resolveAccount(data.access_token);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: expiresInSeconds(data.expires_in, 3600),
      scope: data.scope,
      externalId: username,
      shopName: username,
    };
  }

  /** Resolve the connected Pinterest account handle (its `username`). */
  private async resolveAccount(accessToken: string): Promise<string | undefined> {
    try {
      const res = await fetchT(`${BASE}/user_account`, { headers: this.bearer(accessToken) });
      if (!res.ok) return undefined;
      const info = (await res.json()) as PinterestUserAccount;
      return info.username || undefined;
    } catch {
      return undefined;
    }
  }

  async refresh(refreshToken: string): Promise<ChannelTokens> {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    const res = await fetchT(`${BASE}/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(clientId, clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    if (!res.ok) {
      throw new Error(`Pinterest token refresh failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as PinterestTokenResponse;
    return {
      accessToken: data.access_token,
      // Pinterest may rotate the refresh token — surface the new one when present.
      refreshToken: data.refresh_token ?? undefined,
      expiresInSeconds: expiresInSeconds(data.expires_in, 3600),
      scope: data.scope,
    };
  }

  async pushProduct(auth: ChannelAuth, product: ChannelProductInput): Promise<ChannelProductRef> {
    const items: PinterestCatalogItem[] = product.variants.map((variant) => {
      const itemId = variant.sku || variant.variantId;
      return { item_id: itemId, attributes: this.buildAttributes(product, variant) };
    });

    await this.batch({ country: COUNTRY, language: LANGUAGE, operation: 'UPSERT', items }, auth);

    // item_group_id = the sparx productId groups every variant item; the per-variant
    // external id IS the item_id we send (used by removeProduct + pushInventory).
    return {
      externalProductId: product.productId,
      variants: product.variants.map((variant) => {
        const itemId = variant.sku || variant.variantId;
        return { variantId: variant.variantId, externalVariantId: itemId, externalSku: itemId };
      }),
    };
  }

  private buildAttributes(
    product: ChannelProductInput,
    variant: ChannelProductInput['variants'][number]
  ): PinterestItemAttributes {
    const title =
      variant.title && variant.title !== product.title
        ? `${product.title} - ${variant.title}`
        : product.title;
    const [imageLink, ...extra] = product.imageUrls;
    const additionalImageLink = extra.slice(0, 10);

    return {
      title,
      description: product.description ?? product.title,
      link: product.productUrl,
      ...(imageLink ? { image_link: imageLink } : {}),
      ...(additionalImageLink.length ? { additional_image_link: additionalImageLink } : {}),
      availability: variant.availableQuantity > 0 ? 'in stock' : 'out of stock',
      price: `${(variant.priceCents / 100).toFixed(2)} ${product.currency.toUpperCase()}`,
      condition: 'new',
      brand: product.brand ?? undefined,
      item_group_id: product.productId,
      google_product_category: product.category ?? undefined,
      gtin: variant.barcode ?? undefined,
    };
  }

  // The worker calls this PER MAPPED VARIANT, passing the item_id it stored as the
  // variant's external id (NOT our productId). A DELETE batch removes that one item.
  async removeProduct(auth: ChannelAuth, externalProductId: string): Promise<void> {
    await this.batch(
      {
        country: COUNTRY,
        language: LANGUAGE,
        operation: 'DELETE',
        items: [{ item_id: externalProductId }],
      },
      auth
    );
  }

  // Availability-only UPSERT for one mapped SKU — flips in/out of stock without a
  // full re-push of the item's attributes.
  async pushInventory(auth: ChannelAuth, update: ChannelInventoryUpdate): Promise<void> {
    await this.batch(
      {
        country: COUNTRY,
        language: LANGUAGE,
        operation: 'UPSERT',
        items: [
          {
            item_id: update.externalSku,
            attributes: {
              availability: update.availableQuantity > 0 ? 'in stock' : 'out of stock',
            },
          },
        ],
      },
      auth
    );
  }

  /** POST one catalog-items batch; surface the response body on a non-ok status. */
  private async batch(
    body: PinterestBatchRequest,
    auth: ChannelAuth
  ): Promise<PinterestBatchResponse> {
    const res = await fetchT(`${BASE}/catalogs/items/batch`, {
      method: 'POST',
      headers: this.bearer(auth.accessToken),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(
        `Pinterest catalog ${body.operation.toLowerCase()} failed: ${await describeResponse(res)}`
      );
    }
    return (await res.json().catch(() => ({}))) as PinterestBatchResponse;
  }
}
