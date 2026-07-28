// TikTok adapter (docs/133 §6, build plan docs/134 Phase 3) — publishes to a tenant's
// own TikTok account via the Content Posting API (Direct Post). TikTok is media-first: a
// post is either a video or a photo carousel; it can't be text-only
// (constraints.requiresMedia).
//
// Auth: TikTok OAuth 2.0 (`client_key`/`client_secret`). The grant returns an access +
// refresh token and the account's `open_id`; refresh() rotates both. Scopes:
// `user.info.basic` (name the connection) + `video.publish` (Direct Post).
//
// Targets: exactly one — the authorizing account (its `open_id`).
//
// Publish is query → INIT → poll, all async: first QUERY the creator's currently-allowed
// privacy options (TikTok forbids hardcoding the privacy level and an UNAUDITED / sandbox
// app is restricted to SELF_ONLY — hardcoding PUBLIC_TO_EVERYONE makes every sandbox post
// FAIL), then INIT the post (`PULL_FROM_URL` so TikTok fetches the media from our CDN —
// the source domain must be URL-ownership-verified in the app), then POLL the publish
// status until `PUBLISH_COMPLETE`. Captions carry no clickable link, so a canonical link
// is folded into the caption.
//
// No SDKs — pure `fetch` via the shared `_http` helpers + the shared `waitForContainer`
// poller. Pure I/O: the worker resolves + decrypts the token and passes SocialAuth.

import type {
  PlatformConstraints,
  RenderedPost,
  SocialAccessProbe,
  SocialAdapter,
  SocialAuth,
  SocialConnectContext,
  SocialPublishResult,
  SocialTargetRef,
  SocialTokens,
} from '../types.js';
import { PLATFORM_CONSTRAINTS } from '../constraints.js';
import { waitForContainer } from './_meta.js';
import { appendLink, deriveTitle, imageUrls, isImageUrl } from './_media.js';
import {
  describeResponse,
  expiresInSeconds,
  fetchT,
  formBody,
  readPlatformCreds,
  requireCreds,
  splitScopes,
} from './_http.js';

const AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const API_BASE = 'https://open.tiktokapis.com/v2';
const SCOPE = 'user.info.basic,video.publish';
const TOKEN_FALLBACK_SECONDS = 86_400; // TikTok access tokens last ~24h; refresh renews.
const PHOTO_TITLE_MAX = 90;

const ID_VAR = 'TIKTOK_CLIENT_KEY';
const SECRET_VAR = 'TIKTOK_CLIENT_SECRET';

export type TikTokPostPlan =
  | { kind: 'video'; videoUrl: string; caption: string }
  | { kind: 'photo'; imageUrls: string[]; caption: string }
  | { kind: 'none' };

/** Decide how one rendered post maps onto a TikTok post — pure, so the video/photo
 *  branching is unit-tested without any network. Video wins when present (TikTok is
 *  video-first); a link is folded into the caption; a media-less post is `none` (the
 *  renderer normally blocks it first). */
export function planTikTokPost(post: RenderedPost): TikTokPostPlan {
  const caption = post.link ? appendLink(post.text, post.link) : post.text;
  const video = post.mediaUrls.find((u) => !isImageUrl(u));
  if (video) return { kind: 'video', videoUrl: video, caption };
  const imgs = imageUrls(post.mediaUrls);
  if (imgs.length > 0) return { kind: 'photo', imageUrls: imgs, caption };
  return { kind: 'none' };
}

/** Map a TikTok publish status into ready / failed / still-processing. Pure. */
export function classifyTikTokStatus(status: string | undefined): {
  ready: boolean;
  failed: boolean;
} {
  if (status === 'PUBLISH_COMPLETE') return { ready: true, failed: false };
  if (status === 'FAILED') return { ready: false, failed: true };
  return { ready: false, failed: false };
}

/** Whether sparx's TikTok app has passed TikTok's audit and may therefore publish to a
 *  public audience. An UNAUDITED app is hard-limited by TikTok to `SELF_ONLY` (private) —
 *  attempting anything wider returns `403 unaudited_client_can_only_post_to_private_accounts`,
 *  and this is a limit on the APP, independent of what the creator's account allows. Defaults
 *  to false (private, demo-safe): ops sets `TIKTOK_AUDITED=true` once TikTok approves the app
 *  and every tenant's posts go public with no code change. */
export function tiktokAllowsPublic(): boolean {
  return process.env.TIKTOK_AUDITED?.trim().toLowerCase() === 'true';
}

/** Choose the privacy level to publish at from the creator's currently-available options
 *  (TikTok's `creator_info` query returns them). Used ONLY once the app is audited — TikTok
 *  requires the level be one the creator allows and forbids hardcoding it, so we publish to
 *  the widest audience the account permits (public), falling back to the always-allowed
 *  `SELF_ONLY`. While UNAUDITED the caller bypasses this and forces `SELF_ONLY` — see
 *  {@link tiktokAllowsPublic}. Pure — unit-tested without any network. */
export function pickPrivacyLevel(options: readonly string[]): string {
  if (options.includes('PUBLIC_TO_EVERYONE')) return 'PUBLIC_TO_EVERYONE';
  if (options.includes('SELF_ONLY')) return 'SELF_ONLY';
  return options[0] ?? 'SELF_ONLY';
}

/** Read TikTok's audit verdict out of the privacy levels it offers a connected creator.
 *  TikTok publishes no "has my app been approved yet" endpoint, so this is the closest
 *  thing to one: an UNAUDITED app is hard-limited to `SELF_ONLY` no matter what the
 *  creator's own account permits, so the appearance of ANY audience wider than private
 *  proves the audit has passed.
 *
 *  The converse does not hold — a creator whose own TikTok account is private is limited
 *  to `SELF_ONLY` by their own settings — so a private-only answer is reported as "cannot
 *  tell yet", never as "rejected". Saying "still under review" about an approved app is
 *  the one wrong answer that would send someone chasing TikTok support for nothing. Pure. */
export function classifyTikTokAudit(options: readonly string[]): SocialAccessProbe {
  const isPrivateOnly = options.length > 0 && options.every((o) => o === 'SELF_ONLY');
  if (options.some((o) => o !== 'SELF_ONLY')) {
    return {
      grantedScopes: null,
      appReview: 'passed',
      detail:
        'TikTok is letting this account post publicly, which only an approved app may do. The review has landed.',
    };
  }
  if (isPrivateOnly) {
    return {
      grantedScopes: null,
      appReview: 'pending',
      detail:
        'TikTok will only accept private posts from this account right now. That usually means the app review has not finished — though it also happens when the TikTok account itself is set to private, so check that before chasing TikTok.',
    };
  }
  return {
    grantedScopes: null,
    appReview: 'unknown',
    detail:
      'TikTok did not say what audiences this account can post to, so there is nothing to read.',
  };
}

interface TikTokTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  open_id?: string;
  scope?: string;
}
interface TikTokUserInfo {
  data?: { user?: { open_id?: string; display_name?: string; avatar_url?: string } };
}
interface TikTokCreatorInfoResponse {
  data?: { privacy_level_options?: string[] };
  error?: { code?: string; message?: string };
}
interface TikTokInitResponse {
  data?: { publish_id?: string };
  error?: { code?: string; message?: string };
}
interface TikTokStatusResponse {
  data?: { status?: string; publicaly_available_post_id?: string[]; fail_reason?: string };
  error?: { code?: string; message?: string };
}

export class TikTokAdapter implements SocialAdapter {
  readonly id = 'tiktok' as const;
  readonly name = 'TikTok';
  readonly constraints: PlatformConstraints = PLATFORM_CONSTRAINTS.tiktok;

  private creds() {
    return readPlatformCreds(ID_VAR, SECRET_VAR);
  }

  isConfigured(): boolean {
    return this.creds() !== null;
  }

  requiredScopes(): string[] {
    return splitScopes(SCOPE);
  }

  /** TikTok's audit state, read off the audiences it will accept for this creator. This
   *  is the one platform where the answer is available WITHOUT an outside test account —
   *  the limit is on sparx's app, not on who granted it — so connecting your own TikTok
   *  is a valid test of whether the audit cleared. */
  async probeAccess(auth: SocialAuth): Promise<SocialAccessProbe> {
    return classifyTikTokAudit(await this.queryCreatorInfo(auth.accessToken));
  }

  connectUrl(ctx: SocialConnectContext): string {
    const { clientId } = requireCreds(this.creds(), this.name);
    const params = new URLSearchParams({
      client_key: clientId,
      redirect_uri: ctx.redirectUri,
      response_type: 'code',
      scope: SCOPE,
      state: ctx.state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, ctx: SocialConnectContext): Promise<SocialTokens> {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    const data = await this.token({
      client_key: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: ctx.redirectUri,
    });
    const user = await this.userInfo(data.access_token);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: expiresInSeconds(data.expires_in, TOKEN_FALLBACK_SECONDS),
      scope: data.scope,
      externalId: user?.open_id ?? data.open_id,
      displayName: user?.display_name ?? 'TikTok',
      avatarUrl: user?.avatar_url,
    };
  }

  async refresh(refreshToken: string): Promise<SocialTokens> {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    const data = await this.token({
      client_key: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresInSeconds: expiresInSeconds(data.expires_in, TOKEN_FALLBACK_SECONDS),
      scope: data.scope,
    };
  }

  /** TikTok publishes to the authorizing account — a single target (its open_id). */
  async listTargets(auth: SocialAuth): Promise<SocialTargetRef[]> {
    const user = await this.userInfo(auth.accessToken);
    const openId = user?.open_id ?? auth.externalId;
    if (!openId) return [];
    return [{ externalTargetId: openId, name: user?.display_name ?? 'TikTok' }];
  }

  async publish(
    auth: SocialAuth,
    target: SocialTargetRef,
    post: RenderedPost,
    idempotencyKey: string
  ): Promise<SocialPublishResult> {
    void target; // TikTok posts to the token's own account; target is the account itself
    void idempotencyKey; // init/status is naturally idempotent per caller
    const plan = planTikTokPost(post);
    if (plan.kind === 'none') {
      throw new Error('TikTok requires a video or at least one image.');
    }

    // Privacy level: an UNAUDITED app is hard-limited by TikTok to SELF_ONLY (private) —
    // a wider audience returns 403 unaudited_client_can_only_post_to_private_accounts,
    // regardless of what the creator's account allows. So while unaudited, force SELF_ONLY;
    // once audited (TIKTOK_AUDITED=true) query the creator's allowed options and publish to
    // the widest they permit (TikTok forbids a hardcoded level for audited apps).
    const privacyLevel = tiktokAllowsPublic()
      ? pickPrivacyLevel(await this.queryCreatorInfo(auth.accessToken))
      : 'SELF_ONLY';
    const publishId = await this.initPost(auth.accessToken, plan, privacyLevel);
    const postId = await this.awaitPublish(auth.accessToken, publishId);
    // TikTok's status API returns the public post id once complete but no share URL;
    // the publish id is the stable external reference when no post id is surfaced yet.
    return { externalId: postId ?? publishId };
  }

  // ── internals ──

  /** Query the creator's currently-allowed publish options. Returns the privacy levels
   *  TikTok will accept for this account right now; an empty list on any hiccup so the
   *  caller falls back to the always-valid SELF_ONLY rather than hard-failing blind. */
  private async queryCreatorInfo(accessToken: string): Promise<string[]> {
    try {
      const res = await this.postJson<TikTokCreatorInfoResponse>(
        'post/publish/creator_info/query/',
        accessToken,
        {}
      );
      return res.data?.privacy_level_options ?? [];
    } catch {
      return [];
    }
  }

  private async initPost(
    accessToken: string,
    plan: Exclude<TikTokPostPlan, { kind: 'none' }>,
    privacyLevel: string
  ): Promise<string> {
    const body: Record<string, unknown> =
      plan.kind === 'video'
        ? {
            post_info: { title: plan.caption, privacy_level: privacyLevel },
            source_info: { source: 'PULL_FROM_URL', video_url: plan.videoUrl },
          }
        : {
            media_type: 'PHOTO',
            post_mode: 'DIRECT_POST',
            post_info: {
              title: deriveTitle(plan.caption, PHOTO_TITLE_MAX),
              description: plan.caption,
              privacy_level: privacyLevel,
            },
            source_info: {
              source: 'PULL_FROM_URL',
              photo_images: plan.imageUrls,
              photo_cover_index: 0,
            },
          };
    const path = plan.kind === 'video' ? 'post/publish/video/init/' : 'post/publish/content/init/';
    const res = await this.postJson<TikTokInitResponse>(path, accessToken, body);
    const publishId = res.data?.publish_id;
    if (!publishId) {
      throw new Error(
        `TikTok init returned no publish id${res.error?.message ? `: ${res.error.message}` : ''}.`
      );
    }
    return publishId;
  }

  /** Poll the publish status until complete; return the public post id when TikTok
   *  surfaces one. */
  private async awaitPublish(accessToken: string, publishId: string): Promise<string | undefined> {
    let postId: string | undefined;
    await waitForContainer(async () => {
      const res = await this.postJson<TikTokStatusResponse>(
        'post/publish/status/fetch/',
        accessToken,
        {
          publish_id: publishId,
        }
      );
      const { ready, failed } = classifyTikTokStatus(res.data?.status);
      if (ready) postId = res.data?.publicaly_available_post_id?.[0];
      return { ready, failed, detail: res.data?.fail_reason ?? res.data?.status };
    });
    return postId;
  }

  private async token(fields: Record<string, string>): Promise<TikTokTokenResponse> {
    const res = await fetchT(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody(fields),
    });
    if (!res.ok) {
      throw new Error(`TikTok token request failed: ${await describeResponse(res)}`);
    }
    return (await res.json()) as TikTokTokenResponse;
  }

  private async userInfo(
    accessToken: string
  ): Promise<NonNullable<TikTokUserInfo['data']>['user'] | null> {
    try {
      const params = new URLSearchParams({ fields: 'open_id,display_name,avatar_url' });
      const res = await fetchT(`${API_BASE}/user/info/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as TikTokUserInfo;
      return data.data?.user ?? null;
    } catch {
      return null;
    }
  }

  private async postJson<T>(
    path: string,
    accessToken: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const res = await fetchT(`${API_BASE}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`TikTok request failed (${path}): ${await describeResponse(res)}`);
    }
    return (await res.json()) as T;
  }
}
