// Threads adapter (docs/133 §6, build plan docs/134 Phase 2) — publishes to a tenant's
// own Threads profile. Threads rides the same Meta app + Business Verification as
// Facebook + Instagram, but its API is a SEPARATE host (`graph.threads.net`) with its
// own app credentials (`THREADS_APP_ID` / `THREADS_APP_SECRET`) and its own token
// grammar (`th_exchange_token` / `th_refresh_token`), so it keeps its own small helper
// set rather than sharing `_meta`.
//
// Auth: Threads OAuth. The callback code becomes a short-lived token + user id, which we
// exchange for a long-lived token (~60 days). Unlike Facebook, Threads has a real
// refresh endpoint, so refresh() extends the grant in place.
//
// Targets: exactly one — the authorizing user's own Threads profile. externalTargetId
// is the Threads user id.
//
// Publish (the two-step Threads Publishing API): create a media CONTAINER
// (`/{user}/threads`), wait for it to finish (a video needs processing time), then
// publish it (`/{user}/threads_publish`). Text, single image, carousel, and video are
// the shapes; Threads posts text-only, so a bare link uses the native `link_attachment`
// field and only a media post folds the link into the text.
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
import { classifyMediaContainerStatus, waitForContainer } from './_meta.js';
import { appendLink, imageUrls, isImageUrl } from './_media.js';
import {
  describeResponse,
  expiresInSeconds,
  fetchT,
  formBody,
  readPlatformCreds,
  requireCreds,
  splitScopes,
} from './_http.js';

const AUTH_URL = 'https://threads.net/oauth/authorize';
const TOKEN_URL = 'https://graph.threads.net/oauth/access_token';
const LONG_LIVED_URL = 'https://graph.threads.net/access_token';
const REFRESH_URL = 'https://graph.threads.net/refresh_access_token';
const API_BASE = 'https://graph.threads.net/v1.0';
const POST_SCOPE = 'threads_basic,threads_content_publish';

/** Cleared to read post-level insights. Gated on env like every other capability that
 *  waits on a platform review, and it widens the scope requested at CONNECT — so a
 *  tenant never carries a token that silently lacks what the Insights panel needs.
 *  Threads is its own Meta app with its own review, hence its own flag rather than
 *  riding `META_INSIGHTS_ENABLED`. */
function threadsInsightsEnabled(): boolean {
  const raw = process.env.THREADS_INSIGHTS_ENABLED?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function scope(): string {
  return threadsInsightsEnabled() ? `${POST_SCOPE},threads_manage_insights` : POST_SCOPE;
}
const LONG_LIVED_FALLBACK_SECONDS = 5_184_000; // ~60 days

const ID_VAR = 'THREADS_APP_ID';
const SECRET_VAR = 'THREADS_APP_SECRET';

export type ThreadsPostPlan =
  | { kind: 'text'; text: string; link: string | null }
  | { kind: 'image'; imageUrl: string; text: string }
  | { kind: 'carousel'; imageUrls: string[]; text: string }
  | { kind: 'video'; videoUrl: string; text: string };

/** Decide how one rendered post maps onto a Threads post — pure, so the branching is
 *  unit-tested without any network. Threads posts text-only, so a bare link uses the
 *  native link attachment; a media post has no link field, so the link folds into the
 *  text. */
export function planThreadsPost(post: RenderedPost): ThreadsPostPlan {
  const imgs = imageUrls(post.mediaUrls);
  const [firstImg] = imgs;
  if (imgs.length === 1 && firstImg) {
    return {
      kind: 'image',
      imageUrl: firstImg,
      text: post.link ? appendLink(post.text, post.link) : post.text,
    };
  }
  if (imgs.length > 1) {
    return {
      kind: 'carousel',
      imageUrls: imgs,
      text: post.link ? appendLink(post.text, post.link) : post.text,
    };
  }
  const video = post.mediaUrls.find((u) => !isImageUrl(u));
  if (video) {
    return {
      kind: 'video',
      videoUrl: video,
      text: post.link ? appendLink(post.text, post.link) : post.text,
    };
  }
  return { kind: 'text', text: post.text, link: post.link ?? null };
}

/** The public permalink for a published Threads post — the API returns one, but this is
 *  the deterministic fallback. */
export function threadsPermalink(id: string): string {
  return `https://www.threads.net/t/${id}`;
}

interface ThreadsTokenResponse {
  access_token: string;
  user_id?: string;
  expires_in?: number;
}
interface ThreadsMe {
  id?: string;
  username?: string;
  name?: string;
}
interface ThreadsContainerResponse {
  id: string;
}
interface ThreadsStatusResponse {
  status?: string;
  error_message?: string;
}
interface ThreadsPublishResponse {
  id: string;
}
interface ThreadsPermalinkResponse {
  permalink?: string;
}

/** One row of `/{thread}/insights`. Threads reports a lifetime metric as either a
 *  `total_value` object or the older `values[]` array depending on the metric, so both
 *  are read rather than betting on one shape. */
export interface ThreadsInsightRow {
  name?: string;
  total_value?: { value?: number };
  values?: { value?: number }[];
}
interface ThreadsInsightsResponse {
  data?: ThreadsInsightRow[];
}

/** Fold Threads' insight rows into the platform-neutral shape. Pure, so the vocabulary
 *  translation is unit-tested without any network.
 *
 *  Threads speaks its own dialect: `views` is the impression count, `replies` are what a
 *  person calls comments, and a post spreads two ways — a plain `reposts` and a `quotes`
 *  (a repost with commentary). Both are a share, so they SUM into `shares` rather than
 *  picking one and under-reporting how far the post travelled. Threads reports no unique
 *  viewer count, so `reach` stays null — the UI shows "—" instead of echoing impressions
 *  and implying a precision the platform never gave us. */
export function mapThreadsMetrics(rows: ThreadsInsightRow[] | undefined): SocialPostMetrics {
  const value = (row: ThreadsInsightRow): number | undefined =>
    row.total_value?.value ?? row.values?.[0]?.value;

  const metrics: SocialPostMetrics = {};
  let reposts: number | undefined;
  let quotes: number | undefined;

  for (const row of rows ?? []) {
    const n = value(row);
    if (typeof n !== 'number') continue;
    switch (row.name) {
      case 'views':
        metrics.impressions = n;
        break;
      case 'likes':
        metrics.likes = n;
        break;
      case 'replies':
        metrics.comments = n;
        break;
      case 'reposts':
        reposts = n;
        break;
      case 'quotes':
        quotes = n;
        break;
    }
  }
  if (reposts !== undefined || quotes !== undefined) {
    metrics.shares = (reposts ?? 0) + (quotes ?? 0);
  }
  return metrics;
}

export class ThreadsAdapter implements SocialAdapter {
  readonly id = 'threads' as const;
  readonly name = 'Threads';
  readonly constraints: PlatformConstraints = PLATFORM_CONSTRAINTS.threads;

  private creds() {
    return readPlatformCreds(ID_VAR, SECRET_VAR);
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
      client_id: clientId,
      redirect_uri: ctx.redirectUri,
      response_type: 'code',
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
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: ctx.redirectUri,
        code,
      }),
    });
    if (!res.ok) {
      throw new Error(`Threads token exchange failed: ${await describeResponse(res)}`);
    }
    const short = (await res.json()) as ThreadsTokenResponse;
    const longLived = await this.exchangeLongLived(short.access_token, clientSecret);
    const me = await this.memberInfo(longLived.access_token);
    return {
      accessToken: longLived.access_token,
      refreshToken: longLived.access_token, // extended by refresh() before it lapses
      expiresInSeconds: expiresInSeconds(longLived.expires_in, LONG_LIVED_FALLBACK_SECONDS),
      // Threads' token exchange does not report the granted scope, and echoing back what
      // we ASKED for would record a guess as a fact — which is how a readiness check ends
      // up confidently green about permissions nobody ever confirmed. Left unset; the
      // readiness view reports Threads as unverifiable, which is the honest answer.
      externalId: me?.id ?? short.user_id,
      displayName: me?.name ?? (me?.username ? `@${me.username}` : 'Threads'),
    };
  }

  async refresh(refreshToken: string): Promise<SocialTokens> {
    const params = new URLSearchParams({
      grant_type: 'th_refresh_token',
      access_token: refreshToken,
    });
    const res = await fetchT(`${REFRESH_URL}?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Threads token refresh failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as ThreadsTokenResponse;
    return {
      accessToken: data.access_token,
      refreshToken: data.access_token,
      expiresInSeconds: expiresInSeconds(data.expires_in, LONG_LIVED_FALLBACK_SECONDS),
    };
  }

  /** Threads posts to the authorizing user's OWN profile — a single target. */
  async listTargets(auth: SocialAuth): Promise<SocialTargetRef[]> {
    const me = await this.memberInfo(auth.accessToken);
    const userId = me?.id ?? auth.externalId;
    if (!userId) return [];
    return [
      {
        externalTargetId: userId,
        name: me?.name ?? (me?.username ? `@${me.username}` : 'Threads'),
      },
    ];
  }

  async publish(
    auth: SocialAuth,
    target: SocialTargetRef,
    post: RenderedPost,
    idempotencyKey: string
  ): Promise<SocialPublishResult> {
    void idempotencyKey; // two-step create/publish is naturally idempotent per caller
    const token = auth.accessToken;
    const userId = target.externalTargetId;
    const plan = planThreadsPost(post);

    const creationId = await this.createContainer(token, userId, plan);
    await this.awaitContainer(token, creationId);

    const published = await this.post<ThreadsPublishResponse>(`${userId}/threads_publish`, token, {
      creation_id: creationId,
    });
    const threadId = published.id;

    // First comment (the hashtag block) as a reply — additive, never fails a live post.
    if (post.firstComment) {
      try {
        const reply = await this.post<ThreadsContainerResponse>(`${userId}/threads`, token, {
          media_type: 'TEXT',
          text: post.firstComment,
          reply_to_id: threadId,
        });
        await this.post(`${userId}/threads_publish`, token, { creation_id: reply.id });
      } catch {
        // the post is live regardless
      }
    }

    return { externalId: threadId, permalink: await this.permalink(token, threadId) };
  }

  // ── internals ──

  private async createContainer(
    token: string,
    userId: string,
    plan: ThreadsPostPlan
  ): Promise<string> {
    if (plan.kind === 'text') {
      const fields: Record<string, string> = { media_type: 'TEXT', text: plan.text };
      if (plan.link) fields.link_attachment = plan.link;
      return (await this.post<ThreadsContainerResponse>(`${userId}/threads`, token, fields)).id;
    }
    if (plan.kind === 'image') {
      return (
        await this.post<ThreadsContainerResponse>(`${userId}/threads`, token, {
          media_type: 'IMAGE',
          image_url: plan.imageUrl,
          text: plan.text,
        })
      ).id;
    }
    if (plan.kind === 'video') {
      return (
        await this.post<ThreadsContainerResponse>(`${userId}/threads`, token, {
          media_type: 'VIDEO',
          video_url: plan.videoUrl,
          text: plan.text,
        })
      ).id;
    }
    // carousel: an item container per image (no text), then a CAROUSEL parent.
    const childIds: string[] = [];
    for (const url of plan.imageUrls) {
      const child = await this.post<ThreadsContainerResponse>(`${userId}/threads`, token, {
        media_type: 'IMAGE',
        image_url: url,
        is_carousel_item: 'true',
      });
      await this.awaitContainer(token, child.id);
      childIds.push(child.id);
    }
    return (
      await this.post<ThreadsContainerResponse>(`${userId}/threads`, token, {
        media_type: 'CAROUSEL',
        text: plan.text,
        children: childIds.join(','),
      })
    ).id;
  }

  /**
   * Read a published thread's engagement for the Insights panel.
   *
   * Unlike Facebook/Instagram there is no counts-vs-insights split here: Threads serves
   * every per-post number from the one `insights` edge, which needs
   * `threads_manage_insights`. So when the review flag is off the honest answer is "no
   * numbers", returned as an empty metric set — the collect worker writes a row of nulls
   * and the panel shows dashes, rather than throwing a permission error every sweep.
   */
  async getMetrics(
    auth: SocialAuth,
    target: SocialTargetRef,
    externalId: string
  ): Promise<SocialPostMetrics> {
    void target; // one profile per connection — the user token is the only token
    if (!threadsInsightsEnabled()) return {};

    const params = new URLSearchParams({
      metric: 'views,likes,replies,reposts,quotes',
      access_token: auth.accessToken,
    });
    const res = await fetchT(`${API_BASE}/${externalId}/insights?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Threads insights failed: ${await describeResponse(res)}`);
    }
    const data = (await res.json()) as ThreadsInsightsResponse;
    return mapThreadsMetrics(data.data);
  }

  private async awaitContainer(token: string, containerId: string): Promise<void> {
    await waitForContainer(async () => {
      const params = new URLSearchParams({ fields: 'status,error_message', access_token: token });
      const res = await fetchT(`${API_BASE}/${containerId}?${params.toString()}`);
      if (!res.ok)
        throw new Error(`Threads container status failed: ${await describeResponse(res)}`);
      const data = (await res.json()) as ThreadsStatusResponse;
      const { ready, failed } = classifyMediaContainerStatus(data.status);
      return { ready, failed, detail: data.error_message ?? data.status };
    });
  }

  private async memberInfo(accessToken: string): Promise<ThreadsMe | null> {
    try {
      const params = new URLSearchParams({ fields: 'id,username,name', access_token: accessToken });
      const res = await fetchT(`${API_BASE}/me?${params.toString()}`);
      if (!res.ok) return null;
      return (await res.json()) as ThreadsMe;
    } catch {
      return null;
    }
  }

  private async exchangeLongLived(
    shortToken: string,
    clientSecret: string
  ): Promise<ThreadsTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'th_exchange_token',
      client_secret: clientSecret,
      access_token: shortToken,
    });
    const res = await fetchT(`${LONG_LIVED_URL}?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Threads long-lived token exchange failed: ${await describeResponse(res)}`);
    }
    return (await res.json()) as ThreadsTokenResponse;
  }

  private async permalink(token: string, threadId: string): Promise<string> {
    try {
      const params = new URLSearchParams({ fields: 'permalink', access_token: token });
      const res = await fetchT(`${API_BASE}/${threadId}?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as ThreadsPermalinkResponse;
        if (data.permalink) return data.permalink;
      }
    } catch {
      // fall through to the deterministic permalink
    }
    return threadsPermalink(threadId);
  }

  /** POST a form-urlencoded Threads edge (token in the body), throwing on non-2xx. */
  private async post<T>(
    path: string,
    accessToken: string,
    fields: Record<string, string>
  ): Promise<T> {
    const res = await fetchT(`${API_BASE}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({ ...fields, access_token: accessToken }),
    });
    if (!res.ok) {
      throw new Error(`Threads request failed (${path}): ${await describeResponse(res)}`);
    }
    return (await res.json()) as T;
  }
}
