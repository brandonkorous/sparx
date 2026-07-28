// Facebook Page adapter (docs/133 §6, build plan docs/134 Phase 2) — publishes posts
// to a tenant's Facebook PAGES. The heaviest-approval, highest-reach platform; rides
// the shared Meta app + Business Verification alongside Instagram + Threads.
//
// Auth: Facebook Login (OAuth 2.0). The callback code becomes a short-lived USER token,
// which we immediately exchange for a long-lived one (~60 days). Scopes:
//   - pages_show_list, pages_read_engagement   list the Pages the user manages
//   - pages_manage_posts                        publish on their behalf
//   - business_management                       resolve Pages under a Business
// Meta issues no refresh_token; instead we RE-EXCHANGE the long-lived token before it
// lapses (refresh() below), so a used connection stays alive indefinitely.
//
// Targets: a target is a PAGE. listTargets returns one per managed Page, carrying that
// Page's OWN access token in params — publishing authenticates as the PAGE, not the
// user, and a Page token derived from a long-lived user token does not expire.
//
// Publish (Graph `/{page}/{photos,feed}`): a single image → a photo post; multiple
// images → unpublished photos stitched into a feed post via `attached_media`; a bare
// link → a feed post with a link preview card; otherwise a text status.
//
// No SDKs — pure `fetch` via the shared `_http`/`_meta` helpers. Pure I/O: the worker
// resolves + decrypts the token and passes SocialAuth.

import type {
  PlatformConstraints,
  RenderedPost,
  SocialAccessProbe,
  SocialAdapter,
  SocialAuth,
  SocialConnectContext,
  SocialInboxEntry,
  SocialPostMetrics,
  SocialPublishResult,
  SocialReplyResult,
  SocialTargetRef,
  SocialTokens,
} from '../types.js';
import { PLATFORM_CONSTRAINTS } from '../constraints.js';
import {
  buildMetaConnectUrl,
  exchangeLongLivedToken,
  exchangeMetaCode,
  fetchMe,
  graphGet,
  graphPost,
  graphPostMultipart,
  listMetaPages,
  metaCreds,
  metaInboxEnabled,
  META_ENGAGEMENT_SCOPES,
  probeMetaAccess,
  withInboxScopes,
  type MetaCreds,
} from './_meta.js';
import { appendLink, fetchImageBinary, imageUrls } from './_media.js';
import { requireCreds, splitScopes } from './_http.js';

const POST_SCOPE =
  'public_profile,pages_show_list,pages_manage_posts,pages_read_engagement,business_management';

/** The scope requested at connect time. Widens to include reading + answering comments
 *  only once that App Review has landed, so a tenant never carries a token that silently
 *  lacks the permissions the inbox needs. */
function scope(): string {
  return withInboxScopes(POST_SCOPE, META_ENGAGEMENT_SCOPES);
}

/** The public permalink for a Page post/story id (`{pageId}_{postId}` or a story id). */
export function facebookPermalink(id: string): string {
  return `https://www.facebook.com/${id}`;
}

export type FacebookPostPlan =
  | { kind: 'single_photo'; imageUrl: string; caption: string }
  | { kind: 'multi_photo'; imageUrls: string[]; message: string }
  | { kind: 'feed'; message: string; link: string | null };

/** Decide how one rendered post maps onto a Facebook Page post — pure, so the
 *  photo/gallery/link/text branching is unit-tested without any network. A photo post's
 *  caption and a gallery's message have no clickable link field, so the link is folded
 *  into the text; a link with no image becomes a feed post with a preview card. */
export function planFacebookPost(post: RenderedPost): FacebookPostPlan {
  const imgs = imageUrls(post.mediaUrls);
  const link = post.link ?? null;
  const [firstImg] = imgs;
  if (imgs.length === 1 && firstImg) {
    return {
      kind: 'single_photo',
      imageUrl: firstImg,
      caption: link ? appendLink(post.text, link) : post.text,
    };
  }
  if (imgs.length > 1) {
    return {
      kind: 'multi_photo',
      imageUrls: imgs,
      message: link ? appendLink(post.text, link) : post.text,
    };
  }
  return { kind: 'feed', message: post.text, link };
}

interface FbPhotoResponse {
  id: string;
  post_id?: string;
}
interface FbFeedResponse {
  id: string;
}
interface FbEngagementResponse {
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
}
interface FbInsightsResponse {
  data?: { name?: string; values?: { value?: number }[] }[];
}
interface FbFeedCommentsResponse {
  data?: {
    id?: string;
    permalink_url?: string;
    comments?: {
      data?: {
        id?: string;
        from?: { id?: string; name?: string };
        message?: string;
        created_time?: string;
        permalink_url?: string;
        parent?: { id?: string };
      }[];
    };
  }[];
}
interface FbRatingsResponse {
  data?: {
    open_graph_story?: { id?: string };
    reviewer?: { name?: string };
    rating?: number;
    review_text?: string;
    created_time?: string;
  }[];
}

export class FacebookPageAdapter implements SocialAdapter {
  readonly id = 'facebook_page' as const;
  readonly name = 'Facebook Page';
  readonly constraints: PlatformConstraints = PLATFORM_CONSTRAINTS.facebook_page;

  private creds(): MetaCreds | null {
    return metaCreds();
  }

  isConfigured(): boolean {
    return this.creds() !== null;
  }

  requiredScopes(): string[] {
    return splitScopes(scope());
  }

  probeAccess(auth: SocialAuth): Promise<SocialAccessProbe> {
    return probeMetaAccess(
      requireCreds(this.creds(), this.name),
      auth.externalId,
      auth.accessToken
    );
  }

  connectUrl(ctx: SocialConnectContext): string {
    return buildMetaConnectUrl(requireCreds(this.creds(), this.name), ctx, scope());
  }

  async exchangeCode(code: string, ctx: SocialConnectContext): Promise<SocialTokens> {
    const creds = requireCreds(this.creds(), this.name);
    const shortToken = await exchangeMetaCode(creds, code, ctx.redirectUri);
    const longLived = await exchangeLongLivedToken(creds, shortToken);
    const me = await fetchMe(longLived.accessToken);
    return {
      accessToken: longLived.accessToken,
      // Meta has no refresh_token — store the long-lived token so the worker's refresh
      // seam re-exchanges it (refresh() below) before the ~60-day window lapses.
      refreshToken: longLived.accessToken,
      expiresInSeconds: longLived.expiresInSeconds,
      scope: scope(),
      externalId: me?.id,
      displayName: me?.name ?? 'Facebook',
      avatarUrl: me?.picture?.data?.url,
    };
  }

  async refresh(refreshToken: string): Promise<SocialTokens> {
    const creds = requireCreds(this.creds(), this.name);
    const longLived = await exchangeLongLivedToken(creds, refreshToken);
    return {
      accessToken: longLived.accessToken,
      refreshToken: longLived.accessToken,
      expiresInSeconds: longLived.expiresInSeconds,
      scope: scope(),
    };
  }

  /** One target per managed Page. externalTargetId is the Page id; the Page's own
   *  access token rides in params (publishing authenticates as the Page). */
  async listTargets(auth: SocialAuth): Promise<SocialTargetRef[]> {
    const pages = await listMetaPages(auth.accessToken);
    const targets: SocialTargetRef[] = [];
    for (const page of pages) {
      if (!page.access_token) continue; // a Page with no token can't be posted to
      targets.push({
        externalTargetId: page.id,
        name: page.name ?? page.id,
        avatarUrl: page.picture?.data?.url,
        params: { pageAccessToken: page.access_token },
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
    // Graph de-dupes server-side; our real anchor is the worker not re-issuing a
    // succeeded target (postId:targetId), so the key is unused on this platform.
    void idempotencyKey;
    // Publish as the PAGE — its token was captured at connect time; fall back to the
    // user token only if a legacy target predates per-Page tokens.
    const pageToken = target.params?.pageAccessToken ?? auth.accessToken;
    const pageId = target.externalTargetId;
    const plan = planFacebookPost(post);

    if (plan.kind === 'single_photo') {
      // Upload the BYTES (multipart `source`), not a `url` for Graph to fetch: our CDN
      // serves Graph's range-fetch a 206 that /photos rejects (see graphPostMultipart).
      const img = await fetchImageBinary(plan.imageUrl);
      const res = await graphPostMultipart<FbPhotoResponse>(
        `${pageId}/photos`,
        pageToken,
        { caption: plan.caption },
        { field: 'source', bytes: img.bytes, filename: img.filename, contentType: img.contentType },
        'Facebook photo post'
      );
      const id = res.post_id ?? res.id;
      return { externalId: id, permalink: facebookPermalink(id) };
    }

    if (plan.kind === 'multi_photo') {
      const mediaFields: Record<string, string> = { message: plan.message };
      let i = 0;
      for (const url of plan.imageUrls) {
        const img = await fetchImageBinary(url);
        const photo = await graphPostMultipart<FbPhotoResponse>(
          `${pageId}/photos`,
          pageToken,
          { published: 'false' },
          {
            field: 'source',
            bytes: img.bytes,
            filename: img.filename,
            contentType: img.contentType,
          },
          'Facebook photo upload'
        );
        mediaFields[`attached_media[${i}]`] = JSON.stringify({ media_fbid: photo.id });
        i += 1;
      }
      const res = await graphPost<FbFeedResponse>(
        `${pageId}/feed`,
        pageToken,
        mediaFields,
        'Facebook gallery post'
      );
      return { externalId: res.id, permalink: facebookPermalink(res.id) };
    }

    const fields: Record<string, string> = { message: plan.message };
    if (plan.link) fields.link = plan.link;
    const res = await graphPost<FbFeedResponse>(
      `${pageId}/feed`,
      pageToken,
      fields,
      'Facebook post'
    );
    return { externalId: res.id, permalink: facebookPermalink(res.id) };
  }

  // ── the inbound direction: comments + reviews on this Page ──

  supportsInbox(): boolean {
    return metaInboxEnabled();
  }

  /**
   * Pull recent comments on the Page's own posts, plus its reviews.
   *
   * Graph has no "every comment on my Page" endpoint, so this walks the Page's recent
   * FEED and takes the comments hanging off each post — one request instead of one per
   * post. `since` keeps that walk short: an established Page has years of posts and the
   * inbox only wants what has happened since the last poll.
   *
   * A comment we posted ourselves comes back flagged `outbound` rather than dropped, so a
   * thread reads as a conversation instead of only the customer's half.
   */
  async listInbox(
    auth: SocialAuth,
    target: SocialTargetRef,
    since?: Date
  ): Promise<SocialInboxEntry[]> {
    const pageToken = target.params?.pageAccessToken ?? auth.accessToken;
    const pageId = target.externalTargetId;
    const entries: SocialInboxEntry[] = [];
    const sinceParam: Record<string, string> = since
      ? { since: String(Math.floor(since.getTime() / 1000)) }
      : {};

    const feed = await graphGet<FbFeedCommentsResponse>(
      `${pageId}/feed`,
      pageToken,
      {
        fields:
          'id,permalink_url,comments.limit(50){id,from,message,created_time,permalink_url,parent}',
        limit: '25',
        ...sinceParam,
      },
      'Facebook Page comments'
    );

    for (const post of feed.data ?? []) {
      for (const comment of post.comments?.data ?? []) {
        if (!comment.id) continue;
        entries.push({
          externalId: comment.id,
          kind: 'comment',
          threadExternalId: post.id,
          ...(comment.parent?.id ? { parentExternalId: comment.parent.id } : {}),
          ...(post.id ? { postExternalId: post.id } : {}),
          ...(comment.from?.name ? { authorName: comment.from.name } : {}),
          ...(comment.message ? { text: comment.message } : {}),
          ...(comment.permalink_url ? { permalink: comment.permalink_url } : {}),
          receivedAt: comment.created_time ? new Date(comment.created_time) : new Date(),
          // The Page answering itself is context, not something to answer.
          outbound: comment.from?.id === pageId,
        });
      }
    }

    // Reviews are a separate edge and a separate permission; a Page without it simply
    // contributes no reviews rather than failing the whole pull.
    try {
      const ratings = await graphGet<FbRatingsResponse>(
        `${pageId}/ratings`,
        pageToken,
        { fields: 'open_graph_story,reviewer,rating,review_text,created_time', limit: '50' },
        'Facebook Page reviews'
      );
      for (const review of ratings.data ?? []) {
        const id = review.open_graph_story?.id;
        if (!id) continue;
        entries.push({
          externalId: id,
          kind: 'review',
          ...(review.reviewer?.name ? { authorName: review.reviewer.name } : {}),
          ...(review.review_text ? { text: review.review_text } : {}),
          ...(typeof review.rating === 'number' ? { rating: review.rating } : {}),
          receivedAt: review.created_time ? new Date(review.created_time) : new Date(),
        });
      }
    } catch {
      // No review permission on this Page — the comments stand on their own.
    }

    return entries;
  }

  /** Answer a comment as the Page. */
  async replyToInbox(
    auth: SocialAuth,
    target: SocialTargetRef,
    parentExternalId: string,
    text: string
  ): Promise<SocialReplyResult> {
    const pageToken = target.params?.pageAccessToken ?? auth.accessToken;
    const res = await graphPost<FbFeedResponse>(
      `${parentExternalId}/comments`,
      pageToken,
      { message: text },
      'Facebook comment reply'
    );
    return { externalId: res.id, permalink: facebookPermalink(res.id) };
  }

  /** Engagement counts (pages_read_engagement — already granted) plus reach/impressions
   *  (read_insights — extra Meta review) best-effort: a missing insights scope leaves
   *  those two null rather than dropping the counts we do have. Reads as the PAGE. */
  async getMetrics(
    auth: SocialAuth,
    target: SocialTargetRef,
    externalId: string
  ): Promise<SocialPostMetrics> {
    const pageToken = target.params?.pageAccessToken ?? auth.accessToken;
    const metrics: SocialPostMetrics = {};

    const eng = await graphGet<FbEngagementResponse>(
      externalId,
      pageToken,
      { fields: 'likes.summary(true),comments.summary(true),shares' },
      'Facebook post engagement'
    );
    metrics.likes = eng.likes?.summary?.total_count;
    metrics.comments = eng.comments?.summary?.total_count;
    metrics.shares = eng.shares?.count;

    try {
      const insights = await graphGet<FbInsightsResponse>(
        `${externalId}/insights`,
        pageToken,
        { metric: 'post_impressions,post_impressions_unique' },
        'Facebook post insights'
      );
      for (const row of insights.data ?? []) {
        const value = row.values?.[0]?.value;
        if (row.name === 'post_impressions') metrics.impressions = value;
        else if (row.name === 'post_impressions_unique') metrics.reach = value;
      }
    } catch {
      // read_insights not granted yet — the engagement counts stand on their own.
    }
    return metrics;
  }
}
