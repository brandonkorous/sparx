// LinkedIn adapter (docs/133, build plan docs/134 Slice 8) — publishes posts to a
// tenant's LinkedIn ORGANIZATION (company) pages, the second v1 platform. Proving the
// abstraction with a second platform flushed out the shared spine (the connect flow,
// the renderer, the worker publish loop are all platform-agnostic — this file is the
// only new code).
//
// Auth: LinkedIn OAuth 2.0 (authorization code). Scopes:
//   - w_organization_social   post on behalf of an org the user administers
//   - rw_organization_admin   list the orgs the user administers (listTargets)
//   - openid, profile         name the connection after the authorizing member
// Access tokens are long-lived (~60 days); a refresh token is returned when the app
// is approved for it (refresh() rotates when present).
//
// Targets: a LinkedIn "target" is an ORGANIZATION PAGE. listTargets reads the member's
// ADMINISTRATOR ACLs and returns one SocialTargetRef per org, whose externalTargetId
// is the author urn `urn:li:organization:{id}` — exactly what publish posts as.
//
// Publish: the versioned Posts API (`/rest/posts`). An image post uploads the asset
// through the Images API (initialize → PUT bytes → reference the image urn); a link-
// only post uses an article card; otherwise text-only. A firstComment (the hashtag
// block) is posted as a follow-up comment, best-effort.
//
// APIs:
//   OAuth        https://www.linkedin.com/oauth/v2/{authorization,accessToken}
//   Member info  https://api.linkedin.com/v2/userinfo            (OIDC)
//   Admin ACLs   https://api.linkedin.com/v2/organizationalEntityAcls
//   Posts+Images https://api.linkedin.com/rest/{posts,images}    (LinkedIn-Version)
//
// No SDKs — pure `fetch` via the shared `_http` helpers, like every sparx adapter.
// Pure I/O: the worker resolves + decrypts the token and passes SocialAuth.

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
import { appendLink, firstImageUrl } from './_media.js';

// Re-exported so this file stays the one import site for the LinkedIn adapter's
// helpers (its tests import them from here); the shared implementations live in _media.
export { appendLink, firstImageUrl } from './_media.js';

const AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const ACLS_URL = 'https://api.linkedin.com/v2/organizationalEntityAcls';
const REST_BASE = 'https://api.linkedin.com/rest';
// The dated REST API version the Posts + Images calls pin to (YYYYMM). LinkedIn
// requires this header on every versioned call; bump it when adopting a newer schema.
const LINKEDIN_VERSION = '202405';
const POST_SCOPE = 'openid profile w_organization_social rw_organization_admin';

/** Reading the comments under a company page's posts needs its own scope. Gated on env
 *  like every other capability that depends on an approval we may not have yet, and it
 *  widens the scope requested at CONNECT — so a tenant never carries a token that
 *  silently lacks what the inbox needs. */
function linkedinInboxEnabled(): boolean {
  const raw = process.env.LINKEDIN_INBOX_ENABLED?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function scope(): string {
  return linkedinInboxEnabled() ? `${POST_SCOPE} r_organization_social` : POST_SCOPE;
}

const ID_VAR = 'LINKEDIN_CLIENT_ID';
const SECRET_VAR = 'LINKEDIN_CLIENT_SECRET';

interface LinkedInTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

interface LinkedInUserinfo {
  sub?: string;
  name?: string;
  picture?: string;
}

interface OrgAclElement {
  organizationalTarget?: string; // 'urn:li:organization:{id}'
  'organizationalTarget~'?: { localizedName?: string };
}
interface OrgAclsResponse {
  elements?: OrgAclElement[];
}

interface ImageInitResponse {
  value?: { uploadUrl?: string; image?: string };
}

interface LinkedInPostsResponse {
  elements?: { id?: string }[];
}
interface LinkedInCommentsResponse {
  elements?: {
    $URN?: string;
    id?: string;
    actor?: string;
    message?: { text?: string };
    created?: { time?: number };
  }[];
}

/** The public permalink for a published post urn. */
export function linkedInPermalink(urn: string): string {
  return `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}`;
}

export interface LinkedInPostPlan {
  /** The post body. An image post carries the link inline; a link-card post doesn't. */
  commentary: string;
  /** Image to upload + attach as media (mutually exclusive with articleUrl). */
  imageUrl: string | null;
  /** Link to attach as an article card (only when there's no image). */
  articleUrl: string | null;
}

/** Decide how one rendered post maps onto a LinkedIn post — pure, so the media/link
 *  branching is unit-tested without any network. An image wins (richest); with an
 *  image the link rides in the commentary, otherwise a bare link becomes an article
 *  card, otherwise it's text-only. */
export function planLinkedInPost(post: RenderedPost): LinkedInPostPlan {
  const imageUrl = firstImageUrl(post.mediaUrls);
  if (imageUrl) {
    return {
      commentary: post.link ? appendLink(post.text, post.link) : post.text,
      imageUrl,
      articleUrl: null,
    };
  }
  if (post.link) {
    return { commentary: post.text, imageUrl: null, articleUrl: post.link };
  }
  return { commentary: post.text, imageUrl: null, articleUrl: null };
}

export class LinkedInAdapter implements SocialAdapter {
  readonly id = 'linkedin' as const;
  readonly name = 'LinkedIn';
  readonly constraints: PlatformConstraints = PLATFORM_CONSTRAINTS.linkedin;

  private creds() {
    return readPlatformCreds(ID_VAR, SECRET_VAR);
  }

  /** Headers for the dated REST API (Posts + Images). */
  private restHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    };
  }

  /** Headers for the classic v2 API (userinfo + ACLs). */
  private v2Headers(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    };
  }

  isConfigured(): boolean {
    return this.creds() !== null;
  }

  requiredScopes(): string[] {
    return splitScopes(scope());
  }

  connectUrl(ctx: SocialConnectContext): string {
    const { clientId } = requireCreds(this.creds(), this.name);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: ctx.redirectUri,
      scope: scope(),
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
        grant_type: 'authorization_code',
        code,
        redirect_uri: ctx.redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!res.ok) {
      throw new Error(`LinkedIn token exchange failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as LinkedInTokenResponse;

    // Best-effort: name the connection after the authorizing member; never fail the
    // connect if userinfo hiccups (org posting doesn't depend on it).
    const member = await this.memberInfo(data.access_token);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: expiresInSeconds(data.expires_in, 5_184_000), // ~60 days
      scope: data.scope,
      externalId: member?.sub,
      displayName: member?.name ?? 'LinkedIn',
      avatarUrl: member?.picture,
    };
  }

  async refresh(refreshToken: string): Promise<SocialTokens> {
    const { clientId, clientSecret } = requireCreds(this.creds(), this.name);
    const res = await fetchT(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!res.ok) {
      throw new Error(`LinkedIn token refresh failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as LinkedInTokenResponse;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: expiresInSeconds(data.expires_in, 5_184_000),
      scope: data.scope,
    };
  }

  /** One target per organization the member ADMINISTERS. externalTargetId is the
   *  author urn `urn:li:organization:{id}`. */
  async listTargets(auth: SocialAuth): Promise<SocialTargetRef[]> {
    const params = new URLSearchParams({
      q: 'roleAssignee',
      role: 'ADMINISTRATOR',
      state: 'APPROVED',
      count: '100',
      projection: '(elements*(organizationalTarget~(localizedName)))',
    });
    const res = await fetchT(`${ACLS_URL}?${params.toString()}`, {
      headers: this.v2Headers(auth.accessToken),
    });
    if (!res.ok) {
      throw new Error(`LinkedIn org lookup failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as OrgAclsResponse;
    const targets: SocialTargetRef[] = [];
    for (const el of data.elements ?? []) {
      const urn = el.organizationalTarget;
      if (!urn) continue;
      targets.push({
        externalTargetId: urn,
        name: el['organizationalTarget~']?.localizedName ?? urn,
      });
    }
    return targets;
  }

  async publish(
    auth: SocialAuth,
    target: SocialTargetRef,
    post: RenderedPost,
    idempotencyKey: string
  ): Promise<SocialPublishResult> {
    const authorUrn = target.externalTargetId;
    const plan = planLinkedInPost(post);

    const body: Record<string, unknown> = {
      author: authorUrn,
      commentary: plan.commentary,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };

    if (plan.imageUrl) {
      const imageUrn = await this.uploadImage(auth.accessToken, authorUrn, plan.imageUrl);
      body.content = { media: { id: imageUrn } };
    } else if (plan.articleUrl) {
      body.content = { article: { source: plan.articleUrl } };
    }

    const res = await fetchT(`${REST_BASE}/posts`, {
      method: 'POST',
      headers: {
        ...this.restHeaders(auth.accessToken),
        // LinkedIn de-dupes on this within a short window; our real idempotency anchor
        // is still the caller not re-issuing a succeeded target (postId:targetId).
        'X-RestLi-Method': 'CREATE',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`LinkedIn post failed: ${await describeResponse(res)}`);
    }
    // The created post's urn comes back in a response header, not the (empty) body.
    const urn =
      res.headers.get('x-restli-id') ?? res.headers.get('x-linkedin-id') ?? idempotencyKey;

    // First comment (the hashtag block) — additive, never fails a live post.
    if (post.firstComment) {
      await this.tryComment(auth.accessToken, authorUrn, urn, post.firstComment);
    }

    return { externalId: urn, permalink: linkedInPermalink(urn) };
  }

  // ── internals ──

  private async memberInfo(accessToken: string): Promise<LinkedInUserinfo | null> {
    try {
      const res = await fetchT(USERINFO_URL, { headers: this.v2Headers(accessToken) });
      if (!res.ok) return null;
      return (await res.json()) as LinkedInUserinfo;
    } catch {
      return null;
    }
  }

  /** Upload an image via the Images API and return its `urn:li:image:...`. Three
   *  steps: initialize (get a signed upload URL + the image urn), PUT the bytes, then
   *  the caller references the urn in the post's media. */
  private async uploadImage(
    accessToken: string,
    ownerUrn: string,
    imageUrl: string
  ): Promise<string> {
    const initRes = await fetchT(`${REST_BASE}/images?action=initializeUpload`, {
      method: 'POST',
      headers: this.restHeaders(accessToken),
      body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
    });
    if (!initRes.ok) {
      throw new Error(`LinkedIn image init failed: ${await describeResponse(initRes)}`);
    }
    const init = (await initRes.json()) as ImageInitResponse;
    const uploadUrl = init.value?.uploadUrl;
    const imageUrn = init.value?.image;
    if (!uploadUrl || !imageUrn) {
      throw new Error('LinkedIn image init returned no upload URL.');
    }

    const source = await fetchT(imageUrl);
    if (!source.ok) {
      throw new Error(`Could not fetch the post image (${source.status}).`);
    }
    const bytes = await source.arrayBuffer();

    const putRes = await fetchT(uploadUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: bytes,
    });
    if (!putRes.ok) {
      throw new Error(`LinkedIn image upload failed: ${await describeResponse(putRes)}`);
    }
    return imageUrn;
  }

  // ── the inbound direction: comments on this company page's posts ──

  supportsInbox(): boolean {
    return this.isConfigured() && linkedinInboxEnabled();
  }

  /**
   * Pull recent comments under the organization's own posts.
   *
   * Same shape as the Meta adapters and for the same reason: LinkedIn has no
   * page-wide comment feed, so this walks the org's recent POSTS and reads the
   * `socialActions` comments on each. `since` bounds it by dropping anything older,
   * because the posts finder has no since parameter.
   */
  async listInbox(
    auth: SocialAuth,
    target: SocialTargetRef,
    since?: Date
  ): Promise<SocialInboxEntry[]> {
    const orgUrn = target.externalTargetId;
    const cutoff = since?.getTime() ?? 0;

    const postsRes = await fetchT(
      `${REST_BASE}/posts?q=author&author=${encodeURIComponent(orgUrn)}&count=20&sortBy=LAST_MODIFIED`,
      { headers: this.restHeaders(auth.accessToken) }
    );
    if (!postsRes.ok) {
      throw new Error(`LinkedIn posts read failed: ${await describeResponse(postsRes)}`);
    }
    const posts = (await postsRes.json()) as LinkedInPostsResponse;

    const entries: SocialInboxEntry[] = [];
    for (const post of posts.elements ?? []) {
      const urn = post.id;
      if (!urn) continue;

      // A post with comments disabled 404s here; one org post failing must not lose the
      // comments on the other nineteen.
      let comments: LinkedInCommentsResponse;
      try {
        const res = await fetchT(
          `${REST_BASE}/socialActions/${encodeURIComponent(urn)}/comments?count=50`,
          { headers: this.restHeaders(auth.accessToken) }
        );
        if (!res.ok) continue;
        comments = (await res.json()) as LinkedInCommentsResponse;
      } catch {
        continue;
      }

      for (const comment of comments.elements ?? []) {
        if (!comment.$URN && !comment.id) continue;
        const at = comment.created?.time ? new Date(comment.created.time) : new Date();
        if (at.getTime() <= cutoff) continue;
        entries.push({
          externalId: comment.$URN ?? comment.id ?? '',
          kind: 'comment',
          threadExternalId: urn,
          postExternalId: urn,
          ...(comment.message?.text ? { text: comment.message.text } : {}),
          permalink: linkedInPermalink(urn),
          receivedAt: at,
          // A comment the PAGE itself left is our own half of the conversation.
          outbound: comment.actor === orgUrn,
        });
      }
    }
    return entries;
  }

  /** Reply to a comment as the ORGANIZATION. LinkedIn threads a reply by posting a
   *  comment on the parent comment's own socialActions. */
  async replyToInbox(
    auth: SocialAuth,
    target: SocialTargetRef,
    parentExternalId: string,
    text: string
  ): Promise<SocialReplyResult> {
    const res = await fetchT(
      `${REST_BASE}/socialActions/${encodeURIComponent(parentExternalId)}/comments`,
      {
        method: 'POST',
        headers: this.restHeaders(auth.accessToken),
        body: JSON.stringify({
          actor: target.externalTargetId,
          message: { text },
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`LinkedIn comment reply failed: ${await describeResponse(res)}`);
    }
    const id = res.headers.get('x-restli-id') ?? `${parentExternalId}:reply`;
    return { externalId: id };
  }

  /** Post the first comment on a published post. Best-effort — swallows failures so a
   *  comment hiccup never marks the (already-live) post failed. */
  private async tryComment(
    accessToken: string,
    actorUrn: string,
    postUrn: string,
    text: string
  ): Promise<void> {
    try {
      await fetchT(`${REST_BASE}/socialActions/${encodeURIComponent(postUrn)}/comments`, {
        method: 'POST',
        headers: this.restHeaders(accessToken),
        body: JSON.stringify({ actor: actorUrn, message: { text } }),
      });
    } catch {
      // additive — the post is live regardless
    }
  }
}
