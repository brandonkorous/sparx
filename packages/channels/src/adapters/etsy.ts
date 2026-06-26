// Etsy adapter — a bidirectional ORDER-shape channel (docs/106). Etsy owns checkout:
// sparx pushes the catalog OUT as draft listings, POLLS receipts for new orders (Etsy
// has NO order webhooks), pushes tracking + inventory BACK, and pages receipts for the
// analytics breakdown. Pure `fetch` against the Etsy Open API v3 — NO SDKs; the
// channel-sync-worker owns every DB write.
//
// Auth: OAuth 2.0 Authorization Code WITH PKCE (Etsy REQUIRES PKCE — there is no
// plain authorization-code grant). The "keystring" (ETSY_API_KEY) is BOTH the OAuth
// `client_id` AND the `x-api-key` header every API call must carry; ETSY_API_SECRET is
// the app's shared secret.
//
//   PKCE in a STATELESS adapter — the footgun. PKCE normally needs the connect step to
//   stash a random `code_verifier` somewhere `exchangeCode` can read it back. This
//   adapter holds no state between connect and callback (it's one stateless instance
//   per worker), so instead of inventing a store we derive the verifier
//   DETERMINISTICALLY from the signed OAuth `state`:
//       verifier  = base64url( HMAC-SHA256(appSecret, ctx.state) )   // 43 chars, opaque
//       challenge = base64url( SHA-256(verifier) )
//   `connectUrl` sends the challenge; `exchangeCode` recomputes the SAME verifier from
//   the same `state` (which Etsy round-trips on the callback) and sends it. The app
//   secret never leaves the server, so the verifier is unguessable without it, and the
//   `state` is already the signed connect-to-callback correlator — so this adds no new
//   trust assumption beyond "the state is authentic", which OAuth already requires.
//
// access_token shape: Etsy returns `{user_id}.{token}` — the prefix before the first
// `.` is the authenticated user id. We split it out to resolve the shop post-auth and
// carry it on `params.userId` for any later user-scoped call.
//
// Etsy Open API v3 reference: https://developers.etsy.com/documentation/reference

import { createHash, createHmac } from 'node:crypto';

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

const CONNECT_URL = 'https://www.etsy.com/oauth/connect';
const TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';
const API_BASE = 'https://api.etsy.com/v3/application';
const SCOPES = 'listings_r listings_w transactions_r transactions_w';

const ID_VAR = 'ETSY_API_KEY';
const SECRET_VAR = 'ETSY_API_SECRET';

// Etsy REQUIRES a taxonomy_id on every listing; sparx doesn't model an Etsy taxonomy
// mapping yet, so we default to the most generic node. The real category → taxonomy_id
// mapping is a documented follow-up (see the report in the PR). 1 = a valid top-level
// taxonomy node ("Accessories"); a tenant whose catalog needs a specific node must wait
// on the taxonomy-mapping work before its listings land in the right Etsy category.
const DEFAULT_TAXONOMY_ID = 1;
const RECEIPTS_PAGE_SIZE = 100;
const ANALYTICS_PAGE_CAP = 50;

// ── Etsy API response shapes ────────────────────────────────────────────────────

interface EtsyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
}

interface EtsyShop {
  shop_id: number;
  shop_name: string;
}

interface EtsyShopList {
  count: number;
  results: EtsyShop[];
}

interface EtsyCreatedListing {
  listing_id: number;
}

interface EtsyMoney {
  amount: number;
  divisor: number;
  currency_code: string;
}

interface EtsyInventoryOffering {
  quantity: number;
  price: number | EtsyMoney;
}

interface EtsyInventoryProduct {
  product_id?: number;
  sku: string;
  offerings: EtsyInventoryOffering[];
}

interface EtsyInventory {
  products: EtsyInventoryProduct[];
  price_on_property?: number[];
  quantity_on_property?: number[];
  sku_on_property?: number[];
}

interface EtsyTransaction {
  sku?: string | null;
  quantity: number;
  price: EtsyMoney;
}

interface EtsyReceipt {
  receipt_id: number;
  status: string;
  created_timestamp: number;
  currency_code: string;
  buyer_email?: string | null;
  name?: string | null;
  first_line?: string | null;
  second_line?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country_iso?: string | null;
  grandtotal?: EtsyMoney;
  transactions?: EtsyTransaction[];
}

interface EtsyReceiptList {
  count: number;
  results: EtsyReceipt[];
}

export class EtsyAdapter implements ChannelAdapter {
  readonly id = 'etsy' as const;
  readonly name = 'Etsy';
  readonly shape = 'order' as const;

  // Re-read in each method that needs the creds (process.env can change between a
  // cold isConfigured() check and a later connect/push call).
  private creds(): PlatformOAuthCreds | null {
    return readPlatformCreds(ID_VAR, SECRET_VAR);
  }

  /** Auth headers every Etsy v3 call needs: the platform keystring + the bearer token. */
  private headers(keystring: string, accessToken: string): Record<string, string> {
    return {
      'x-api-key': keystring,
      Authorization: `Bearer ${accessToken}`,
    };
  }

  isConfigured(): boolean {
    return this.creds() !== null;
  }

  // ── install / auth ───────────────────────────────────────────────────────────────

  connectUrl(ctx: ChannelConnectContext): string {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    const verifier = this.deriveVerifier(clientSecret, ctx.state);
    const challenge = base64url(createHash('sha256').update(verifier).digest());
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId, // Etsy keystring doubles as the OAuth client_id.
      redirect_uri: ctx.redirectUri,
      scope: SCOPES,
      state: ctx.state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return `${CONNECT_URL}?${params.toString()}`;
  }

  /**
   * Recompute the PKCE `code_verifier` from the OAuth state. Deterministic so the
   * stateless `exchangeCode` can reproduce exactly what `connectUrl` committed to,
   * without any server-side store. HMAC keyed by the never-leaked app secret →
   * unguessable; base64url → an Etsy-valid 43-char verifier (43..128 chars allowed).
   */
  private deriveVerifier(appSecret: string, state: string): string {
    return base64url(createHmac('sha256', appSecret).update(state).digest());
  }

  async exchangeCode(code: string, ctx: ChannelConnectContext): Promise<ChannelTokens> {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    const res = await fetchT(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: ctx.redirectUri,
        code,
        code_verifier: this.deriveVerifier(clientSecret, ctx.state),
      }),
    });
    if (!res.ok) {
      throw new Error(`Etsy token exchange failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as EtsyTokenResponse;

    // access_token is `{user_id}.{token}` — the prefix is the authenticated user id.
    const userId = data.access_token.split('.')[0] ?? '';
    const shop = await this.resolveShop(clientId, data.access_token, userId);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: expiresInSeconds(data.expires_in, 3600),
      scope: SCOPES,
      externalId: shop ? String(shop.shop_id) : undefined,
      shopName: shop?.shop_name,
      // Carry the user id for any later user-scoped call; the worker round-trips it
      // back as ChannelAuth.params on every invocation.
      params: { userId },
    };
  }

  /** Resolve the connected shop (id + name) from the authenticated user. Best-effort:
   *  a hiccup here doesn't fail the whole connect — the worker can re-resolve later. */
  private async resolveShop(
    keystring: string,
    accessToken: string,
    userId: string
  ): Promise<EtsyShop | undefined> {
    if (!userId) return undefined;
    try {
      const res = await fetchT(`${API_BASE}/users/${encodeURIComponent(userId)}/shops`, {
        headers: this.headers(keystring, accessToken),
      });
      if (!res.ok) return undefined;
      const list = (await res.json()) as EtsyShopList;
      return list.results[0];
    } catch {
      return undefined;
    }
  }

  async refresh(refreshToken: string): Promise<ChannelTokens> {
    const { clientId } = requireCreds(this.creds(), this.name);
    const res = await fetchT(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) {
      throw new Error(`Etsy token refresh failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as EtsyTokenResponse;
    return {
      accessToken: data.access_token,
      // Etsy rotates the refresh token — surface the new one when returned.
      refreshToken: data.refresh_token,
      expiresInSeconds: expiresInSeconds(data.expires_in, 3600),
      scope: SCOPES,
    };
  }

  // ── catalog out ──────────────────────────────────────────────────────────────────

  async pushProduct(auth: ChannelAuth, product: ChannelProductInput): Promise<ChannelProductRef> {
    const shopId = auth.externalId;
    const first = product.variants[0];
    if (!first) {
      throw new Error(`Etsy listing for "${product.title}" has no variants to price.`);
    }

    // 1. Create a DRAFT listing. Etsy seeds the listing-level price/quantity from the
    //    first variant; per-variant pricing is set via the inventory call below.
    const totalQuantity = product.variants.reduce((sum, v) => sum + v.availableQuantity, 0);
    const created = await this.post<EtsyCreatedListing>(
      auth,
      `/shops/${encodeURIComponent(shopId)}/listings`,
      formBody({
        quantity: String(Math.max(totalQuantity, 1)),
        title: product.title,
        description: product.description ?? product.title,
        price: (first.priceCents / 100).toFixed(2),
        who_made: 'i_did',
        when_made: 'made_to_order',
        taxonomy_id: String(DEFAULT_TAXONOMY_ID),
      }),
      'listing create'
    );
    const listingId = created.listing_id;

    // 2. Set per-variant inventory (sparx variants → Etsy products[].sku + offerings).
    const variants = await this.putListingInventory(auth, listingId, product);

    // 3. Upload images (best-effort; a failed image must not orphan a created listing).
    await this.uploadImages(auth, shopId, listingId, product.imageUrls);

    return { externalProductId: String(listingId), variants };
  }

  /** Map every sparx variant into an Etsy inventory product and PUT it, then read the
   *  assigned product_ids back from the response so the worker can map them. */
  private async putListingInventory(
    auth: ChannelAuth,
    listingId: number,
    product: ChannelProductInput
  ): Promise<ChannelProductRef['variants']> {
    const products = product.variants.map((v) => ({
      sku: v.sku,
      offerings: [
        {
          price: Number((v.priceCents / 100).toFixed(2)),
          quantity: v.availableQuantity,
          is_enabled: true,
        },
      ],
      // No variation properties yet → an empty property-value list (single offering).
      property_values: [],
    }));

    const updated = await this.put<EtsyInventory>(
      auth,
      `/listings/${listingId}/inventory`,
      JSON.stringify({ products }),
      'listing inventory',
      'application/json'
    );

    // Match each sparx variant to the returned Etsy product by sku to recover product_id.
    return product.variants.map((v) => {
      const matched = updated.products.find((p) => p.sku === v.sku);
      return {
        variantId: v.variantId,
        externalSku: v.sku,
        externalVariantId:
          matched?.product_id !== undefined ? String(matched.product_id) : undefined,
      };
    });
  }

  /** Fetch each image's bytes and POST them as multipart (field `image`). Best-effort:
   *  one bad image URL shouldn't roll back the whole listing, so failures are skipped. */
  private async uploadImages(
    auth: ChannelAuth,
    shopId: string,
    listingId: number,
    imageUrls: string[]
  ): Promise<void> {
    const keystring = this.keystring();
    for (const url of imageUrls) {
      const imgRes = await fetchT(url).catch(() => null);
      if (!imgRes || !imgRes.ok) continue;
      const bytes = await imgRes.arrayBuffer();
      const form = new FormData();
      form.append('image', new Blob([bytes]), 'image.jpg');
      // Multipart — let fetch set the boundary; only the auth headers go on by hand.
      const res = await fetchT(
        `${API_BASE}/shops/${encodeURIComponent(shopId)}/listings/${listingId}/images`,
        { method: 'POST', headers: this.headers(keystring, auth.accessToken), body: form }
      );
      if (!res.ok) {
        // Skip a rejected image rather than fail the push — the listing already exists.
        continue;
      }
    }
  }

  // The worker passes the listing id (our externalProductId). A 404 means it's already
  // gone — treat as success so deletes stay idempotent.
  async removeProduct(auth: ChannelAuth, externalProductId: string): Promise<void> {
    const keystring = this.keystring();
    const res = await fetchT(`${API_BASE}/listings/${encodeURIComponent(externalProductId)}`, {
      method: 'DELETE',
      headers: this.headers(keystring, auth.accessToken),
    });
    if (res.ok || res.status === 404) return;
    throw new Error(`Etsy listing delete failed: ${await describeResponse(res)}`);
  }

  // ── order ingest (POLL — Etsy has no order webhooks) ───────────────────────────────

  async fetchOrders(
    auth: ChannelAuth,
    opts: ChannelOrderPollCursor
  ): Promise<NormalizedChannelOrder[]> {
    const keystring = this.keystring();
    const shopId = auth.externalId;
    const minModified = Math.floor(new Date(opts.since).getTime() / 1000);

    const orders: NormalizedChannelOrder[] = [];
    let offset = 0;
    // Page until a short page (or the analytics cap) — receipts are returned newest-first.
    for (let page = 0; page < ANALYTICS_PAGE_CAP; page += 1) {
      const query = new URLSearchParams({
        min_last_modified: String(minModified),
        limit: String(RECEIPTS_PAGE_SIZE),
        offset: String(offset),
        was_paid: 'true',
      });
      const res = await fetchT(
        `${API_BASE}/shops/${encodeURIComponent(shopId)}/receipts?${query.toString()}`,
        { headers: this.headers(keystring, auth.accessToken) }
      );
      if (!res.ok) {
        throw new Error(`Etsy fetch orders failed: ${await describeResponse(res)}`);
      }
      const list = (await res.json()) as EtsyReceiptList;
      const results = list.results ?? [];
      for (const receipt of results) {
        orders.push(this.normalizeReceipt(receipt));
      }
      if (results.length < RECEIPTS_PAGE_SIZE) break;
      offset += RECEIPTS_PAGE_SIZE;
    }
    return orders;
  }

  private normalizeReceipt(receipt: EtsyReceipt): NormalizedChannelOrder {
    const name = receipt.name ?? null;
    const shippingAddress =
      receipt.first_line || receipt.city || receipt.zip
        ? {
            name: name ?? '',
            line1: receipt.first_line ?? '',
            line2: receipt.second_line ?? undefined,
            city: receipt.city ?? '',
            region: receipt.state ?? undefined,
            postalCode: receipt.zip ?? '',
            countryCode: receipt.country_iso ?? '',
          }
        : null;

    return {
      externalId: String(receipt.receipt_id),
      externalStatus: receipt.status,
      placedAt: new Date(receipt.created_timestamp * 1000).toISOString(),
      currency: receipt.currency_code,
      customer: {
        email: receipt.buyer_email ?? null,
        name,
      },
      shippingAddress,
      lines: (receipt.transactions ?? []).map((t) => ({
        externalSku: t.sku ?? '',
        quantity: t.quantity,
        unitPriceCents: moneyToCents(t.price),
      })),
      // Etsy receipts don't expose the marketplace fee on this endpoint — leave it
      // undefined rather than guess; net-revenue reconciliation tolerates an absent fee.
    };
  }

  // ── fulfillment push ───────────────────────────────────────────────────────────────

  async pushFulfillment(auth: ChannelAuth, fulfillment: ChannelFulfillment): Promise<void> {
    const shopId = auth.externalId;
    await this.post<unknown>(
      auth,
      `/shops/${encodeURIComponent(shopId)}/receipts/${encodeURIComponent(fulfillment.externalOrderId)}/tracking`,
      formBody({
        tracking_code: fulfillment.trackingNumber,
        carrier_name: fulfillment.carrier,
        send_bcc: 'true',
      }),
      'fulfillment'
    );
  }

  // ── inventory push ─────────────────────────────────────────────────────────────────

  async pushInventory(auth: ChannelAuth, update: ChannelInventoryUpdate): Promise<void> {
    if (!update.externalProductId) {
      throw new Error('Etsy inventory update requires the external listing id.');
    }
    const keystring = this.keystring();

    // 1. Read the current inventory so we mutate only the targeted sku's quantity.
    const getRes = await fetchT(
      `${API_BASE}/listings/${encodeURIComponent(update.externalProductId)}/inventory`,
      { headers: this.headers(keystring, auth.accessToken) }
    );
    if (!getRes.ok) {
      throw new Error(`Etsy inventory read failed: ${await describeResponse(getRes)}`);
    }
    const inventory = (await getRes.json()) as EtsyInventory;

    const target = inventory.products.find((p) => p.sku === update.externalSku);
    if (!target) {
      throw new Error(
        `Etsy listing ${update.externalProductId} has no product with sku "${update.externalSku}".`
      );
    }
    for (const offering of target.offerings) {
      offering.quantity = update.availableQuantity;
    }

    // 2. PUT the WHOLE modified inventory back — Etsy replaces it wholesale, so we
    //    must send every product (offerings normalized to the price/quantity shape).
    await this.put<EtsyInventory>(
      auth,
      `/listings/${encodeURIComponent(update.externalProductId)}/inventory`,
      JSON.stringify({ products: inventory.products.map((p) => this.toInventoryProduct(p)) }),
      'inventory',
      'application/json'
    );
  }

  /** Reshape a read-back inventory product into the write payload Etsy expects (a flat
   *  numeric `price`, not the {amount,divisor} read shape). */
  private toInventoryProduct(p: EtsyInventoryProduct): Record<string, unknown> {
    return {
      sku: p.sku,
      property_values: [],
      offerings: p.offerings.map((o) => ({
        price: typeof o.price === 'number' ? o.price : moneyToCents(o.price) / 100,
        quantity: o.quantity,
        is_enabled: true,
      })),
    };
  }

  // ── analytics ──────────────────────────────────────────────────────────────────────

  async getAnalytics(auth: ChannelAuth, period: ChannelPeriod): Promise<ChannelAnalytics> {
    const keystring = this.keystring();
    const shopId = auth.externalId;
    const minCreated = Math.floor(new Date(period.start).getTime() / 1000);
    const maxCreated = Math.floor(new Date(period.end).getTime() / 1000);

    let revenueCents = 0;
    let orderCount = 0;
    let offset = 0;

    for (let page = 0; page < ANALYTICS_PAGE_CAP; page += 1) {
      const query = new URLSearchParams({
        min_created: String(minCreated),
        max_created: String(maxCreated),
        limit: String(RECEIPTS_PAGE_SIZE),
        offset: String(offset),
        was_paid: 'true',
      });
      const res = await fetchT(
        `${API_BASE}/shops/${encodeURIComponent(shopId)}/receipts?${query.toString()}`,
        { headers: this.headers(keystring, auth.accessToken) }
      );
      if (!res.ok) {
        throw new Error(`Etsy analytics fetch failed: ${await describeResponse(res)}`);
      }
      const list = (await res.json()) as EtsyReceiptList;
      const results = list.results ?? [];
      for (const receipt of results) {
        if (receipt.grandtotal) revenueCents += moneyToCents(receipt.grandtotal);
        orderCount += 1;
      }
      if (results.length < RECEIPTS_PAGE_SIZE) break;
      offset += RECEIPTS_PAGE_SIZE;
    }

    return { revenueCents, orderCount };
  }

  // ── internals ────────────────────────────────────────────────────────────────────

  /** The platform keystring — both the OAuth client_id and the `x-api-key` header. */
  private keystring(): string {
    return requireCreds(this.creds(), this.name).clientId;
  }

  /** POST helper: auth headers + the given body, surfacing the channel error on !ok. */
  private async post<T>(
    auth: ChannelAuth,
    path: string,
    body: string,
    op: string,
    contentType = 'application/x-www-form-urlencoded'
  ): Promise<T> {
    return this.send<T>(auth, 'POST', path, body, op, contentType);
  }

  /** PUT helper — same envelope as {@link post}. */
  private async put<T>(
    auth: ChannelAuth,
    path: string,
    body: string,
    op: string,
    contentType = 'application/x-www-form-urlencoded'
  ): Promise<T> {
    return this.send<T>(auth, 'PUT', path, body, op, contentType);
  }

  private async send<T>(
    auth: ChannelAuth,
    method: 'POST' | 'PUT',
    path: string,
    body: string,
    op: string,
    contentType: string
  ): Promise<T> {
    const keystring = this.keystring();
    const res = await fetchT(`${API_BASE}${path}`, {
      method,
      headers: { ...this.headers(keystring, auth.accessToken), 'Content-Type': contentType },
      body,
    });
    if (!res.ok) {
      throw new Error(`Etsy ${op} failed: ${await describeResponse(res)}`);
    }
    return (await res.json()) as T;
  }
}

// ── module-private helpers ─────────────────────────────────────────────────────────

/** RFC 4648 §5 base64url (no padding) — the encoding both the PKCE verifier and the
 *  challenge use. */
function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Etsy money → integer cents. Etsy expresses money as `{amount, divisor}` (e.g.
 *  amount 1999, divisor 100 = 19.99) — convert to cents, guarding a zero divisor. */
function moneyToCents(money: EtsyMoney): number {
  const divisor = money.divisor || 100;
  return Math.round((money.amount / divisor) * 100);
}
