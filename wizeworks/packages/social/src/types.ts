// @wizeworks/social — the SocialAdapter contract + normalized types for social-posting
// integrations (docs/133 §4).
//
// A SocialAdapter is the publish-direction sibling of @wizeworks/channels' ChannelAdapter
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
  /** The attachments WITH their kind — the authoritative source for "is this an image
   *  or a video", and what every adapter must branch on.
   *
   *  `mediaUrls` below is the same list flattened to bare URLs, kept for callers that
   *  genuinely do not care about kind. Deciding kind from a URL is NOT sound: it was
   *  done by sniffing the file extension, and a stock/CDN URL has none
   *  (`images.unsplash.com/photo-1588850561407-…`), so an image was read as "not an
   *  image" — dropped entirely on Facebook, and mistaken for a VIDEO on
   *  Instagram/Threads/TikTok/YouTube, whose video branch is `!isImageUrl(u)`. */
  media: MediaRef[];
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

/** What a platform itself reports about a live grant — the only honest answer to
 *  "has our App Review landed yet?", because none of these platforms expose review
 *  status as an API. We infer it from what a real token can actually do.
 *
 *  Returned by the optional {@link SocialAdapter.probeAccess}; adapters whose token
 *  response already carries the granted scope set can omit it entirely. */
export interface SocialAccessProbe {
  /** The scopes the platform says this grant holds RIGHT NOW. More truthful than the
   *  set stored at connect time — a person can revoke one permission from their
   *  account settings without disconnecting. Null when the platform offers no
   *  introspection endpoint. */
  grantedScopes: string[] | null;
  /** Whether sparx's own app has cleared this platform's review.
   *  - `passed` — the API did something only an approved app can do.
   *  - `pending` — the API refused in the specific way an unapproved app is refused.
   *  - `unknown` — the call succeeded but proves nothing either way (see `caveat`).
   *
   *  Deliberately three-valued: "I cannot tell" is a real answer here and reporting
   *  it as `passed` is how a false green ends up in front of a tenant. */
  appReview: 'passed' | 'pending' | 'unknown';
  /** One plain sentence explaining the verdict, written for someone who has never
   *  heard the phrase "Advanced Access". */
  detail: string;
  /** Set when something about THIS account makes the result unrepresentative — most
   *  often that the connected account holds a role on sparx's own developer app, which
   *  grants it permissions no ordinary tenant would get. */
  caveat?: string;
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

/** What composed a post — the hand, or the thing it was generated from.
 *
 *  Lives here rather than inline at a route because it is written to a
 *  `varchar(20)` column, and there is more than one way in (the REST route and the
 *  MCP tool). It was declared inline in the REST route only, and the MCP copy drifted
 *  to a free `z.string().max(63)` — which let a caller send a 21-to-63-character
 *  value straight past validation into a Postgres length error surfaced raw as
 *  "The provided value for the column is too long". One list, both callers. */
export const SOCIAL_POST_SOURCES = [
  'manual',
  'product',
  'content',
  'campaign',
  'automation',
] as const;

export type SocialPostSource = (typeof SOCIAL_POST_SOURCES)[number];

// ── The inbound direction (the engagement inbox) ────────────────────────────────

/** What kind of inbound thing a person sent. A Google Business review and a Facebook
 *  comment are different enough to filter on and similar enough to answer in one place. */
export type SocialInboxKind = 'comment' | 'mention' | 'review' | 'message';

/** One inbound item as the PLATFORM describes it. The worker maps this onto a
 *  `social_inbox_items` row; the adapter stays pure I/O and does no DB work. */
export interface SocialInboxEntry {
  /** The item's own id on the platform — the idempotency anchor for the sync. */
  externalId: string;
  kind: SocialInboxKind;
  /** The conversation this belongs to (a post's comment thread, a DM thread). */
  threadExternalId?: string;
  /** The comment this replies to, when the platform threads replies. */
  parentExternalId?: string;
  /** The platform's id for the post it is a comment on, so the inbox can join an item
   *  back to the sparx post that provoked it. */
  postExternalId?: string;
  authorName?: string;
  authorHandle?: string;
  authorAvatarUrl?: string;
  text?: string;
  /** 1–5 for a review; absent otherwise. */
  rating?: number;
  permalink?: string;
  /** When the person sent it. */
  receivedAt: Date;
  /** True when WE sent it (a reply already on the platform — e.g. one made in the
   *  platform's own app). Keeps a thread honest rather than showing only our half. */
  outbound?: boolean;
}

/** What a reply produced on the platform. */
export interface SocialReplyResult {
  externalId: string;
  permalink?: string;
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

  /** The OAuth scopes this adapter asks for RIGHT NOW, as individual scope strings.
   *  Diffed against what a connection was actually granted to answer the two questions
   *  a tenant cares about: "can this account do everything sparx needs?" and "did the
   *  platform quietly withhold something?". Reflects the same env gates as
   *  {@link connectUrl} — an adapter whose inbox flag is off must not claim to need
   *  inbox scopes, or every healthy connection reads as broken. */
  requiredScopes(): string[];

  // ── install / auth ──
  /** Build the OAuth authorize URL the dashboard redirects to. */
  connectUrl(ctx: SocialConnectContext): string;
  /** Exchange the OAuth callback code for tokens. */
  exchangeCode(code: string, ctx: SocialConnectContext): Promise<SocialTokens>;
  /** Refresh an access token nearing expiry. Optional — some platforms are
   *  long-lived or re-auth per call. */
  refresh?(refreshToken: string): Promise<SocialTokens>;

  /** Optional: ask the platform what this grant can actually do. Implemented where the
   *  platform offers token introspection (Meta) or reveals an app-level review gate
   *  through a normal call (TikTok's allowed privacy levels). Adapters that return the
   *  granted scope set in their token exchange need no probe — the stored set is
   *  already the answer. Must never throw: an unreachable platform is `unknown`, not
   *  a failure. */
  probeAccess?(auth: SocialAuth): Promise<SocialAccessProbe>;

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

  // ── the inbound direction (docs/social-audit — the "Engage" layer) ──
  //
  // Both are OPTIONAL and both are gated behind {@link supportsInbox}, because
  // inbound needs a wider permission set than posting and lands platform by platform
  // as each review clears. An adapter that cannot read a comment simply omits them,
  // and the inbox says so plainly rather than showing an empty tab that looks broken.

  /** Whether this adapter's app currently has the permissions to read + answer
   *  inbound activity. Separate from {@link isConfigured} on purpose: the same OAuth
   *  app can be cleared to POST long before it is cleared to READ COMMENTS. */
  supportsInbox?(): boolean;

  /** Pull inbound activity for one destination. `since` is the last successful sync,
   *  so a poll asks only for what is new; on the first pass it is undefined and the
   *  adapter returns a sensible recent window (its own choice — a Page with ten years
   *  of comments must not backfill all of them). */
  listInbox?(auth: SocialAuth, target: SocialTargetRef, since?: Date): Promise<SocialInboxEntry[]>;

  /** Answer one inbound item. `parentExternalId` is the thing being replied to (a
   *  comment id, a review id, a conversation id). */
  replyToInbox?(
    auth: SocialAuth,
    target: SocialTargetRef,
    parentExternalId: string,
    text: string
  ): Promise<SocialReplyResult>;
}
