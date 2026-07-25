// Shared Meta Graph API helpers for the Facebook Page + Instagram adapters (docs/133
// §6). Both ride ONE Meta app (`META_APP_ID` / `META_APP_SECRET`) and one Facebook
// Login grant: the OAuth handshake, the short→long-lived user-token exchange, the
// `/me` identity lookup, and the Page listing (which carries each Page's own access
// token + any linked Instagram business account) are identical — so they live here and
// each adapter adds only its own publish shape.
//
// Threads is deliberately NOT built on this: it's a separate host (graph.threads.net)
// with its own app credentials and its own token grammar (`th_exchange_token`), so it
// keeps its own small helper set in `threads.ts`.
//
// No SDKs — pure `fetch` via the shared `_http` helpers. The worker resolves + decrypts
// the token; these helpers never read a per-tenant secret, only sparx's Meta app creds.

import type { SocialConnectContext } from '../types.js';
import {
  describeResponse,
  expiresInSeconds,
  fetchT,
  formBody,
  HttpError,
  readPlatformCreds,
} from './_http.js';

/** The Graph API version every Meta call pins to. Bump deliberately when adopting a
 *  newer schema (Meta keeps ~2 years of versions live). */
export const GRAPH_VERSION = 'v21.0';
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const OAUTH_DIALOG = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

// Facebook Pages + Instagram publishing share ONE app registration + verification.
export const META_ID_VAR = 'META_APP_ID';
export const META_SECRET_VAR = 'META_APP_SECRET';

// A long-lived Meta user token lasts ~60 days; Page tokens derived from it don't expire
// while the user token is valid. We re-exchange (not refresh) before the 60 days lapse.
export const LONG_LIVED_FALLBACK_SECONDS = 5_184_000;

export interface MetaCreds {
  clientId: string;
  clientSecret: string;
}

/** sparx's Meta app credentials, or null when unset (→ the adapter is `coming_soon`). */
export function metaCreds(): MetaCreds | null {
  return readPlatformCreds(META_ID_VAR, META_SECRET_VAR);
}

interface GraphError {
  error?: { message?: string; type?: string; code?: number };
}

/** Surface a Graph failure with its human message (Meta returns a rich error body),
 *  falling back to the raw status+body slice from {@link describeResponse}. */
async function describeGraph(res: Response, label: string): Promise<string> {
  const raw = await describeResponse(res);
  try {
    const parsed = JSON.parse(raw.replace(/^\d+\s*/, '')) as GraphError;
    if (parsed.error?.message) return `${label}: ${res.status} ${parsed.error.message}`;
  } catch {
    // not JSON — the raw slice already carries what we know
  }
  return `${label}: ${raw}`;
}

/** GET a Graph edge with the access token as a query param; throws with a described
 *  error on non-2xx. */
export async function graphGet<T>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
  label = 'Meta request'
): Promise<T> {
  const qs = new URLSearchParams({ ...params, access_token: accessToken });
  const res = await fetchT(`${GRAPH_BASE}/${path}?${qs.toString()}`);
  if (!res.ok) throw new HttpError(await describeGraph(res, label), res.status);
  return (await res.json()) as T;
}

/** POST to a Graph edge as form-urlencoded (the token rides in the body); throws with a
 *  described error on non-2xx. */
export async function graphPost<T>(
  path: string,
  accessToken: string,
  fields: Record<string, string>,
  label = 'Meta request'
): Promise<T> {
  const res = await fetchT(`${GRAPH_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody({ ...fields, access_token: accessToken }),
  });
  if (!res.ok) throw new HttpError(await describeGraph(res, label), res.status);
  return (await res.json()) as T;
}

/** POST to a Graph edge as multipart/form-data, uploading a file's BYTES in `file.field`
 *  (e.g. `source` for `/{page}/photos`) instead of handing Graph a public `url` to fetch.
 *  This is the escape hatch from the Cloudflare 206 (see {@link fetchImageBinary}): our
 *  media URL is fine to a plain GET but Graph's range-fetch gets a 206 it rejects, so we
 *  send the bytes directly. The multipart boundary is set by fetch from the FormData — do
 *  NOT set Content-Type by hand. 60s timeout to cover the upload of the largest variant. */
export async function graphPostMultipart<T>(
  path: string,
  accessToken: string,
  fields: Record<string, string>,
  file: { field: string; bytes: ArrayBuffer; filename: string; contentType: string },
  label = 'Meta request'
): Promise<T> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append('access_token', accessToken);
  form.append(file.field, new Blob([file.bytes], { type: file.contentType }), file.filename);
  const res = await fetchT(`${GRAPH_BASE}/${path}`, { method: 'POST', body: form }, 60_000);
  if (!res.ok) throw new HttpError(await describeGraph(res, label), res.status);
  return (await res.json()) as T;
}

/** Build the Facebook Login authorize URL for a given scope set. */
export function buildMetaConnectUrl(
  creds: MetaCreds,
  ctx: SocialConnectContext,
  scope: string
): string {
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: ctx.redirectUri,
    response_type: 'code',
    scope,
    state: ctx.state,
  });
  return `${OAUTH_DIALOG}?${params.toString()}`;
}

interface MetaTokenResponse {
  access_token: string;
  expires_in?: number;
}

/** Exchange the OAuth callback code for a (short-lived) user access token. */
export async function exchangeMetaCode(
  creds: MetaCreds,
  code: string,
  redirectUri: string
): Promise<string> {
  const data = await graphGet<MetaTokenResponse>(
    'oauth/access_token',
    '', // no bearer yet — creds go in the query below
    {
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: redirectUri,
      code,
    },
    'Meta token exchange'
  );
  return data.access_token;
}

/** Exchange a short-lived user token for a long-lived one (~60 days). */
export async function exchangeLongLivedToken(
  creds: MetaCreds,
  shortToken: string
): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const data = await graphGet<MetaTokenResponse>(
    'oauth/access_token',
    '',
    {
      grant_type: 'fb_exchange_token',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      fb_exchange_token: shortToken,
    },
    'Meta long-lived token exchange'
  );
  return {
    accessToken: data.access_token,
    expiresInSeconds: expiresInSeconds(data.expires_in, LONG_LIVED_FALLBACK_SECONDS),
  };
}

export interface MetaMe {
  id: string;
  name?: string;
  picture?: { data?: { url?: string } };
}

/** Best-effort identity for naming the connection; never throws (a hiccup here must not
 *  fail an otherwise-good connect). */
export async function fetchMe(accessToken: string): Promise<MetaMe | null> {
  try {
    return await graphGet<MetaMe>(
      'me',
      accessToken,
      { fields: 'id,name,picture' },
      'Meta identity'
    );
  } catch {
    return null;
  }
}

export interface MetaPage {
  id: string;
  name?: string;
  access_token?: string;
  picture?: { data?: { url?: string } };
  instagram_business_account?: {
    id: string;
    username?: string;
    profile_picture_url?: string;
  };
}

interface MetaPagesResponse {
  data?: MetaPage[];
  paging?: { next?: string };
}

/** Every Facebook Page the user manages, with its own Page access token and any linked
 *  Instagram business account. Both adapters read from this — Facebook uses the Pages
 *  directly, Instagram keeps only the Pages that have a linked IG account. Pages the
 *  Page access token because publishing (to a Page OR its IG account) authenticates as
 *  the PAGE, not the user. */
export async function listMetaPages(
  accessToken: string,
  opts: { includeInstagram?: boolean } = {}
): Promise<MetaPage[]> {
  const fields = opts.includeInstagram
    ? 'id,name,access_token,picture,instagram_business_account{id,username,profile_picture_url}'
    : 'id,name,access_token,picture';
  const out: MetaPage[] = [];
  let after: string | undefined;
  do {
    const params: Record<string, string> = { fields, limit: '100' };
    if (after) params.after = after;
    const data = await graphGet<MetaPagesResponse>(
      'me/accounts',
      accessToken,
      params,
      'Meta Page lookup'
    );
    out.push(...(data.data ?? []));
    // Cursor pagination: parse the `after` cursor out of the next URL when present.
    after = data.paging?.next
      ? (new URL(data.paging.next).searchParams.get('after') ?? undefined)
      : undefined;
  } while (after);
  return out;
}

/** Classify a Meta media-container status code (Instagram + Threads share the same
 *  vocabulary): `FINISHED` → ready, `ERROR`/`EXPIRED` → failed, anything else → still
 *  processing. Pure, so the state mapping is unit-tested without any network. */
export function classifyMediaContainerStatus(statusCode: string | undefined): {
  ready: boolean;
  failed: boolean;
} {
  if (statusCode === 'FINISHED') return { ready: true, failed: false };
  if (statusCode === 'ERROR' || statusCode === 'EXPIRED') return { ready: false, failed: true };
  return { ready: false, failed: false };
}

/** Poll a two-step publish container (Instagram/Threads share this shape) until it
 *  reports ready. Pure control-flow helper: the caller supplies the status probe. A
 *  container that never finishes within the budget throws, surfacing the last state. */
export async function waitForContainer(
  probe: () => Promise<{ ready: boolean; failed: boolean; detail?: string }>,
  opts: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {}
): Promise<void> {
  const attempts = opts.attempts ?? 12;
  const delayMs = opts.delayMs ?? 2_500;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last = '';
  for (let i = 0; i < attempts; i += 1) {
    const { ready, failed, detail } = await probe();
    if (ready) return;
    last = detail ?? '';
    if (failed) throw new Error(`media processing failed${last ? `: ${last}` : ''}`);
    await sleep(delayMs);
  }
  throw new Error(`media not ready after ${attempts} checks${last ? ` (last: ${last})` : ''}`);
}
