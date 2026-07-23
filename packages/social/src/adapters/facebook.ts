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
  SocialAdapter,
  SocialAuth,
  SocialConnectContext,
  SocialPublishResult,
  SocialTargetRef,
  SocialTokens,
} from '../types.js';
import { PLATFORM_CONSTRAINTS } from '../constraints.js';
import {
  buildMetaConnectUrl,
  exchangeLongLivedToken,
  exchangeMetaCode,
  fetchMe,
  graphPost,
  listMetaPages,
  metaCreds,
  type MetaCreds,
} from './_meta.js';
import { appendLink, imageUrls } from './_media.js';
import { requireCreds } from './_http.js';

const SCOPE =
  'public_profile,pages_show_list,pages_manage_posts,pages_read_engagement,business_management';

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
  if (imgs.length === 1) {
    return { kind: 'single_photo', imageUrl: imgs[0], caption: link ? appendLink(post.text, link) : post.text };
  }
  if (imgs.length > 1) {
    return { kind: 'multi_photo', imageUrls: imgs, message: link ? appendLink(post.text, link) : post.text };
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
      // Meta has no refresh_token — store the long-lived token so the worker's refresh
      // seam re-exchanges it (refresh() below) before the ~60-day window lapses.
      refreshToken: longLived.accessToken,
      expiresInSeconds: longLived.expiresInSeconds,
      scope: SCOPE,
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
      scope: SCOPE,
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
      const res = await graphPost<FbPhotoResponse>(
        `${pageId}/photos`,
        pageToken,
        { url: plan.imageUrl, caption: plan.caption },
        'Facebook photo post'
      );
      const id = res.post_id ?? res.id;
      return { externalId: id, permalink: facebookPermalink(id) };
    }

    if (plan.kind === 'multi_photo') {
      const mediaFields: Record<string, string> = { message: plan.message };
      let i = 0;
      for (const url of plan.imageUrls) {
        const photo = await graphPost<FbPhotoResponse>(
          `${pageId}/photos`,
          pageToken,
          { url, published: 'false' },
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
}
