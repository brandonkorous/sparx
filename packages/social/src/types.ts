// @sparx/social — the SocialAdapter contract + normalized types for social-posting
// integrations (docs/133 §4).
//
// A SocialAdapter is the publish-direction sibling of @sparx/channels' ChannelAdapter
// (which pushes product FEEDS). This one publishes native POSTS — text + media — to a
// tenant's own connected account. Same discipline as ChannelAdapter:
//   - Adapters are pure I/O against the platform API; they NEVER touch the database.
//   - The social-worker owns every DB write, and resolves + decrypts the token before
//     calling an adapter — adapters receive `SocialAuth`, never read secrets directly.
//
// Pure types + interfaces only; no Node/React imports, so this module is safe to pull
// into the composer UI (author-time constraint validation) as well as the worker.

// ── Platform identity ───────────────────────────────────────────────────────────

/** Every platform sparx can publish a post to (docs/133 §4). Matches
 *  `social_connections.platform` / `social_targets.platform`. */
export type SocialPlatform =
  | 'facebook_page'
  | 'instagram'
  | 'threads'
  | 'linkedin'
  | 'google_business'
  | 'x'
  | 'tiktok'
  | 'pinterest'
  | 'youtube';

/** The per-platform text + media rules the renderer validates a post against BEFORE
 *  scheduling — so a tenant sees "too long for X" at author time, not a publish-time
 *  failure. Centralized in `constraints.ts`; the single source of truth shared by the
 *  composer (client) and the worker's pre-publish guard (server). */
export interface PlatformConstraints {
  /** Max characters in the post body. */
  maxTextLength: number;
  /** Max attached media items in one post. */
  maxMediaCount: number;
  /** Which media kinds the platform accepts. */
  supportedMedia: readonly MediaKind[];
  /** True when the platform cannot publish a text-only post (Instagram, Pinterest,
   *  TikTok). */
  requiresMedia: boolean;
  /** Advisory aspect ratios the platform renders well (surfaced in the composer);
   *  never a hard reject. */
  aspectRatios?: readonly string[];
}

// ── Composed post + render output ───────────────────────────────────────────────

export type MediaKind = 'image' | 'video';

/** One attached asset, already resolved to a public URL (the media service resolves
 *  `mediaAssetIds` → CDN URLs before the renderer runs, so the renderer stays pure). */
export interface MediaRef {
  url: string;
  kind: MediaKind;
}

/** The tenant's platform-agnostic composed post (the source that fans out). */
export interface ComposedPost {
  body: string;
  media: MediaRef[];
  /** Canonical link (product PDP, content entry, …) — kept separate from the body so
   *  each adapter decides whether to append it inline (X) or use a link field (GBP). */
  link?: string;
}

/** A per-target override the composer stores on `social_post_targets` (docs/133 §8):
 *  adapt the text for one platform, swap the media, or pin a first comment. */
export interface TargetOverride {
  text?: string;
  media?: MediaRef[];
  /** e.g. the hashtag block posted as the first comment on IG/LinkedIn. */
  firstComment?: string;
}

/** The composed post rendered for ONE platform — text adapted, media resolved. The
 *  adapter receives exactly this and does no further shaping. */
export interface RenderedPost {
  text: string;
  mediaUrls: string[];
  link?: string;
  firstComment?: string;
}

// ── OAuth (mirrors ChannelAdapter's token exchange) ─────────────────────────────

/** OAuth-resolved credentials handed to every adapter call. The worker resolves +
 *  decrypts the access token before invoking — the adapter never reads secrets. */
export interface SocialAuth {
  /** The connected account's id on the platform. */
  externalId: string;
  accessToken: string;
  /** Extra per-platform params (org urn, location id, …); carried opaque. */
  params?: Record<string, string>;
}

export interface SocialTokens {
  accessToken: string;
  refreshToken?: string;
  /** Seconds until the access token expires. */
  expiresInSeconds: number;
  scope?: string;
  /** The account id + display the platform returns post-auth. */
  externalId?: string;
  displayName?: string;
  avatarUrl?: string;
  /** Platform-specific extras every later call needs but that aren't the token
   *  (an org urn, a location id). Persisted on the connection, surfaced back as
   *  {@link SocialAuth.params}. */
  params?: Record<string, string>;
}

export interface SocialConnectContext {
  tenantId: string;
  /** Signed state correlating the OAuth callback to this tenant/connection. */
  state: string;
  redirectUri: string;
  scopes: string[];
}

// ── Targets + results ───────────────────────────────────────────────────────────

/** A concrete post destination the grant unlocks (a Facebook Page, IG account,
 *  LinkedIn org page, GBP location). Returned by {@link SocialAdapter.listTargets};
 *  the api-rest connect flow persists these as `social_targets` rows. Named `…Ref`
 *  to distinguish the adapter-level descriptor from the DB model. */
export interface SocialTargetRef {
  /** The destination's id on the platform (Page id, GBP location id, org urn). */
  externalTargetId: string;
  name: string;
  avatarUrl?: string;
  /** Per-target params the publish call needs (carried opaque onto the row). */
  params?: Record<string, string>;
}

/** What the platform returns after a successful publish. */
export interface SocialPublishResult {
  /** The published post's id on the platform. */
  externalId: string;
  /** The public URL of the published post, when the platform returns one. */
  permalink?: string;
}

/** Optional engagement read-back — the seed of a future "how did this do?" panel. */
export interface SocialPostMetrics {
  likes?: number;
  comments?: number;
  shares?: number;
  impressions?: number;
  reach?: number;
}

// ── The adapter contract ────────────────────────────────────────────────────────

export interface SocialAdapter {
  /** Stable id — matches a SocialPlatform + `social_connections.platform`. */
  readonly id: SocialPlatform;
  /** Human label for the dashboard. */
  readonly name: string;
  /** The text/media rules the renderer validates against (docs/133 §4). */
  readonly constraints: PlatformConstraints;

  /** Whether sparx's PLATFORM OAuth app for this platform is configured (app
   *  id/secret from env). False → the platform is registered but not yet
   *  connectable; the API reports it `coming_soon`. Lets a platform light up the
   *  instant ops sets its env, with no code change (mirrors ChannelAdapter). */
  isConfigured(): boolean;

  // ── install / auth ──
  /** Build the OAuth authorize URL the dashboard redirects to. */
  connectUrl(ctx: SocialConnectContext): string;
  /** Exchange the OAuth callback code for tokens. */
  exchangeCode(code: string, ctx: SocialConnectContext): Promise<SocialTokens>;
  /** Refresh an access token nearing expiry. Optional — some platforms are
   *  long-lived or re-auth per call. */
  refresh?(refreshToken: string): Promise<SocialTokens>;

  /** After connect, list the concrete post targets the grant unlocks — a user may
   *  manage several Pages / IG accounts / org pages under one grant. */
  listTargets(auth: SocialAuth): Promise<SocialTargetRef[]>;

  /** Publish one rendered post to one target. Idempotent on `idempotencyKey`
   *  (`postId:targetId`), so a replay is a no-op on a target already posted to. */
  publish(
    auth: SocialAuth,
    target: SocialTargetRef,
    post: RenderedPost,
    idempotencyKey: string
  ): Promise<SocialPublishResult>;

  /** Optional: pull engagement for a published post. Receives the same `target` as
   *  {@link publish} (a platform like Facebook reads insights with the PAGE token that
   *  rides in `target.params`, not the user token) and the platform's own post id
   *  (`externalId` off the SocialPostTarget). Every field of the result is optional —
   *  a platform reports what its granted scopes allow, null for the rest. */
  getMetrics?(
    auth: SocialAuth,
    target: SocialTargetRef,
    externalId: string
  ): Promise<SocialPostMetrics>;
}
