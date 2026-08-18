# 133 — Social Media Posting (the `social` module)

Version: 0.2 (design)
Author: Brandon Korous
Last Updated: 2026-07-22

> Status: **design / not yet built.** This doc defines a new first-class module.
> It reuses the OAuth + encrypted-token + adapter + worker + automation scaffolding
> that already ships for sales channels ([106](106-channel-marketplace-strategy.md))
> and content scheduling, and adds the domain that does not exist today: composing,
> approving, scheduling, and publishing a **native social post** to a tenant's own
> connected accounts.

---

## 1. What this is (and is not)

**Is:** a free, cross-cutting module that lets **any** tenant — a CMS-only publisher,
a CRM-only outreach team, a full storefront, a brand with no store at all — connect
their own social accounts and publish native posts (text + media) to them, on a
schedule, by automation, or on demand. One composed post fans out to N platforms,
each rendered to that platform's rules.

**Is not (v1):** paid ad-campaign management (buying ads, budgets, audiences,
bidding, spend reconciliation). Ads are a deliberate **follow-on** — see §14. Nor is
it the product-feed / marketplace-order sync in [106](106-channel-marketplace-strategy.md);
that pushes a _catalog_ to Meta/Google/Pinterest for shopping (incl. the **Meta Shop**
catalog — see §6). This module publishes _posts_ to Facebook Pages, Instagram,
Threads, LinkedIn, Google Business Profile, X, TikTok, Pinterest, YouTube. Same
platforms, different capability, different OAuth scopes.

### Locked decisions

1. **New module `social`, gated independently, priced $0 (free).** Not folded into
   `commerce` the way channels are. Posting is a content/brand/outreach capability
   that a store-less tenant wants just as much as a merchant, so gating it behind a
   selling module would violate the "content and/or commerce, both first-class"
   principle. Free makes it a retention + brand surface; the paid lever stays with
   ads (§14).
2. **BYOK / tenant-credential only.** sparx never posts on a platform-level app
   credential. Every post goes out on the _tenant's own_ connected account via an
   OAuth grant the tenant authorized. sparx's registered platform app is only the
   OAuth client used to obtain that grant. (Consistent with the no-platform-AI /
   BYOK stance and with how channels already works.)
3. **Draft → review → approve → schedule → publish.** Auto-posting to a real brand's
   public account is high-stakes for a non-technical owner. Nothing publishes to a
   live account without an explicit approval gate by default (a tenant may opt a
   given automation into auto-approve, but that is a choice, not the default).
4. **Adapters are pure I/O; the worker owns every DB write.** Mirrors the
   `ChannelAdapter` contract in [106](106-channel-marketplace-strategy.md) §2 — the
   adapter talks to the platform API and touches no database; the `social-worker`
   resolves tokens, calls the adapter, and records results.

---

## 2. Module wiring

Add `social` to the `ModuleSlug` union and `ALL_MODULES` in
[wizeworks/packages/modules/src/index.ts](../packages/modules/src/index.ts).

- **`REQUIRES`:** none. It runs fully standalone.
- **`BUNDLED_FREE`:** none — it is not "included with" a paid module; it is simply
  free on its own. It still activates through the normal flag path
  (`tenants.settings.modules.social.enabled`) so activation stays event-driven and
  disabling it still zeroes overhead (no workers, no rows).
- **Billing:** a $0 line so activation flows through the same Stripe/module-toggle
  path as everything else — no special-case "always on" code. Activation emits
  `module.activated` (already in [wizeworks/packages/events/src/types.ts](../packages/events/src/types.ts))
  which seeds the module's defaults (see §11) and flips the gate cache.
- **Gate:** existing `requireModule(session, 'social')` / `isModuleEnabled`.

> Free ≠ auto-on. It is opt-in like every module (default-deny), just $0 to turn on.

---

## 3. Reuse vs. build

| Concern                                        | Reuse                                                                                                                                                                                                          | Build                                                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Per-platform OAuth connect + signed-state CSRF | channels OAuth helper + `connectUrl`/`exchangeCode`/`refresh` pattern ([106](106-channel-marketplace-strategy.md), `wizeworks/services/api-rest/src/lib/channels-oauth.ts`)                                    | Per-platform _posting_ scopes (a different, broader scope set than feed)                         |
| Encrypted token storage (AES-256-GCM row box)  | the same crypto util pattern channels uses (`wizeworks/packages/channels/src/crypto.ts`)                                                                                                                       | A **separate** `SocialConnection` table (§5) — a posting grant is not a sales-channel connection |
| "Post to social" as an automation step         | `ActionType` enum + `registerAction` executor seam ([wizeworks/packages/automation-schemas/src/action.ts](../packages/automation-schemas/src/action.ts), `wizeworks/packages/automation-actions/src/index.ts`) | `social.post` action type + its executor                                                         |
| Fire scheduled items on a timer                | advisory-lock tick pattern (`wizeworks/services/api-rest/src/lib/scheduled-publish.ts`, `find_due_*` SECURITY DEFINER)                                                                                         | A `find_due_social_posts()` query + the scheduled-post drain                                     |
| Compose text + media                           | CMS entry body + media asset service ([wizeworks/packages/media/src/](../packages/media/src/), `upload_image`/`set_image_from_url`)                                                                            | Nothing — reused as-is for attachments                                                           |
| Async worker on Pub/Sub                        | worker fleet; `services/channel-sync-worker` as the template                                                                                                                                                   | `services/social-worker`                                                                         |
| Events                                         | `EventType` union naming convention                                                                                                                                                                            | `social.*` literals (§10)                                                                        |

**The genuine gap (all new):** the post/campaign domain model, a publish-direction
adapter method per platform, the one-post→N-platforms renderer, the approval
lifecycle, and the compose UI. The expensive, repetitive 60% — auth, token
lifecycle, encryption, scheduling, workers, automation triggers — already exists and
is production-grade.

---

## 4. The `SocialAdapter` contract

A **sibling** to `ChannelAdapter`, not an extension of it (the channel adapter is
product/order-centric; overloading it would muddy both). It lives in a new
`@wizeworks/social` package and follows the same "pure I/O, worker owns writes, tokens
passed in" discipline.

```ts
export type SocialPlatform =
  | 'facebook_page'
  | 'instagram'
  | 'threads' // Meta text-post surface; rides the same Meta app/verification
  | 'linkedin'
  | 'google_business'
  | 'x'
  | 'tiktok'
  | 'pinterest'
  | 'youtube';

/** Per-platform media + text rules the composer validates against BEFORE scheduling,
 *  so a tenant sees "too long for X" at author time, not a publish-time failure. */
export interface PlatformConstraints {
  maxTextLength: number;
  maxMediaCount: number;
  supportedMedia: Array<'image' | 'video'>;
  requiresMedia: boolean; // e.g. Instagram cannot post text-only
  aspectRatios?: string[]; // advisory, surfaced in the composer
}

/** The composed post already rendered for THIS platform (text truncated/adapted,
 *  media resolved to public URLs). The renderer (§8) produces one per target. */
export interface RenderedPost {
  text: string;
  mediaUrls: string[]; // resolved CDN URLs from the media service
  link?: string; // canonical link (product PDP, content entry, …)
  firstComment?: string; // e.g. hashtag block posted as the first comment
}

export interface SocialPublishResult {
  externalId: string; // the post id on the platform
  permalink?: string; // public URL of the published post
}

export interface SocialAdapter {
  readonly id: SocialPlatform;
  readonly name: string;
  readonly constraints: PlatformConstraints;

  /** Whether sparx's PLATFORM OAuth app for this platform is configured (env). */
  isConfigured(): boolean;

  // install / auth — same shape as ChannelAdapter, POSTING scopes
  connectUrl(ctx: SocialConnectContext): string;
  exchangeCode(code: string, ctx: SocialConnectContext): Promise<SocialTokens>;
  refresh?(refreshToken: string): Promise<SocialTokens>;

  /** After connect, list the concrete post targets the grant unlocks — a user may
   *  manage several Facebook Pages / IG accounts / LinkedIn org pages under one
   *  grant. The tenant picks which to attach. */
  listTargets(auth: SocialAuth): Promise<SocialTarget[]>;

  /** Publish one rendered post to one target. Idempotent on `idempotencyKey`. */
  publish(
    auth: SocialAuth,
    target: SocialTarget,
    post: RenderedPost,
    idempotencyKey: string
  ): Promise<SocialPublishResult>;

  /** Optional: pull engagement (likes/comments/reach) for a published post — the
   *  read-side that later powers a "how did this do?" panel. */
  getMetrics?(auth: SocialAuth, externalId: string): Promise<SocialPostMetrics>;
}
```

`SocialAuth` / `SocialTokens` / `SocialConnectContext` mirror the channel equivalents
(`ChannelAuth` / `ChannelTokens` / `ChannelConnectContext`) — token + externalId +
opaque per-platform `params`. `isConfigured()` gives the same "light up the instant
ops sets env, no code change" property channels has, so platforms ship dark and
enable per approval.

---

## 5. Domain model

New tables in `wizeworks/packages/db/prisma/schema/` (RLS + `tenant_id` like everything else),
authored through the [db-migration](../packages/db/CLAUDE.md) pipeline.

- **`SocialConnection`** — one per (tenant, platform, external account). Holds
  `accessTokenEnc` / `refreshTokenEnc` (AES-256-GCM, keyed by a new
  `SOCIAL_TOKEN_KEY`, reusing the channels crypto util), `scope`, `expiresAt`,
  `externalId`, `displayName`, `avatarUrl`, `status` (`active` / `expired` /
  `revoked`). **Separate from `ChannelConnection`** — a Meta _feed_ connection and a
  Meta _posting_ connection are different grants with different scopes; a tenant may
  have one, both, or neither.
- **`SocialTarget`** — a concrete destination under a connection (a specific Facebook
  Page, IG business account, LinkedIn org page, GBP location). `connectionId`,
  `externalTargetId`, `name`, `platform`, `enabled`.
- **`SocialPost`** — the composed post (platform-agnostic source). `body` (text),
  `mediaAssetIds[]` (refs into the media service), `link`, `status`
  (`draft` → `pending_approval` → `scheduled` → `publishing` → `published` /
  `failed` / `partially_published`), `scheduledAt`, `approvedBy`, `source`
  (`manual` / `product` / `content` / `campaign` / `automation`), `sourceRef`
  (e.g. the product or content-entry id it was generated from).
- **`SocialPostTarget`** — the join of a post to each target it fans out to, carrying
  the **per-channel override** (`textOverride`, `mediaOverride`, `firstComment`) and
  the **per-target result** (`externalId`, `permalink`, `status`, `error`,
  `publishedAt`). A post to 4 platforms is 1 `SocialPost` + 4 `SocialPostTarget`
  rows, each succeeding or failing independently — hence the `partially_published`
  post status.

---

## 6. OAuth: the connection flow

Identical spine to channels; the delta is scopes and that the token unlocks _posting_
rather than feed management.

1. Tenant clicks **Connect** on a platform in the workbench social surface.
2. api-rest builds `connectUrl(ctx)` with a **signed state** (tenant + nonce, CSRF
   guard — the exact `assertStateMatches` pattern channels uses).
3. Platform redirects back to the shared callback; api-rest verifies state, calls
   `exchangeCode`, encrypts + stores the grant on a `SocialConnection`.
4. api-rest calls `listTargets(auth)` and lets the tenant choose which Pages / IG
   accounts / org pages to attach as `SocialTarget`s.
5. A token-refresh sweep (in the worker) rotates grants nearing `expiresAt` via
   `refresh`; a grant that cannot refresh flips `status='expired'` and surfaces a
   "reconnect" prompt (never a silent publish failure).

**Per-platform reality (this is where the real work is):** each platform is its own
OAuth app + its own permission review. Rough tiers, which drive rollout order (§13):

- **Lightest:** Google Business Profile, LinkedIn organization posts.
- **Heaviest / highest value:** Meta (Facebook Pages + Instagram + Threads) — needs
  Meta App Review + Business verification, days-to-weeks lead time, can be rejected.
  **Start this application in parallel with Phase 1 code** (§13).
- **Watch the terms:** X posting API is paid-tier (a real recurring cost — flag under
  the cost-approval rule before committing). TikTok, Pinterest, YouTube each need
  their own content-API approval.

### The Meta app: three surfaces, two modules, one verification

Everything Meta rides **one app registration + one Business Verification**, but the
use cases we request span two modules. In the Meta App Dashboard ("Add use cases"),
posting and the Shop are configured together and share verification, yet they are
owned separately in our codebase:

| Meta use case                               | Permissions unlock                                          | Owned by                                                                     |
| ------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Manage everything on your Page**          | Facebook Page posting (Pages API)                           | `social` (this doc), v1                                                      |
| **Manage messaging & content on Instagram** | Instagram publishing (contains `instagram_content_publish`) | `social` (this doc), v1                                                      |
| **Access the Threads API**                  | Threads posting                                             | `social` (this doc), v1                                                      |
| **Manage products with Catalog API**        | The **Meta Shop** catalog feed                              | `channels` — see [106](106-channel-marketplace-strategy.md), NOT this module |
| **Create & manage ads with Marketing API**  | Ad campaigns + performance                                  | `ads` — Phase 4 (§14), NOT this module                                       |

Two operational notes that shape the application:

- **Adding a use case ≠ submitting for App Review.** Checking a use case _configures_
  the app and grants **Standard Access** (dev/test roles only). **Advanced Access**
  — required to serve live tenants — is a per-permission review that demands a
  screencast **demonstrating real usage**. So an un-built use case (ads, catalog
  before the channels feed adapter is live) can be _added_ now to share verification,
  but must **not** be submitted for review until it can be demoed, or it stalls the
  Pages/IG/Threads submission it's bundled with.
- **The Meta Shop request belongs to `channels`, not `social`.** We request its
  Catalog API use case under the same Meta app for verification economy, but the
  connection, feed sync, and shop management are the channels module's concern
  ([106](106-channel-marketplace-strategy.md)) — a Meta _feed/catalog_ grant is a
  distinct OAuth scope set from a Meta _posting_ grant, so it lands on a
  `ChannelConnection`, not a `SocialConnection` (§5).

---

## 7. Publishing lifecycle

```
compose ─▶ draft ─▶ (submit) ─▶ pending_approval ─▶ (approve) ─▶ scheduled
                                                                    │
                                       scheduled tick / "post now" ─┤
                                                                    ▼
                                                               publishing
                                                                    │  fan out per target
                                        ┌───────────────┬───────────┴───────────┐
                                        ▼               ▼                       ▼
                                    published        published                failed
                                        └───────────────┴───────────────────────┘
                                                        ▼
                                     published │ partially_published │ failed
```

- The **scheduled drain** reuses the advisory-lock timer pattern from
  `wizeworks/services/api-rest/src/lib/scheduled-publish.ts`: a `find_due_social_posts()`
  SECURITY DEFINER query pulls posts whose `scheduledAt <= NOW()` and
  `status='scheduled'`, flips them to `publishing`, and publishes
  `social.post.due` for the worker to drain (keeps heavy platform I/O off the
  api-rest tick).
- The **worker** resolves each `SocialPostTarget`, fetches + decrypts the token,
  renders (§8), calls `adapter.publish(...)` with an **idempotency key**
  (`postId:targetId`), and records the per-target result. Partial failure is a
  first-class outcome, not a rollback — three platforms succeeding and one failing
  leaves the post `partially_published` with a per-target error and a retry action.
- **Retry** is per target, never re-posting the ones that already succeeded (the
  idempotency key guarantees a replay is a no-op on a platform that already has it).
- **Rate limits + backoff are per connection.** Each platform publishes its own
  posting quota; the worker holds a per-`SocialConnection` token bucket and, on a
  `429`/`5xx`, backs off with exponential delay honoring the platform's `Retry-After`
  header. A target that keeps failing exhausts a bounded retry budget, then flips to
  `failed` with a surfaced error + manual retry action (a rate-limited platform never
  silently drops a post, and never stampedes the platform into a longer ban).

---

## 8. The composer + one-post→N-platforms renderer

The composer is the heart of the UX and the one genuinely new piece of product.

- **Author once, adapt per platform.** The tenant writes a base post (text + media +
  link). The composer shows, per attached target, a live preview and validates
  against that platform's `PlatformConstraints` at author time — "24 chars over X's
  limit," "Instagram needs an image," "LinkedIn ignores hashtags in body, moving to
  first comment." No publish-time surprises.
- **Per-channel overrides** are explicit and stored on `SocialPostTarget`: tweak the
  text for X, swap the image aspect for a Story, drop LinkedIn from this one.
- **Media is auto-adapted per platform, not the tenant's problem.** On attach, the
  media worker ([wizeworks/packages/media/src/](../packages/media/src/)) derives the aspect
  variants each target needs from the source asset — feed (1:1 / 4:5), story/reel
  (9:16), landscape (16:9) — via an attention/subject-aware crop, and the composer
  shows the resulting crop per target with a draggable focal point so the tenant can
  nudge it. The tenant uploads one good image; the system produces correct-ratio
  renditions for every platform. A per-target `mediaOverride` (upload a bespoke asset
  for one channel) is the escape hatch, not the default path.
- **Post sources** (the "any tenant, across products/cms/outreach/brand" angle) —
  the composer can seed a draft from:
  - a **product** ([commerce](09-ecommerce-prd.md)) → image + title + PDP link;
  - a **content entry** ([CMS](12-cms-prd.md)) → excerpt + hero + article link;
  - a **campaign / outreach** moment ([CRM](11-crm-prd.md) / email) → coordinate a
    post alongside a send;
  - a plain **brand** post → announcement, promo, behind-the-scenes, no entity.
    Each source is a small mapper into a `SocialPost` draft; the brand post is the
    degenerate case with no `sourceRef`.

---

## 9. Automation integration

Add `'social.post'` to the `ActionType` enum in
[wizeworks/packages/automation-schemas/src/action.ts](../packages/automation-schemas/src/action.ts)
and register its executor via `installModuleActions()` in
`wizeworks/packages/automation-actions/src/index.ts`. That single seam makes "post to social" a
first-class step usable from **any** event or schedule trigger, e.g.:

- `product.published` → draft a launch post (into `pending_approval`, respecting the
  approval gate) — the automation's config decides target set + whether it
  auto-approves.
- `content.entry.published` → announce the article.
- A weekly `schedule` trigger → post from a rotating content queue.

The action config carries `{ targets[], source, template, autoApprove }`. Because the
approval gate is a real state, an automation that does _not_ auto-approve simply
parks the generated post in `pending_approval` for a human — the automation drafts,
the person ships.

---

## 10. Events

Add to the `EventType` union in
[wizeworks/packages/events/src/types.ts](../packages/events/src/types.ts) (dot-namespaced,
topic == type; provision topics + subscribers in Terraform per the file's checklist):

```
social.connection.added
social.connection.revoked
social.post.scheduled
social.post.due          # emitted by the scheduled drain; the worker consumes it
social.post.published
social.post.failed
```

`social.post.published` is the hook other modules listen on (attribution, activity
feed, a future "how did it do?" metrics pull).

---

## 11. Module defaults (seeded on activation)

Consumed off `module.activated` (like CRM/email seeds today): register the
`social.post` action executor availability, seed a couple of starter automations in
**disabled** draft (e.g. "Announce new product," "Announce new blog post") so the
value is visible immediately but nothing fires until the tenant connects an account,
picks targets, and enables it.

---

## 12. Workbench surface

A `social` surface in [sparx/apps/workbench](123-workbench.md):

- **Connections** — connect / reconnect / disconnect accounts; per-target enable.
- **Composer** — author, preview per platform, schedule or post now, save draft.
- **Calendar / queue** — scheduled + published posts on a timeline; drag to
  reschedule; per-target status badges via `statusTone()`.
- **Approvals** — the `pending_approval` inbox (surfaces automation-drafted posts).

Built on silicaui + Tailwind per [RULE #1](../CLAUDE.md); status is a
`<Badge color={statusTone(s)}>` axis; identity + lifecycle actions ride the detail
frame header per [86](86-surface-frame-pattern.md).

---

## 13. Phased build plan

- **Phase 0 — start platform app applications NOW (parallel with Phase 1).** Meta App
  Review + Business verification is the long pole; LinkedIn / TikTok content-API
  approvals likewise. Code cannot un-gate these; lead time is external.
- **Phase 1 — the spine + two easy platforms (Google Business Profile + LinkedIn).**
  `social` module wiring, `SocialConnection`/`SocialTarget`/`SocialPost`/
  `SocialPostTarget` + RLS, `@wizeworks/social` package + `SocialAdapter`, the two
  adapters, the renderer + composer, `social-worker` + scheduled drain, `social.post`
  automation action, the workbench surface. This is the ~2–3 week core; everything
  after is "one adapter + one OAuth app."
- **Phase 2 — Meta (Facebook Pages + Instagram + Threads)** once approval clears.
  Highest reach; all three share the one Meta app + verification (§6). Threads is a
  text-first surface (~500-char limit, its `PlatformConstraints` in §4).
- **Phase 3 — the long tail** as approvals land: X (flag the paid-tier cost first),
  TikTok, Pinterest, YouTube.
- **Phase 4 — paid ads** (§14), its own module.

---

## 14. Ads (deliberate follow-on — NOT this module)

Paid ads are a different beast (campaign → ad set → creative → budget → targeting →
bidding → **spend** on the tenant's ad account), a stricter API approval, and money
moving that sparx _reads_ but does not charge. The genuinely valuable, genuinely hard
part is **closing the loop** — tying ad spend back to attributed sparx orders via the
existing UTM classifier in `wizeworks/packages/attribution/`, so a tenant sees ROAS against
real revenue, not just platform-reported conversions.

Likely shape (to be its own doc): a separate **paid** `ads` module that `REQUIRES`
`commerce` (attribution + catalog make ads worth buying), reusing this module's
`SocialConnection` grants where scopes overlap (Meta's marketing API vs. its posting
API are distinct scopes on the same account). Not designed here beyond the intent to
keep organic free and ads paid.

---

## 15. Resolved decisions

These were open during design; each is now settled and reflected in the body above.

1. **Token key: a dedicated `SOCIAL_TOKEN_KEY`, reusing the channels crypto util.**
   Separate key, shared AES-256-GCM helper. Blast-radius isolation — a leaked social
   key never exposes sales-channel grants (or vice versa) — and each key rotates on
   its own schedule. The _code_ is shared; the _secret_ is not. (§5)
2. **Media: auto-generate per-platform aspect variants; don't make the tenant do it.**
   The media worker derives feed/story/landscape renditions from the source asset via
   an attention-aware crop, and the composer exposes a draggable focal point per
   target. One upload → correct renditions everywhere; a per-target `mediaOverride` is
   the escape hatch. (Chosen over the "validate + warn only" MVP — it's the
   production-complete behavior a non-technical owner expects.) (§8)
3. **Approval: require-approval is the tenant default, per-automation opt-out, always
   per-post overridable, and approving is a staff permission.** Nothing reaches a live
   account unreviewed unless a human deliberately turned that off for a specific
   automation. The `approve` capability is a role/permission on the staff auth layer,
   so "who may publish to the brand's accounts" is itself controlled. (§7, §9)
4. **Rate limits: per-connection token bucket + exponential backoff honoring
   `Retry-After`.** Bounded per-target retry budget, then `failed` + manual retry — no
   silent drops, no stampede into a longer platform ban. (§7)
5. **Doc number: this doc is `133`** (`docs/133-social-media-posting.md`). It was
   drafted as a second `120` (colliding with `120-email-builder-silica-adoption.md`,
   which is referenced from [125](125-site-data-architecture-critical-issues.md) and
   keeps its number); `130`–`132` were already taken, so it landed at the next free
   slot. The collision is resolved.
