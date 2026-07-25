// Instagram adapter (docs/133 §6, build plan docs/134 Phase 2) — publishes to a
// tenant's Instagram BUSINESS accounts. Rides the shared Meta app alongside Facebook
// Pages + Threads; an IG business account is reached THROUGH the Facebook Page it's
// linked to, and publishing authenticates as that Page's access token.
//
// Auth: Facebook Login (OAuth 2.0), same short→long-lived user-token exchange as the
// Facebook adapter. Scopes add `instagram_basic` + `instagram_content_publish`.
//
// Targets: a target is an IG business account. listTargets walks the managed Pages and
// keeps the ones with a linked `instagram_business_account`; externalTargetId is the IG
// user id, and the linked Page's access token rides in params.
//
// Publish (the two-step Content Publishing API): create a media CONTAINER
// (`/{ig}/media`), wait for it to finish processing, then publish it
// (`/{ig}/media_publish`). A single image, a multi-image carousel, and a reel (video)
// are the three shapes; Instagram cannot post text-only (constraints.requiresMedia), so
// the renderer blocks a media-less post before it ever reaches here. Captions carry no
// clickable link, so a canonical link is folded into the caption text.
//
// No SDKs — pure `fetch` via the shared `_http`/`_meta` helpers. Pure I/O: the worker
// resolves + decrypts the token and passes SocialAuth.

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
import {
  buildMetaConnectUrl,
  classifyMediaContainerStatus,
  exchangeLongLivedToken,
  exchangeMetaCode,
  fetchMe,
  graphGet,
  graphPost,
  listMetaPages,
  metaCreds,
  waitForContainer,
  type MetaCreds,
} from './_meta.js';
import { appendLink, imageUrls, isImageUrl } from './_media.js';
import { requireCreds } from './_http.js';

const SCOPE =
  'public_profile,pages_show_list,pages_read_engagement,business_management,instagram_basic,instagram_content_publish';

export type InstagramPostPlan =
  | { kind: 'image'; imageUrl: string; caption: string }
  | { kind: 'carousel'; imageUrls: string[]; caption: string }
  | { kind: 'reel'; videoUrl: string; caption: string }
  | { kind: 'none' };

/** Decide how one rendered post maps onto an Instagram post — pure, so the
 *  image/carousel/reel branching is unit-tested without any network. A link is folded
 *  into the caption (IG captions have no clickable link); a lone video becomes a reel;
 *  a media-less post is `none` (the renderer normally blocks it first). */
export function planInstagramPost(post: RenderedPost): InstagramPostPlan {
  const caption = post.link ? appendLink(post.text, post.link) : post.text;
  const imgs = imageUrls(post.mediaUrls);
  const [firstImg] = imgs;
  if (imgs.length === 1 && firstImg) return { kind: 'image', imageUrl: firstImg, caption };
  if (imgs.length > 1) return { kind: 'carousel', imageUrls: imgs, caption };
  const video = post.mediaUrls.find((u) => !isImageUrl(u));
  if (video) return { kind: 'reel', videoUrl: video, caption };
  return { kind: 'none' };
}

interface IgContainerResponse {
  id: string;
}
interface IgStatusResponse {
  status_code?: string;
}
interface IgPublishResponse {
  id: string;
}
interface IgPermalinkResponse {
  permalink?: string;
}
interface IgCountsResponse {
  like_count?: number;
  comments_count?: number;
}
interface IgInsightsResponse {
  data?: { name?: string; values?: { value?: number }[] }[];
}

export class InstagramAdapter implements SocialAdapter {
  readonly id = 'instagram' as const;
  readonly name = 'Instagram';
  readonly constraints: PlatformConstraints = PLATFORM_CONSTRAINTS.instagram;

  private creds(): MetaCreds | null {
    return metaCreds();
  }

  isConfigured(): boolean {
    return this.creds() !== null;
  }

  connectUrl(ctx: SocialConnectContext): string {
    return buildMetaConnectUrl(requireCreds(this.creds(), this.name), ctx, SCOPE);
  }

  async exchangeCode(code: string, ctx: SocialConnectContext): Promise<SocialTokens> {
    const creds = requireCreds(this.creds(), this.name);
    const shortToken = await exchangeMetaCode(creds, code, ctx.redirectUri);
    const longLived = await exchangeLongLivedToken(creds, shortToken);
    const me = await fetchMe(longLived.accessToken);
    return {
      accessToken: longLived.accessToken,
      refreshToken: longLived.accessToken, // re-exchanged by the refresh seam (§Meta)
      expiresInSeconds: longLived.expiresInSeconds,
      scope: SCOPE,
      externalId: me?.id,
      displayName: me?.name ?? 'Instagram',
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
      scope: SCOPE,
    };
  }

  /** One target per IG business account linked to a managed Page. externalTargetId is
   *  the IG user id; the linked Page's token (which authorizes IG publishing) rides in
   *  params. */
  async listTargets(auth: SocialAuth): Promise<SocialTargetRef[]> {
    const pages = await listMetaPages(auth.accessToken, { includeInstagram: true });
    const targets: SocialTargetRef[] = [];
    for (const page of pages) {
      const ig = page.instagram_business_account;
      if (!ig?.id || !page.access_token) continue;
      targets.push({
        externalTargetId: ig.id,
        name: ig.username ? `@${ig.username}` : (page.name ?? ig.id),
        avatarUrl: ig.profile_picture_url,
        params: {
          pageAccessToken: page.access_token,
          ...(ig.username ? { username: ig.username } : {}),
        },
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
    void idempotencyKey; // two-step create/publish is naturally idempotent per caller
    const token = target.params?.pageAccessToken ?? auth.accessToken;
    const igId = target.externalTargetId;
    const plan = planInstagramPost(post);
    if (plan.kind === 'none') {
      throw new Error('Instagram requires at least one image or video.');
    }

    const creationId = await this.createContainer(token, igId, plan);
    await this.awaitContainer(token, creationId);

    const published = await graphPost<IgPublishResponse>(
      `${igId}/media_publish`,
      token,
      { creation_id: creationId },
      'Instagram publish'
    );
    const mediaId = published.id;

    // First comment (the hashtag block) — additive, never fails a live post.
    if (post.firstComment) {
      try {
        await graphPost(
          `${mediaId}/comments`,
          token,
          { message: post.firstComment },
          'Instagram comment'
        );
      } catch {
        // the post is live regardless
      }
    }

    return { externalId: mediaId, permalink: await this.permalink(token, mediaId) };
  }

  /** Like + comment counts (instagram_basic — granted) plus reach/impressions
   *  (instagram_manage_insights — extra Meta review) best-effort. Instagram feed posts
   *  have no "shares", so that stays null. Reads with the linked Page's token. */
  async getMetrics(
    auth: SocialAuth,
    target: SocialTargetRef,
    externalId: string
  ): Promise<SocialPostMetrics> {
    const token = target.params?.pageAccessToken ?? auth.accessToken;
    const metrics: SocialPostMetrics = {};

    const counts = await graphGet<IgCountsResponse>(
      externalId,
      token,
      { fields: 'like_count,comments_count' },
      'Instagram media counts'
    );
    metrics.likes = counts.like_count;
    metrics.comments = counts.comments_count;

    try {
      const insights = await graphGet<IgInsightsResponse>(
        `${externalId}/insights`,
        token,
        { metric: 'impressions,reach' },
        'Instagram insights'
      );
      for (const row of insights.data ?? []) {
        const value = row.values?.[0]?.value;
        if (row.name === 'impressions') metrics.impressions = value;
        else if (row.name === 'reach') metrics.reach = value;
      }
    } catch {
      // instagram_manage_insights not granted yet — counts stand on their own.
    }
    return metrics;
  }

  // ── internals ──

  /** Create the media container for the planned shape and return its creation id. */
  private async createContainer(
    token: string,
    igId: string,
    plan: Exclude<InstagramPostPlan, { kind: 'none' }>
  ): Promise<string> {
    if (plan.kind === 'image') {
      const res = await graphPost<IgContainerResponse>(
        `${igId}/media`,
        token,
        { image_url: plan.imageUrl, caption: plan.caption },
        'Instagram media container'
      );
      return res.id;
    }
    if (plan.kind === 'reel') {
      const res = await graphPost<IgContainerResponse>(
        `${igId}/media`,
        token,
        { media_type: 'REELS', video_url: plan.videoUrl, caption: plan.caption },
        'Instagram reel container'
      );
      return res.id;
    }
    // carousel: a child container per image, then a parent that references them.
    const childIds: string[] = [];
    for (const url of plan.imageUrls) {
      const child = await graphPost<IgContainerResponse>(
        `${igId}/media`,
        token,
        { image_url: url, is_carousel_item: 'true' },
        'Instagram carousel item'
      );
      await this.awaitContainer(token, child.id);
      childIds.push(child.id);
    }
    const parent = await graphPost<IgContainerResponse>(
      `${igId}/media`,
      token,
      { media_type: 'CAROUSEL', caption: plan.caption, children: childIds.join(',') },
      'Instagram carousel container'
    );
    return parent.id;
  }

  /** Poll a container until it finishes processing (images are usually immediate; a
   *  reel/video can take longer). */
  private async awaitContainer(token: string, containerId: string): Promise<void> {
    await waitForContainer(async () => {
      const status = await graphGet<IgStatusResponse>(
        containerId,
        token,
        { fields: 'status_code' },
        'Instagram container status'
      );
      const { ready, failed } = classifyMediaContainerStatus(status.status_code);
      return { ready, failed, detail: status.status_code };
    });
  }

  private async permalink(token: string, mediaId: string): Promise<string | undefined> {
    try {
      const res = await graphGet<IgPermalinkResponse>(
        mediaId,
        token,
        { fields: 'permalink' },
        'Instagram permalink'
      );
      return res.permalink;
    } catch {
      return undefined;
    }
  }
}
