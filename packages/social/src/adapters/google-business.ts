// Google Business Profile adapter (docs/133, build plan docs/134 Slice 3) — publishes
// local posts to a tenant's Google Business Profile locations, the lightest-approval
// v1 platform and a strong fit for the local/service businesses on sparx.
//
// Auth: standard Google OAuth 2.0 (offline → refresh token), scope
// `business.manage`. Reuses sparx's existing GOOGLE_OAUTH_CLIENT_ID/_SECRET web
// client (the same one Google Shopping + Calendar use) — no new app to register.
//
// Targets: a GBP "target" is a LOCATION. listTargets walks accounts → locations and
// returns one SocialTargetRef per location, whose externalTargetId is the v4 post
// parent `accounts/{aid}/locations/{lid}` (exactly what publish needs).
//
// Publish: a Local Post via the v4 API — summary (≤1500 chars) + one optional PHOTO +
// an optional LEARN_MORE call-to-action for the link. Matches the platform's
// constraints (image-only, single media, 1500-char body — see constraints.ts).
//
// APIs:
//   Account Management  https://mybusinessaccountmanagement.googleapis.com/v1/accounts
//   Business Info       https://mybusinessbusinessinformation.googleapis.com/v1/{account}/locations
//   Local Posts (v4)    https://mybusiness.googleapis.com/v4/{parent}/localPosts
//
// No SDKs — pure `fetch` via the shared `_http` helpers, mirroring the channels
// adapters. Pure I/O: the worker resolves + decrypts the token and passes SocialAuth.

import type {
  PlatformConstraints,
  RenderedPost,
  SocialAdapter,
  SocialAuth,
  SocialConnectContext,
  SocialInboxEntry,
  SocialPublishResult,
  SocialReplyResult,
  SocialTargetRef,
  SocialTokens,
} from '../types.js';
import { PLATFORM_CONSTRAINTS } from '../constraints.js';
import {
  describeResponse,
  expiresInSeconds,
  fetchT,
  formBody,
  readPlatformCreds,
  requireCreds,
  splitScopes,
} from './_http.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ACCOUNTS_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
const BUSINESS_INFO_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const LOCAL_POSTS_BASE = 'https://mybusiness.googleapis.com/v4';
const SCOPE = 'https://www.googleapis.com/auth/business.manage';

/** Google reports a star rating as a word. */
const STAR_VALUES: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

interface GbpReviewsResponse {
  reviews?: {
    reviewId?: string;
    reviewer?: { displayName?: string; profilePhotoUrl?: string };
    starRating?: string;
    comment?: string;
    createTime?: string;
    reviewReply?: { comment?: string; updateTime?: string };
  }[];
}

// GBP reuses sparx's existing Google OAuth web client (also used by Shopping/Calendar).
const ID_VAR = 'GOOGLE_OAUTH_CLIENT_ID';
const SECRET_VAR = 'GOOGLE_OAUTH_CLIENT_SECRET';

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

interface GbpAccount {
  name: string; // 'accounts/{accountId}'
  accountName?: string;
}
interface GbpAccountsResponse {
  accounts?: GbpAccount[];
}

interface GbpLocation {
  name: string; // 'locations/{locationId}'
  title?: string;
}
interface GbpLocationsResponse {
  locations?: GbpLocation[];
  nextPageToken?: string;
}

interface GbpLocalPostResponse {
  name?: string; // 'accounts/.../localPosts/{id}'
  searchUrl?: string;
}

export class GoogleBusinessAdapter implements SocialAdapter {
  readonly id = 'google_business' as const;
  readonly name = 'Google Business Profile';
  readonly constraints: PlatformConstraints = PLATFORM_CONSTRAINTS.google_business;

  // Re-read per call (env can change between a cold isConfigured() check and a later
  // connect/publish call).
  private creds() {
    return readPlatformCreds(ID_VAR, SECRET_VAR);
  }

  private authHeaders(accessToken: string): Record<string, string> {
    return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
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

    // Best-effort: resolve the connected Business account so the connection shows a
    // real name, but don't fail the connect if the accounts call hiccups.
    const account = await this.firstAccount(data.access_token);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: expiresInSeconds(data.expires_in, 3600),
      scope: data.scope,
      externalId: account?.name,
      displayName: account?.accountName ?? account?.name,
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
      scope: data.scope,
    };
  }

  /** Walk every account's locations and return one target per location. The
   *  externalTargetId is the v4 post parent `accounts/{aid}/locations/{lid}`. */
  async listTargets(auth: SocialAuth): Promise<SocialTargetRef[]> {
    const accounts = await this.listAccounts(auth.accessToken);
    const targets: SocialTargetRef[] = [];
    for (const account of accounts) {
      for (const location of await this.listLocations(auth.accessToken, account.name)) {
        // location.name is 'locations/{id}'; the v4 post parent joins the account.
        targets.push({
          externalTargetId: `${account.name}/${location.name}`,
          name: location.title ?? location.name,
          params: { account: account.name },
        });
      }
    }
    return targets;
  }

  async publish(
    auth: SocialAuth,
    target: SocialTargetRef,
    post: RenderedPost,
    idempotencyKey: string
  ): Promise<SocialPublishResult> {
    const body: Record<string, unknown> = {
      languageCode: 'en-US',
      summary: post.text,
      topicType: 'STANDARD',
    };
    const photo = post.mediaUrls[0];
    if (photo) body.media = [{ mediaFormat: 'PHOTO', sourceUrl: photo }];
    if (post.link) body.callToAction = { actionType: 'LEARN_MORE', url: post.link };

    const res = await fetchT(`${LOCAL_POSTS_BASE}/${target.externalTargetId}/localPosts`, {
      method: 'POST',
      headers: {
        ...this.authHeaders(auth.accessToken),
        // The platform post id is our idempotency anchor; GBP has no request-id
        // header, so a retry relies on the caller not re-issuing a succeeded target.
        'x-sparx-idempotency-key': idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Google Business post failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as GbpLocalPostResponse;
    return {
      externalId: data.name ?? idempotencyKey,
      permalink: data.searchUrl,
    };
  }

  // ── the inbound direction: reviews on this listing ──

  /**
   * Google Business reviews need NO extra review of their own — `business.manage`, the
   * scope this adapter already holds to post, also reads and answers reviews. So this is
   * the one platform where the engagement inbox works on day one, with no external clock.
   * It is also, for a local business, the one that matters most: a Google review is what
   * the next customer reads.
   */
  supportsInbox(): boolean {
    return this.isConfigured();
  }

  async listInbox(
    auth: SocialAuth,
    target: SocialTargetRef,
    since?: Date
  ): Promise<SocialInboxEntry[]> {
    const res = await fetchT(`${LOCAL_POSTS_BASE}/${target.externalTargetId}/reviews?pageSize=50`, {
      headers: this.authHeaders(auth.accessToken),
    });
    if (!res.ok) {
      throw new Error(`Google Business reviews failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as GbpReviewsResponse;
    const cutoff = since?.getTime() ?? 0;
    const entries: SocialInboxEntry[] = [];

    for (const review of data.reviews ?? []) {
      if (!review.reviewId) continue;
      const at = review.createTime ? new Date(review.createTime) : new Date();
      if (at.getTime() <= cutoff) continue;

      entries.push({
        externalId: review.reviewId,
        kind: 'review',
        ...(review.reviewer?.displayName ? { authorName: review.reviewer.displayName } : {}),
        ...(review.reviewer?.profilePhotoUrl
          ? { authorAvatarUrl: review.reviewer.profilePhotoUrl }
          : {}),
        ...(review.comment ? { text: review.comment } : {}),
        ...(review.starRating ? { rating: STAR_VALUES[review.starRating] ?? undefined } : {}),
        receivedAt: at,
      });

      // A reply already made — in Google's own console, or by us before — rides along as
      // an outbound item so the inbox shows the review as answered rather than open.
      if (review.reviewReply?.comment) {
        entries.push({
          externalId: `${review.reviewId}:reply`,
          kind: 'review',
          parentExternalId: review.reviewId,
          threadExternalId: review.reviewId,
          text: review.reviewReply.comment,
          receivedAt: review.reviewReply.updateTime ? new Date(review.reviewReply.updateTime) : at,
          outbound: true,
        });
      }
    }
    return entries;
  }

  /** Answer a review. Google models this as an idempotent PUT of THE reply — a business
   *  has exactly one, and answering twice edits it rather than adding a second. */
  async replyToInbox(
    auth: SocialAuth,
    target: SocialTargetRef,
    parentExternalId: string,
    text: string
  ): Promise<SocialReplyResult> {
    const res = await fetchT(
      `${LOCAL_POSTS_BASE}/${target.externalTargetId}/reviews/${parentExternalId}/reply`,
      {
        method: 'PUT',
        headers: this.authHeaders(auth.accessToken),
        body: JSON.stringify({ comment: text }),
      }
    );
    if (!res.ok) {
      throw new Error(`Google Business review reply failed: ${await describeResponse(res)}`);
    }
    return { externalId: `${parentExternalId}:reply` };
  }

  // ── internals ──

  private async firstAccount(accessToken: string): Promise<GbpAccount | undefined> {
    const accounts = await this.listAccounts(accessToken);
    return accounts[0];
  }

  private async listAccounts(accessToken: string): Promise<GbpAccount[]> {
    try {
      const res = await fetchT(ACCOUNTS_URL, { headers: this.authHeaders(accessToken) });
      if (!res.ok) return [];
      const data = (await res.json()) as GbpAccountsResponse;
      return data.accounts ?? [];
    } catch {
      return [];
    }
  }

  private async listLocations(accessToken: string, account: string): Promise<GbpLocation[]> {
    const out: GbpLocation[] = [];
    let pageToken: string | undefined;
    // readMask is REQUIRED by the Business Information API; page through all locations.
    do {
      const params = new URLSearchParams({ readMask: 'name,title', pageSize: '100' });
      if (pageToken) params.set('pageToken', pageToken);
      const res = await fetchT(`${BUSINESS_INFO_BASE}/${account}/locations?${params.toString()}`, {
        headers: this.authHeaders(accessToken),
      });
      if (!res.ok) break;
      const data = (await res.json()) as GbpLocationsResponse;
      out.push(...(data.locations ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);
    return out;
  }
}
