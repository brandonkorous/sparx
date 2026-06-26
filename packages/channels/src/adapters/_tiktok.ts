// Shared TikTok Shop Open Platform plumbing — the SIGNED business-API client, the
// (unsigned) token GET/refresh helpers, the webhook-signature verifier, and the
// response shapes the TikTokShopAdapter consumes. Keeps the adapter file focused on
// the catalog/order/inventory/fulfillment mapping while every byte of signing,
// envelope-unwrapping, and timestamp arithmetic lives here (docs/27 + docs/106).
//
// NO SDKs — pure `fetch` via the shared `fetchT` helper, mirroring the feed
// adapters (google-shopping / meta / pinterest). The worker resolves the per-tenant
// access token and passes it in; these helpers read sparx's PLATFORM app key/secret
// from env (TIKTOK_APP_KEY / TIKTOK_APP_SECRET) and never touch the database.
//
// Signing scheme (docs/27 §4 — the documented TikTok Open Platform algorithm):
//   Every BUSINESS-API call (not the token calls) is signed. Take all query params
//   EXCEPT `sign` and `access_token`, sort the keys ascending, concat them as
//   `${key}${value}` with no separators, prefix the request path, append the raw
//   JSON body string when present, wrap the whole thing in the app secret on both
//   sides, then HMAC-SHA256 it with the app secret. The body string used to SIGN
//   must be byte-identical to the body string SENT — `callTikTok` computes it once.
//
// shop_cipher: after OAuth, TikTok returns an authorized shop whose opaque `cipher`
// scopes every later business call to that shop. The adapter carries it on the
// connection params and passes it to `callTikTok`; a call missing it (other than the
// authorization-scoped shop lookup) is rejected by TikTok, so the adapter guards it.
//
// Live verification is gated on TikTok ISV partner approval — the app must be
// reviewed and the shop authorized before these endpoints respond outside sandbox.

import { createHmac, timingSafeEqual } from 'node:crypto';

import { describeResponse, fetchT } from './_http.js';

// ── Endpoints + env var names ───────────────────────────────────────────────────

export const API_BASE = 'https://open-api.tiktokglobalshop.com';
export const AUTH_URL = 'https://auth.tiktok-shops.com/oauth/authorize';
export const TOKEN_GET_URL = 'https://auth.tiktok-shops.com/api/v2/token/get';
export const TOKEN_REFRESH_URL = 'https://auth.tiktok-shops.com/api/v2/token/refresh';

export const ID_VAR = 'TIKTOK_APP_KEY';
export const SECRET_VAR = 'TIKTOK_APP_SECRET';
export const WEBHOOK_SECRET_VAR = 'TIKTOK_WEBHOOK_SECRET';

// Default access-token lifetime when the token endpoint omits an expiry (~7 days).
const DEFAULT_TOKEN_TTL_SECONDS = 7 * 24 * 3600;
// Above this an `*_expire_in` value is an absolute unix epoch, not a relative TTL.
const ABSOLUTE_EPOCH_THRESHOLD = 1e9;

// ── Response shapes ──────────────────────────────────────────────────────────────

/** TikTok's universal response envelope. `code === 0` is success. */
interface TikTokEnvelope<T> {
  code: number;
  message: string;
  data: T;
  request_id: string;
}

export interface TikTokTokenData {
  access_token: string;
  access_token_expire_in: number;
  refresh_token: string;
  refresh_token_expire_in: number;
  open_id?: string;
  seller_name?: string;
}

export interface TikTokShop {
  id: string;
  name: string;
  region: string;
  cipher: string;
}

export interface TikTokShopList {
  shops: TikTokShop[];
}

export interface TikTokWarehouse {
  id: string;
  name?: string;
  warehouse_type?: string;
}

export interface TikTokWarehouseList {
  warehouses: TikTokWarehouse[];
}

export interface TikTokCategoryRecommendation {
  leaf_category_id: string;
}

export interface TikTokImageUploadResult {
  uri: string;
}

export interface TikTokCreatedSku {
  id: string;
  seller_sku: string;
}

export interface TikTokCreatedProduct {
  product_id: string;
  skus: TikTokCreatedSku[];
}

export interface TikTokAddress {
  name?: string;
  full_address?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  region_code?: string;
  phone_number?: string;
}

export interface TikTokOrderLineItem {
  id: string;
  seller_sku?: string;
  sku_id?: string;
  product_name?: string;
  sale_price?: string;
  currency?: string;
}

export interface TikTokPayment {
  currency?: string;
  total_amount?: string;
  platform_discount?: string;
  platform_fee?: string;
}

export interface TikTokOrder {
  id: string;
  status: string;
  create_time: number | string;
  buyer_email?: string;
  payment?: TikTokPayment;
  recipient_address?: TikTokAddress;
  line_items: TikTokOrderLineItem[];
}

export interface TikTokOrderList {
  orders: TikTokOrder[];
}

export interface TikTokPackage {
  id: string;
}

export interface TikTokPackageList {
  packages: TikTokPackage[];
}

export interface TikTokShippingProvider {
  id: string;
  name?: string;
}

export interface TikTokShippingProviderList {
  shipping_providers: TikTokShippingProvider[];
}

export interface TikTokOrderSearchPage {
  orders?: TikTokOrder[];
  next_page_token?: string;
}

/** The single-order status-change webhook payload (docs/27 §6). Narrowed in the
 *  adapter from `unknown`. */
export interface TikTokWebhookPayload {
  type?: number | string;
  shop_id?: string;
  data?: { order_id?: string; order_status?: string };
}

// ── Signing ──────────────────────────────────────────────────────────────────────

/**
 * Compute the TikTok request signature (docs/27 §4). `query` excludes `sign` and
 * `access_token`; `body` is the EXACT JSON string that will be sent (empty for GET /
 * multipart). HMAC-SHA256 keyed by the app secret over `secret + base + secret`.
 */
export function signRequest(
  appSecret: string,
  path: string,
  query: Record<string, string>,
  body: string
): string {
  const concatParams = Object.keys(query)
    .filter((key) => key !== 'sign' && key !== 'access_token')
    .sort()
    .map((key) => `${key}${query[key] ?? ''}`)
    .join('');

  let base = `${path}${concatParams}`;
  if (body) base += body;

  const wrapped = `${appSecret}${base}${appSecret}`;
  return createHmac('sha256', appSecret).update(wrapped).digest('hex');
}

// ── Signed business-API client ───────────────────────────────────────────────────

export interface CallTikTokOptions<TBody = unknown> {
  appKey: string;
  appSecret: string;
  accessToken: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  query?: Record<string, string>;
  body?: TBody;
  shopCipher?: string;
}

/**
 * Make ONE signed business-API call and return the unwrapped `data`. Builds the
 * common query (`app_key`, `timestamp`, optional `shop_cipher`, caller query),
 * signs it together with the exact body string, and sends that same body string —
 * keeping the signed and sent bytes identical. Throws with a described response on a
 * transport error OR a non-zero envelope code.
 */
export async function callTikTok<T, TBody = unknown>(opts: CallTikTokOptions<TBody>): Promise<T> {
  const { appKey, appSecret, accessToken, method, path, query, body, shopCipher } = opts;

  const q: Record<string, string> = {
    app_key: appKey,
    timestamp: Math.floor(Date.now() / 1000).toString(),
    ...(shopCipher ? { shop_cipher: shopCipher } : {}),
    ...(query ?? {}),
  };

  // Compute the body string ONCE so the signed bytes equal the sent bytes.
  const bodyStr = body !== undefined ? JSON.stringify(body) : '';
  q.sign = signRequest(appSecret, path, q, bodyStr);

  const url = `${API_BASE}${path}?${new URLSearchParams(q).toString()}`;
  const res = await fetchT(url, {
    method,
    headers: { 'content-type': 'application/json', 'x-tts-access-token': accessToken },
    body: body !== undefined ? bodyStr : undefined,
  });

  if (!res.ok) {
    throw new Error(`TikTok ${path} failed: ${await describeResponse(res)}`);
  }

  const envelope = (await res.json()) as TikTokEnvelope<T>;
  if (envelope.code !== 0) {
    throw new Error(`TikTok ${path} failed: code ${envelope.code} ${envelope.message}`);
  }
  return envelope.data;
}

// ── Token TTL ────────────────────────────────────────────────────────────────────

/**
 * TikTok's token endpoint returns `*_expire_in` as an ABSOLUTE unix-epoch-seconds in
 * many API versions. If the value looks like an absolute epoch (> 1e9), convert it to
 * a relative seconds-until-expiry (clamped to a 60s floor); otherwise treat it as
 * already-relative. Falls back to a sane default when missing.
 */
export function tiktokExpiresInSeconds(raw: unknown): number {
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_TOKEN_TTL_SECONDS;
  if (value > ABSOLUTE_EPOCH_THRESHOLD) {
    const relative = value - Math.floor(Date.now() / 1000);
    return Math.max(relative, 60);
  }
  return value;
}

// ── Webhook signature ────────────────────────────────────────────────────────────

/**
 * Verify a TikTok webhook signature: `HMAC_SHA256(appSecret, appKey + rawBody)` hex,
 * compared to the header value in constant time. Any length mismatch or comparison
 * error returns false rather than throwing.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  appKey: string,
  appSecret: string
): boolean {
  if (!signatureHeader) return false;
  try {
    const expected = createHmac('sha256', appSecret).update(`${appKey}${rawBody}`).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signatureHeader, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Token GET / refresh (UNSIGNED — app_key/app_secret travel in the query) ──────

/** Exchange an OAuth `auth_code` for the initial access/refresh token pair. */
export async function getToken(
  appKey: string,
  appSecret: string,
  authCode: string
): Promise<TikTokTokenData> {
  const params = new URLSearchParams({
    app_key: appKey,
    app_secret: appSecret,
    auth_code: authCode,
    grant_type: 'authorized_code',
  });
  const res = await fetchT(`${TOKEN_GET_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`TikTok token exchange failed: ${await describeResponse(res)}`);
  }
  const envelope = (await res.json()) as TikTokEnvelope<TikTokTokenData>;
  if (envelope.code !== 0) {
    throw new Error(`TikTok token exchange failed: code ${envelope.code} ${envelope.message}`);
  }
  return envelope.data;
}

/** Rotate the access token (and refresh token — TikTok rotates it) via a refresh grant. */
export async function refreshToken(
  appKey: string,
  appSecret: string,
  refresh: string
): Promise<TikTokTokenData> {
  const params = new URLSearchParams({
    app_key: appKey,
    app_secret: appSecret,
    refresh_token: refresh,
    grant_type: 'refresh_token',
  });
  const res = await fetchT(`${TOKEN_REFRESH_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`TikTok token refresh failed: ${await describeResponse(res)}`);
  }
  const envelope = (await res.json()) as TikTokEnvelope<TikTokTokenData>;
  if (envelope.code !== 0) {
    throw new Error(`TikTok token refresh failed: code ${envelope.code} ${envelope.message}`);
  }
  return envelope.data;
}
