// Google Shopping adapter — pushes a tenant's catalog OUT to Google Merchant
// Center via the Content API for Shopping v2.1 (docs/106). This is a FEED channel:
// listings link back to the tenant's sparx storefront and checkout stays there, so
// the adapter implements catalog-out only — no order ingest, fulfillment, or
// analytics. NO SDKs; pure `fetch` (via the shared `fetchT` helper), mirroring the
// dropship printify adapter.
//
// Auth: standard Google OAuth 2.0 (offline access → refresh token). After the code
// exchange we resolve the connected Merchant Center account id from the `authinfo`
// endpoint and carry it as `externalId`; every catalog call is scoped by that id.
//
// Variants → offers: the Content API has no product/variant hierarchy — each variant
// is a separate "offer" grouped by `itemGroupId` (we set it to the sparx productId).
// The inserted offer's id (`online:en:US:{offerId}`) is the per-variant external id
// the worker maps and later passes back to `removeProduct`.
//
// Inventory: Content API products are insert/delete only — there is no partial PATCH.
// Availability therefore rides the FULL catalog re-push (the `product.updated` event
// re-inserts every offer with current availability), so `pushInventory` is omitted
// rather than faked as a no-op partial update.
//
// Content API for Shopping v2.1 docs:
//   https://developers.google.com/shopping-content/reference/rest/v2.1/products

import type {
  ChannelAdapter,
  ChannelAuth,
  ChannelConnectContext,
  ChannelProductInput,
  ChannelProductRef,
  ChannelTokens,
} from '../types.js';
import {
  describeResponse,
  expiresInSeconds,
  fetchT,
  formBody,
  readPlatformCreds,
  requireCreds,
} from './_http.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CONTENT_BASE = 'https://shoppingcontent.googleapis.com/content/v2.1';
const CONTENT_SCOPE = 'https://www.googleapis.com/auth/content';

const ID_VAR = 'GOOGLE_OAUTH_CLIENT_ID';
const SECRET_VAR = 'GOOGLE_OAUTH_CLIENT_SECRET';

// ── Content API payload shapes ─────────────────────────────────────────────────

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

interface GoogleAccountIdentifier {
  merchantId?: string;
  aggregatorId?: string;
}

interface GoogleAuthInfo {
  accountIdentifiers?: GoogleAccountIdentifier[];
}

interface GooglePrice {
  value: string;
  currency: string;
}

interface GoogleProductResource {
  offerId: string;
  title: string;
  description: string;
  link: string;
  imageLink?: string;
  additionalImageLinks?: string[];
  contentLanguage: string;
  targetCountry: string;
  channel: string;
  availability: string;
  price: GooglePrice;
  brand?: string;
  gtin?: string;
  identifierExists?: boolean;
  itemGroupId: string;
  productTypes?: string[];
}

// The inserted resource — `id` is `online:en:US:{offerId}`.
interface GoogleProductInsertResponse {
  id: string;
  offerId?: string;
}

export class GoogleShoppingAdapter implements ChannelAdapter {
  readonly id = 'google_shopping' as const;
  readonly name = 'Google Shopping';
  readonly shape = 'feed' as const;

  // Re-read in each method that needs the creds (process.env can change between a
  // cold isConfigured() check and a later connect/push call).
  private creds() {
    return readPlatformCreds(ID_VAR, SECRET_VAR);
  }

  private headers(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
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
      scope: CONTENT_SCOPE,
      access_type: 'offline',
      prompt: 'consent', // force a refresh_token on every (re)connect
      include_granted_scopes: 'true',
      state: ctx.state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, ctx: ChannelConnectContext): Promise<ChannelTokens> {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    const res = await fetchT(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: ctx.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) {
      throw new Error(`Google token exchange failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as GoogleTokenResponse;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: expiresInSeconds(data.expires_in, 3600),
      scope: data.scope,
      // Best-effort: resolve the Merchant Center account, but don't fail the whole
      // connect if authinfo hiccups — the worker can re-resolve later.
      externalId: await this.resolveMerchantId(data.access_token),
      shopName: undefined,
    };
  }

  /** Resolve the connected Merchant Center account id (merchant or aggregator). */
  private async resolveMerchantId(accessToken: string): Promise<string | undefined> {
    try {
      const res = await fetchT(`${CONTENT_BASE}/accounts/authinfo`, {
        headers: this.headers(accessToken),
      });
      if (!res.ok) return undefined;
      const info = (await res.json()) as GoogleAuthInfo;
      const first = info.accountIdentifiers?.[0];
      const id = first?.merchantId ?? first?.aggregatorId;
      return id ? String(id) : undefined;
    } catch {
      return undefined;
    }
  }

  async refresh(refreshToken: string): Promise<ChannelTokens> {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    const res = await fetchT(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) {
      throw new Error(`Google token refresh failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as GoogleTokenResponse;
    return {
      accessToken: data.access_token,
      refreshToken: undefined, // refresh grants don't return a new refresh_token
      expiresInSeconds: expiresInSeconds(data.expires_in, 3600),
      scope: data.scope,
    };
  }

  async pushProduct(auth: ChannelAuth, product: ChannelProductInput): Promise<ChannelProductRef> {
    const merchantId = auth.externalId;
    const url = `${CONTENT_BASE}/${merchantId}/products`;
    const refs: ChannelProductRef['variants'] = [];

    for (const variant of product.variants) {
      const offerId = variant.sku || variant.variantId;
      const resource = this.buildResource(product, variant, offerId);
      const res = await fetchT(url, {
        method: 'POST',
        headers: this.headers(auth.accessToken),
        body: JSON.stringify(resource),
      });
      if (!res.ok) {
        throw new Error(
          `Google product insert failed (${offerId}): ${await describeResponse(res)}`
        );
      }
      const data = (await res.json()) as GoogleProductInsertResponse;
      refs.push({
        variantId: variant.variantId,
        externalVariantId: data.id, // online:en:US:{offerId}
        externalSku: offerId,
      });
    }

    // itemGroupId = the sparx productId groups every variant offer.
    return { externalProductId: product.productId, variants: refs };
  }

  private buildResource(
    product: ChannelProductInput,
    variant: ChannelProductInput['variants'][number],
    offerId: string
  ): GoogleProductResource {
    const title =
      variant.title && variant.title !== product.title
        ? `${product.title} - ${variant.title}`
        : product.title;
    const [imageLink, ...extra] = product.imageUrls;
    const additionalImageLinks = extra.slice(0, 10);

    return {
      offerId,
      title,
      description: product.description ?? product.title,
      link: product.productUrl,
      ...(imageLink ? { imageLink } : {}),
      ...(additionalImageLinks.length ? { additionalImageLinks } : {}),
      contentLanguage: 'en',
      targetCountry: 'US',
      channel: 'online',
      availability: variant.availableQuantity > 0 ? 'in stock' : 'out of stock',
      price: {
        value: (variant.priceCents / 100).toFixed(2),
        currency: product.currency.toUpperCase(),
      },
      brand: product.brand ?? undefined,
      gtin: variant.barcode ?? undefined,
      // No GTIN/MPN → tell Google identifiers don't exist (else it warns/blocks).
      identifierExists: variant.barcode ? undefined : false,
      itemGroupId: product.productId,
      productTypes: product.category ? [product.category] : undefined,
    };
  }

  // The worker passes the per-variant Google product id here (the `online:en:US:...`
  // id we stored as externalVariantId) — NOT our itemGroupId. Content API products
  // are deleted by their full id; a 404/410 means it's already gone.
  async removeProduct(auth: ChannelAuth, externalProductId: string): Promise<void> {
    const merchantId = auth.externalId;
    const res = await fetchT(
      `${CONTENT_BASE}/${merchantId}/products/${encodeURIComponent(externalProductId)}`,
      { method: 'DELETE', headers: this.headers(auth.accessToken) }
    );
    if (res.ok || res.status === 404 || res.status === 410) return;
    throw new Error(`Google product delete failed: ${await describeResponse(res)}`);
  }
}
