// Pinterest adapter (docs/133 §6, build plan docs/134 Phase 3) — creates Pins on a
// tenant's Pinterest BOARDS. A Pin is image-first: it needs an image, a title, a
// description, and (ideally) a destination link — a natural fit for a product or
// article announcement.
//
// Auth: Pinterest OAuth 2.0. The token endpoint authenticates the app with HTTP Basic
// (client id/secret); the grant returns a refresh token, so refresh() extends it.
// Scopes: `boards:read` (list the boards to pin to), `boards:write` (Pinterest v5
// requires it to CREATE a pin on a board — pins:write alone yields a 401 "Missing:
// ['boards:write']"), `pins:write` (create the Pin), `user_accounts:read` (name the
// connection).
//
// Targets: a target is a BOARD. listTargets returns one per board; externalTargetId is
// the board id, which the publish call pins to.
//
// Publish (`POST /v5/pins`): title + description + link + an `image_url` media source.
// A post with no image can't become a Pin (constraints.requiresMedia), so the renderer
// blocks it before it reaches here; a defensive guard throws a clear message anyway.
//
// No SDKs — pure `fetch` via the shared `_http` helpers. Pure I/O: the worker resolves +
// decrypts the token and passes SocialAuth.

import type {
  PlatformConstraints,
  RenderedPost,
  SocialAdapter,
  SocialAuth,
  SocialConnectContext,
  SocialPostMetrics,
  SocialPublishResult,
  SocialTargetRef,
  SocialTokens,
} from '../types.js';
import { PLATFORM_CONSTRAINTS } from '../constraints.js';
import { deriveTitle, firstImageUrl } from './_media.js';
import {
  describeResponse,
  expiresInSeconds,
  fetchT,
  formBody,
  readPlatformCreds,
  requireCreds,
  splitScopes,
} from './_http.js';

const AUTH_URL = 'https://www.pinterest.com/oauth/';

// Production vs Sandbox endpoints. Trial-access apps CANNOT create Pins in production
// (`api.pinterest.com` returns 403 code 29 — "use API Sandbox instead"). The sandbox is a
// per-creator isolated environment where a Trial app CAN create Pins + boards — which is
// how we exercise the write path to record the demo video the Standard-access upgrade
// requires. The user-facing authorize screen (AUTH_URL) is identical for both; only the
// token exchange + API calls move. Flip PINTEREST_SANDBOX back off once Standard is
// granted. Pinterest-only — no other platform is affected.
const PROD_API_BASE = 'https://api.pinterest.com/v5';
const SANDBOX_API_BASE = 'https://api-sandbox.pinterest.com/v5';
const PROD_TOKEN_URL = `${PROD_API_BASE}/oauth/token`;
const SANDBOX_TOKEN_URL = `${SANDBOX_API_BASE}/oauth/token`;

/** Endpoint pair for the given environment. Pure, so the switch is unit-tested. */
export function pinterestBases(sandbox: boolean): { api: string; token: string } {
  return sandbox
    ? { api: SANDBOX_API_BASE, token: SANDBOX_TOKEN_URL }
    : { api: PROD_API_BASE, token: PROD_TOKEN_URL };
}

/** True when PINTEREST_SANDBOX opts this deployment into Pinterest's sandbox (default
 *  false = production). Tolerates whitespace/case from a secret. */
export function pinterestSandbox(): boolean {
  return process.env.PINTEREST_SANDBOX?.trim().toLowerCase() === 'true';
}

const apiBase = (): string => pinterestBases(pinterestSandbox()).api;
const tokenEndpoint = (): string => pinterestBases(pinterestSandbox()).token;

const SCOPE = 'boards:read,boards:write,pins:read,pins:write,user_accounts:read';
const TITLE_MAX = 100;
const TOKEN_FALLBACK_SECONDS = 2_592_000; // 30 days (Pinterest access tokens)

const ID_VAR = 'PINTEREST_APP_ID';
const SECRET_VAR = 'PINTEREST_APP_SECRET';

export interface PinterestPinPlan {
  imageUrl: string;
  title: string;
  description: string;
  link: string | null;
}

/** Decide the Pin fields for one rendered post — pure, so the title derivation +
 *  image/link mapping is unit-tested without any network. Returns null when there's no
 *  image (a Pin cannot exist without one). */
export function planPinterestPin(post: RenderedPost): PinterestPinPlan | null {
  const imageUrl = firstImageUrl(post.mediaUrls);
  if (!imageUrl) return null;
  return {
    imageUrl,
    title: deriveTitle(post.text, TITLE_MAX),
    description: post.text,
    link: post.link ?? null,
  };
}

/** The public permalink for a created Pin id. */
export function pinterestPermalink(id: string): string {
  return `https://www.pinterest.com/pin/${id}/`;
}

/** UTC calendar date as YYYY-MM-DD — the format Pinterest's analytics window expects. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Map Pinterest's pin-analytics summary onto the platform-neutral metric shape. Pure,
 *  so the mapping is unit-tested without any network. Pinterest reports engagement in
 *  its own vocabulary; we translate the two with a clean home: IMPRESSION → impressions
 *  (Views), and SAVE (a repin — how a Pin spreads) → shares. Click metrics (PIN_CLICK /
 *  OUTBOUND_CLICK) have no field in the shared shape yet, so they're left out rather than
 *  mislabelled. */
export function mapPinterestMetrics(
  summary: Record<string, number | undefined> | undefined
): SocialPostMetrics {
  const metrics: SocialPostMetrics = {};
  const impression = summary?.IMPRESSION;
  const save = summary?.SAVE;
  if (typeof impression === 'number') metrics.impressions = impression;
  if (typeof save === 'number') metrics.shares = save;
  return metrics;
}

interface PinterestTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}
interface PinterestUser {
  username?: string;
  profile_image?: string;
}
interface PinterestBoard {
  id: string;
  name?: string;
}
interface PinterestBoardsResponse {
  items?: PinterestBoard[];
  bookmark?: string;
}
interface PinterestPinResponse {
  id: string;
}
/** Pin analytics as Pinterest returns it, keyed by the split field (default "all"). */
interface PinterestPinAnalytics {
  all?: { summary_metrics?: Record<string, number | undefined> };
}

export class PinterestAdapter implements SocialAdapter {
  readonly id = 'pinterest' as const;
  readonly name = 'Pinterest';
  readonly constraints: PlatformConstraints = PLATFORM_CONSTRAINTS.pinterest;

  private creds() {
    return readPlatformCreds(ID_VAR, SECRET_VAR);
  }

  /** Pinterest's token endpoint authenticates the app with HTTP Basic. */
  private basicAuth(): string {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  }

  isConfigured(): boolean {
    return this.creds() !== null;
  }

  requiredScopes(): string[] {
    return splitScopes(SCOPE);
  }

  connectUrl(ctx: SocialConnectContext): string {
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

  async exchangeCode(code: string, ctx: SocialConnectContext): Promise<SocialTokens> {
    const res = await fetchT(tokenEndpoint(), {
      method: 'POST',
      headers: {
        Authorization: this.basicAuth(),
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
    const user = await this.userAccount(data.access_token);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: expiresInSeconds(data.expires_in, TOKEN_FALLBACK_SECONDS),
      scope: data.scope,
      externalId: user?.username,
      displayName: user?.username ? `@${user.username}` : 'Pinterest',
      avatarUrl: user?.profile_image,
    };
  }

  async refresh(refreshToken: string): Promise<SocialTokens> {
    const res = await fetchT(tokenEndpoint(), {
      method: 'POST',
      headers: {
        Authorization: this.basicAuth(),
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
      // Pinterest keeps the same refresh token unless it rotates one back.
      refreshToken: data.refresh_token ?? refreshToken,
      expiresInSeconds: expiresInSeconds(data.expires_in, TOKEN_FALLBACK_SECONDS),
      scope: data.scope,
    };
  }

  /** One target per board the account owns. externalTargetId is the board id. */
  async listTargets(auth: SocialAuth): Promise<SocialTargetRef[]> {
    const targets: SocialTargetRef[] = [];
    let bookmark: string | undefined;
    do {
      const params = new URLSearchParams({ page_size: '100' });
      if (bookmark) params.set('bookmark', bookmark);
      const res = await fetchT(`${apiBase()}/boards?${params.toString()}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      if (!res.ok) {
        throw new Error(`Pinterest board lookup failed: ${await describeResponse(res)}`);
      }
      const data = (await res.json()) as PinterestBoardsResponse;
      for (const board of data.items ?? []) {
        targets.push({ externalTargetId: board.id, name: board.name ?? board.id });
      }
      bookmark = data.bookmark ?? undefined;
    } while (bookmark);
    return targets;
  }

  async publish(
    auth: SocialAuth,
    target: SocialTargetRef,
    post: RenderedPost,
    idempotencyKey: string
  ): Promise<SocialPublishResult> {
    void idempotencyKey; // Pinterest has no client idempotency key; the caller guards replays
    const plan = planPinterestPin(post);
    if (!plan) throw new Error('Pinterest needs an image to create a Pin.');

    const body: Record<string, unknown> = {
      board_id: target.externalTargetId,
      title: plan.title,
      description: plan.description,
      media_source: { source_type: 'image_url', url: plan.imageUrl },
    };
    if (plan.link) body.link = plan.link;

    const res = await fetchT(`${apiBase()}/pins`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Pinterest pin failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as PinterestPinResponse;
    return { externalId: data.id, permalink: pinterestPermalink(data.id) };
  }

  /** Read a Pin's engagement for the "how did it do?" panel. Pinterest requires an
   *  explicit date window (≤90 days, ending today), so we ask for a trailing 90-day span
   *  — enough to cover a recently published Pin's full run so far. Uses the `pins:read`
   *  scope we already request. Best-effort by contract: the collect worker skips a target
   *  whose analytics call throws, so a Pin simply shows dashes until data lands. */
  async getMetrics(
    auth: SocialAuth,
    target: SocialTargetRef,
    externalId: string
  ): Promise<SocialPostMetrics> {
    void target; // metrics read against the user token; no per-board token needed
    const end = new Date();
    const start = new Date(end.getTime() - 89 * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({
      start_date: isoDate(start),
      end_date: isoDate(end),
      metric_types: 'IMPRESSION,SAVE',
    });
    const res = await fetchT(`${apiBase()}/pins/${externalId}/analytics?${params.toString()}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Pinterest pin analytics failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as PinterestPinAnalytics;
    return mapPinterestMetrics(data.all?.summary_metrics);
  }

  // ── internals ──

  private async userAccount(accessToken: string): Promise<PinterestUser | null> {
    try {
      const res = await fetchT(`${apiBase()}/user_account`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      return (await res.json()) as PinterestUser;
    } catch {
      return null;
    }
  }
}
