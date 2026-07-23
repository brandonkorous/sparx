// YouTube adapter (docs/133 §6, build plan docs/134 Phase 3) — publishes SHORTS (short
// vertical videos) to a tenant's YouTube channel. YouTube has NO public API to create
// Community (text/image) posts, so a "YouTube post" is a Shorts upload: a post whose
// media is a vertical video becomes a Short (a `#Shorts` title/description hints the
// classification). A post with no video can't publish here (constraints.requiresMedia).
//
// Auth: Google OAuth 2.0 — reuses sparx's existing Google web client
// (GOOGLE_OAUTH_CLIENT_ID/_SECRET, also used by Google Business Profile + Shopping), so
// there's no new app to register. Scopes: `youtube.upload` (publish) + `youtube.readonly`
// (list channels). `access_type=offline` yields a refresh token; refresh() rotates it.
//
// Targets: a target is a CHANNEL. listTargets returns the authorizing user's channels.
//
// Publish (resumable upload): INITIATE an upload session with the video's snippet +
// status (returns an upload URL), then PUT the video bytes. YouTube returns the video id.
//
// No SDKs — pure `fetch` via the shared `_http` helpers. Pure I/O: the worker resolves +
// decrypts the token and passes SocialAuth.

import type {
  PlatformConstraints,
  RenderedPost,
  SocialAdapter,
  SocialAuth,
  SocialConnectContext,
  SocialPublishResult,
  SocialTargetRef,
  SocialTokens,
} from '../types.js';
import { PLATFORM_CONSTRAINTS } from '../constraints.js';
import { appendLink, deriveTitle, isImageUrl } from './_media.js';
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
const CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';
const UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';
const SCOPE =
  'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';
const TITLE_MAX = 90; // leaves room for the " #Shorts" suffix within YouTube's 100-char cap

// Reuses sparx's existing Google OAuth web client (also GBP + Shopping + Calendar).
const ID_VAR = 'GOOGLE_OAUTH_CLIENT_ID';
const SECRET_VAR = 'GOOGLE_OAUTH_CLIENT_SECRET';

export interface YouTubeShortPlan {
  videoUrl: string;
  title: string;
  description: string;
}

/** Decide the Short's fields for one rendered post — pure, so the video detection +
 *  title/description derivation is unit-tested without any network. Returns null when
 *  there's no video (only images/text), since a Short needs a video. */
export function planYouTubeShort(post: RenderedPost): YouTubeShortPlan | null {
  const videoUrl = post.mediaUrls.find((u) => !isImageUrl(u));
  if (!videoUrl) return null;
  const base = deriveTitle(post.text, TITLE_MAX);
  const title = /#shorts/i.test(base) ? base : `${base} #Shorts`;
  const description = post.link ? appendLink(post.text, post.link) : post.text;
  return { videoUrl, title, description };
}

/** The public permalink for a published Short id. */
export function youtubeShortsPermalink(id: string): string {
  return `https://www.youtube.com/shorts/${id}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}
interface YouTubeChannel {
  id: string;
  snippet?: { title?: string; thumbnails?: { default?: { url?: string } } };
}
interface YouTubeChannelsResponse {
  items?: YouTubeChannel[];
}
interface YouTubeVideoResponse {
  id?: string;
}

export class YouTubeAdapter implements SocialAdapter {
  readonly id = 'youtube' as const;
  readonly name = 'YouTube';
  readonly constraints: PlatformConstraints = PLATFORM_CONSTRAINTS.youtube;

  private creds() {
    return readPlatformCreds(ID_VAR, SECRET_VAR);
  }

  isConfigured(): boolean {
    return this.creds() !== null;
  }

  connectUrl(ctx: SocialConnectContext): string {
    const { clientId } = requireCreds(this.creds(), this.name);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: ctx.redirectUri,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent', // force a refresh_token on every (re)connect
      include_granted_scopes: 'true',
      state: ctx.state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, ctx: SocialConnectContext): Promise<SocialTokens> {
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
    const channel = await this.firstChannel(data.access_token);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: expiresInSeconds(data.expires_in, 3600),
      scope: data.scope ?? SCOPE,
      externalId: channel?.id,
      displayName: channel?.snippet?.title ?? 'YouTube',
      avatarUrl: channel?.snippet?.thumbnails?.default?.url,
    };
  }

  async refresh(refreshToken: string): Promise<SocialTokens> {
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
      scope: data.scope ?? SCOPE,
    };
  }

  /** One target per channel the user owns. externalTargetId is the channel id. */
  async listTargets(auth: SocialAuth): Promise<SocialTargetRef[]> {
    const channels = await this.listChannels(auth.accessToken);
    return channels.map((c) => ({
      externalTargetId: c.id,
      name: c.snippet?.title ?? c.id,
      avatarUrl: c.snippet?.thumbnails?.default?.url,
    }));
  }

  async publish(
    auth: SocialAuth,
    target: SocialTargetRef,
    post: RenderedPost,
    idempotencyKey: string
  ): Promise<SocialPublishResult> {
    void target; // the upload lands on the token's own channel
    void idempotencyKey; // resumable upload has no client key; the caller guards replays
    const plan = planYouTubeShort(post);
    if (!plan) throw new Error('YouTube needs a video to publish a Short.');

    const uploadUrl = await this.initUpload(auth.accessToken, plan);
    const videoId = await this.uploadBytes(auth.accessToken, uploadUrl, plan.videoUrl);
    return { externalId: videoId, permalink: youtubeShortsPermalink(videoId) };
  }

  // ── internals ──

  /** Start a resumable upload session and return the one-time upload URL. */
  private async initUpload(accessToken: string, plan: YouTubeShortPlan): Promise<string> {
    const res = await fetchT(`${UPLOAD_URL}?uploadType=resumable&part=snippet,status`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/*',
      },
      body: JSON.stringify({
        snippet: { title: plan.title, description: plan.description },
        status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
      }),
    });
    if (!res.ok) {
      throw new Error(`YouTube upload init failed: ${await describeResponse(res)}`);
    }
    const location = res.headers.get('location');
    if (!location) throw new Error('YouTube upload init returned no upload URL.');
    return location;
  }

  /** Fetch the source video and PUT its bytes to the resumable upload URL. */
  private async uploadBytes(
    accessToken: string,
    uploadUrl: string,
    videoUrl: string
  ): Promise<string> {
    const source = await fetchT(videoUrl);
    if (!source.ok) {
      throw new Error(`Could not fetch the source video (${source.status}).`);
    }
    const bytes = await source.arrayBuffer();
    const res = await fetchT(
      uploadUrl,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'video/*' },
        body: bytes,
      },
      120_000 // a video transfer needs a longer ceiling than the default 20s
    );
    if (!res.ok) {
      throw new Error(`YouTube upload failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as YouTubeVideoResponse;
    if (!data.id) throw new Error('YouTube upload returned no video id.');
    return data.id;
  }

  private async firstChannel(accessToken: string): Promise<YouTubeChannel | undefined> {
    return (await this.listChannels(accessToken))[0];
  }

  private async listChannels(accessToken: string): Promise<YouTubeChannel[]> {
    try {
      const params = new URLSearchParams({ part: 'snippet', mine: 'true' });
      const res = await fetchT(`${CHANNELS_URL}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as YouTubeChannelsResponse;
      return data.items ?? [];
    } catch {
      return [];
    }
  }
}
