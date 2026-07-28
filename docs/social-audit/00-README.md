# Social audit — the `social` module, scored from the owner's chair

Version: 2.1.0
Author: Brandon Korous
Last Updated: 2026-07-28

> **STATUS — the roadmap has been built.** Everything in [01-roadmap.md](01-roadmap.md) that is
> ours to build has landed; what remains is the three external platform reviews and the deploy.
> The scorecard below is now the BEFORE picture, kept because it is the argument for what was
> built. Each row carries what changed. Read [§9](#9-what-shipped) for the after picture and the
> hand-offs.

> **Scope: the `social` module ONLY.** The subject is the whole vertical — the
> [`@sparx/social`](../../packages/social/) package (contract, registry, renderer, adapters), the
> api-rest [social routes](../../services/api-rest/src/routes/v1/social/), the
> [`social-worker`](../../services/social-worker/) publish + metrics drains, the
> [workbench social surfaces](../../apps/workbench/surfaces/social/), the `social.post` automation
> action, and the MCP tool surface. The `channels` module (product-feed / marketplace sync) is a
> different capability on adjacent plumbing and is **out of scope**. So is the future `ads` module
> ([133 §14](../133-social-media-posting.md)).

> **Standing goal this is scored against:** _a social tool a non-technical business owner runs
> their entire social presence from._ Stated in
> [implementation/social.md §1](../implementation/social.md). The comparison set is Buffer, Later,
> Hootsuite, Sprout Social and Metricool — not a low bar, and three of them are engagement-inbox
> products, not schedulers.

**Companion docs**

- [01-roadmap.md](01-roadmap.md) — the impact-ordered slices to close the gap, tagged and sized.

**Source of truth for state**

- [implementation/social.md](../implementation/social.md) — the living status + decision log. Where
  this audit and that tracker disagree on _what is built_, the tracker wins; this doc's job is to
  say what it is **worth to a user**, which the tracker deliberately does not.

---

## 1. Method, and what it can and cannot tell you

Read-only source trace across the package, both API route files, the worker, all six workbench
surfaces, the automation action, the event catalog and the prod Terraform. Every finding names the
file that produces it.

**Nothing here is browser-verified and nothing here is platform-verified.** No dev server was
running and no live post was sent. Claims about what a _platform_ does (Cloudflare's `206`, Meta
token lifetimes, which scopes gate reach) are carried forward from the tracker's own live-debugging
record, not re-established. Where a claim depends on runtime behaviour it is marked **unverified**
with the check that would settle it.

## 2. What the module is now

Roughly 13,600 lines across five layers, and the architecture is not the problem. The layering is
clean and the discipline held:

| Layer                                                                 | Owner                  | Where                                                                                                                                          |
| --------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Adapter contract, registry, renderer, constraints, crypto, catalog    | `@sparx/social` — pure | [packages/social/src/](../../packages/social/src/)                                                                                             |
| 8 platform adapters (pure I/O, no DB)                                 | `@sparx/social`        | [adapters/](../../packages/social/src/adapters/)                                                                                               |
| Post + connection services (one service, many transports)             | `@sparx/social`        | [posts.ts](../../packages/social/src/posts.ts), [connections.ts](../../packages/social/src/connections.ts)                                     |
| Connect / compose / lifecycle / metrics HTTP, scheduled drain         | api-rest               | [routes/v1/social/](../../services/api-rest/src/routes/v1/social/), [social-scheduled.ts](../../services/api-rest/src/lib/social-scheduled.ts) |
| Token resolve → render → publish → per-target result; metrics collect | `social-worker`        | [services/social-worker/src/](../../services/social-worker/src/)                                                                               |
| Calendar · Posts · Composer · Approvals · Insights · Connections      | workbench              | [surfaces/social/](../../apps/workbench/surfaces/social/)                                                                                      |
| `social.post` as a first-class automation step + 2 seeded automations | automation-actions     | [automation-actions/src/social.ts](../../packages/automation-actions/src/social.ts)                                                            |

Adapters never touch the database; the worker owns every write; api-rest only flips state and emits
an event. Partial failure is a real state (`partially_published`) rather than a rollback. Targets
denormalize `targetName` + `platform` onto the post row so publish history survives a disconnect.
All of that is right.

**The shape of the problem is not architecture. It is that the module is excellent at the minute
you are writing a post and weak at every minute after it leaves.**

## 3. Scorecard

Most broken first. "Gap to 10" is what the score is missing, not a wish list.

| #   | Dimension                          | Score | Gap to 10                                                                                                                                               |
| --- | ---------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Engagement (comments / DMs)**    | **0** | Not started. The adapter contract is publish-only. Three of five competitors are _primarily_ this. Meta scope applications not yet filed.               |
| 2   | **Connection health**              | **2** | Nothing in the tree ever sets `status='expired'`. The reconnect UI is unreachable. A dead grant surfaces only as a failed post, days later.             |
| 3   | **Failure visibility**             | **2** | `social.post.failed` has no subscriber. No email, no in-app signal, no nav count. A failed 6am post is invisible until someone opens the list.          |
| 4   | **Multi-site scoping**             | **3** | Connect binds a grant to a site; every read ignores it. Two businesses under one tenant see each other's accounts, unlabelled. Posts carry no site.     |
| 5   | **Content leverage**               | **3** | No seed-from-product/article, no duplicate, no repost, no evergreen recycling, no hashtag sets, no bulk import. Every post is typed from nothing.       |
| 6   | **Measurement (post-level)**       | **4** | Built, not deployed, and collects only on publish + manual per-post refresh. No sweep, so numbers freeze minutes after a post goes out.                 |
| 7   | **Retry & recovery**               | **4** | The server retries correctly. The UI hides the retry button on `partially_published` — the one state that needs it most.                                |
| 8   | **Post editability after save**    | **4** | Destinations, per-destination overrides and first comments are settable only at creation. An approver cannot fix where an automation-drafted post goes. |
| 9   | **Media reliability**              | **5** | Facebook + LinkedIn upload bytes and work. Instagram / Threads / Pinterest publish by public URL and will hit the same Cloudflare `206` that broke FB.  |
| 10  | **Platform coverage**              | **6** | 8 adapters; GBP + LinkedIn + the Meta three live. Pinterest / TikTok / YouTube await OAuth apps. X deliberately absent (paid tier).                     |
| 11  | **Approval workflow**              | **7** | Correct states, real role gate, good confirms. No ambient "3 waiting" signal, no per-automation auto-approve opt-out, no reviewer note on a rejection.  |
| 12  | **Publishing pipeline**            | **8** | Idempotency key, per-target results, transient-vs-permanent error split, bounded attempts, refresh-on-publish. No per-connection rate-limit bucket.     |
| 13  | **Planning (calendar + list)**     | **8** | Month grid, drag-to-reschedule with optimistic rollback, unscheduled tray, pipeline strip, search. No week/agenda view, no per-destination time.        |
| 14  | **Automation integration**         | **8** | `social.post` action, `announce.*` resolvers, two seeded starters, drafts into the approval gate. Config has no UI for picking targets per automation.  |
| 15  | **Agent / MCP parity**             | **8** | Full compose + lifecycle + `list_social_connections` discovery. Connect stays out by design. Ships with the next api-mcp deploy.                        |
| 16  | **Compose + per-platform preview** | **9** | The best thing in the module and a genuine differentiator. Missing only per-target focal nudge and per-target media override.                           |

**Overall: 6.5.** Weighted the way an owner experiences it: publishing and planning are an 8–9, and
everything that happens after the post leaves is a 4.

## 4. The four highest-impact gaps

### GAP 1 — A dead account is silent, and the UI that would say so is unreachable

The most load-bearing promise an auto-poster makes — _it went out_ — has no failure channel, and
the failure that matters most (an expired grant) is invisible by construction.

**The chain, and where it snaps:**

1. [connections.tsx:199](../../apps/workbench/surfaces/social/connections.tsx#L199) renders a full
   "This account needs reconnecting" alert, gated on `connection.status === 'expired'`. ✅
2. `connectionStatusMeta` in [data.ts:670](../../apps/workbench/surfaces/social/data.ts#L670) maps
   `expired → { label: 'Reconnect needed', tone: 'warning' }`. ✅
3. **Nothing in the tree ever writes `status = 'expired'` on a `SocialConnection`, and nothing ever
   writes its `lastError`.** A repo-wide grep finds the string only in the scheduling-calendar sync,
   a different module. ❌
4. Refresh is lazy: [auth.ts:47](../../services/social-worker/src/auth.ts#L47) refreshes only at
   publish time, only within a 60-second `REFRESH_SKEW_MS`, and if `adapter.refresh` throws, the
   exception fails the _target_ — the connection row is untouched. ❌
5. There is **no proactive sweep**. No cron, no due-scan, nothing that walks connections nearing
   `tokenExpiresAt`. A post scheduled three weeks out against a grant that dies in two weeks fails
   at send time with no prior warning. ❌

[133 §6.5](../133-social-media-posting.md) specified exactly this and specified it would "never [be]
a silent publish failure."

**Fixed looks like:** a periodic refresh sweep in the worker; a failed refresh (or a `401`/`403` on
publish) flips `status='expired'` and stores `lastError`; that lights up the alert that already
exists, plus an email. Completes: _the owner learns their account needs reconnecting **before** a
post is lost, not after._

### GAP 2 — A failed post tells nobody

Separate from GAP 1 and worse, because it covers every failure mode, not just token death.

1. The worker publishes `social.post.failed` and `social.post.published` at
   [publish.ts:271](../../services/social-worker/src/publish.ts#L271). ✅
2. Both topics are declared in [terraform/envs/prod/main.tf:243](../../terraform/envs/prod/main.tf#L243)
   as `= []` — **topic-only, no subscriber**. Nothing anywhere consumes either. ❌
3. There is no email, no `email.send`, no in-app alert on the failure path — a grep of
   [social-worker/src/](../../services/social-worker/src/) for `notify` / `email.send` returns
   nothing. ❌
4. The workbench has **no nav badge primitive at all** — `SurfaceDefinition` in
   [surfaces/registry.ts](../../apps/workbench/lib/surfaces/registry.ts) carries no count or badge
   field — so neither a failure nor a pending approval can raise an ambient signal. ❌
5. The only discovery path is opening [Posts](../../apps/workbench/surfaces/social/queue.tsx) and
   noticing a red badge in a list. The polling in
   [data.ts:292](../../apps/workbench/surfaces/social/data.ts#L292) is well built but only runs while
   someone is already looking.

**Fixed looks like:** a subscriber on `social.post.failed` (and on partial success) that sends the
owner an email naming the post, the destination and the plain-language reason with a deep link;
plus a count badge on Posts and Approvals. Completes: _a scheduled post that does not go out is
something you are told, not something you discover._

### GAP 3 — The one state that needs retry is the one state that hides it

A post reaching three of four destinations is the most common real failure, and it is a dead end in
the UI.

- `isEditablePost` at [data.ts:762](../../apps/workbench/surfaces/social/data.ts#L762) returns true
  for `draft` / `pending_approval` / `scheduled` / `failed` — and **not** `partially_published`.
- [composer.tsx:1245](../../apps/workbench/surfaces/social/composer.tsx#L1245) gates the entire
  "Send" section (submit, schedule, **and the "Publish now / Try publishing again" button**) on
  `editable && canWrite`.
- So a `partially_published` post shows its per-target errors and offers **no action on them**.
- The server is already correct: `markPostPublishing` at
  [posts.ts:257](../../packages/social/src/posts.ts#L257) re-arms `pending` **and** `failed` targets,
  leaves succeeded ones alone, and the `postId:targetId` idempotency key makes a replay a no-op on a
  platform that already has the post. The capability exists and is unreachable.

**Fixed looks like:** a retry affordance on `partially_published`, ideally per-target ("Try Instagram
again") rather than a whole-post button. Completes: _one destination failed → click it → it goes._

### GAP 4 — Everything about a post except the words is frozen at creation

The composer's own header comment names this as a deliberate consequence of the server shape, but it
is the single biggest day-two friction in the module.

- `UpdateBody` in [routes/v1/social/posts.ts:70](../../services/api-rest/src/routes/v1/social/posts.ts#L70)
  accepts `body`, `link`, `mediaAssetIds` — and nothing else. There is no route that mutates
  `SocialPostTarget`.
- So on a saved draft you cannot add a destination, remove one, change a per-destination text
  override, or change a first comment. The composer reflects this honestly
  ([composer.tsx:12](../../apps/workbench/surfaces/social/composer.tsx#L12)) but honesty is not the
  fix.
- **It hurts most in Approvals.** An automation drafts a post into the inbox
  ([automation-actions/src/social.ts](../../packages/automation-actions/src/social.ts)); the admin
  can approve it or send it back, but cannot correct where it goes. "Nearly right, wrong account" has
  no path but reject → find the author → have them rebuild it.
- The Instagram-shaped cost: the first comment (the hashtag block) is the field most likely to want a
  second pass, and it is the one field that can never be edited.

**Fixed looks like:** `PATCH /v1/social/posts/:id/targets` (add / remove / override / first comment,
rejected once the post is past `scheduled`), surfaced in the composer's saved state and inline on the
Approvals card. Completes: _a draft is a draft until it sends._

## 5. Second-tier findings

- **Multi-site is half-wired.** [routes/v1/social/index.ts:156](../../services/api-rest/src/routes/v1/social/index.ts#L156)
  resolves `propertyId` and binds it into the signed OAuth state, and
  `upsertSocialConnection` stores it — but `listSocialConnections` at
  [connections.ts:41](../../packages/social/src/connections.ts#L41) filters by tenant only, the
  composer never sends `propertyId` on create, and `GET /v1/social/posts` has no property filter. A
  tenant running two businesses sees both sets of accounts in one unlabelled list and can post to the
  wrong brand without any signal. Against the "site IS the business" rule this is the most
  structurally wrong thing in the module.
- **Insights is built and effectively inert.** Collection fires on publish and on a manual per-post
  "Refresh numbers"; the periodic sweep is documented as deliberately deferred
  ([implementation/social.md §4](../implementation/social.md)). Social numbers climb for days, so the
  stored snapshot is stale within the hour. Reach and views are additionally `null` pending a Meta
  review **that has not been filed**. The surface is good; the data behind it is thin.
- **Image publishing is only proven on two platforms.** Facebook and LinkedIn upload bytes.
  Instagram, Threads and Pinterest publish by public `image_url` and will hit the same Cloudflare
  `206`-on-range that produced the Facebook `(#324)` — diagnosed, documented, unfixed
  ([implementation/social.md, 2026-07-25](../implementation/social.md)). **Unverified**; settled by
  posting one image to a connected IG account.
- **Rate limiting is not per-connection.** [133 §7](../133-social-media-posting.md) specified a
  per-`SocialConnection` token bucket honouring `Retry-After`. What ships is a per-target attempt
  cap (`MAX_ATTEMPTS = 5` in [publish.ts:32](../../services/social-worker/src/publish.ts#L32)) plus a
  transient/permanent split. Adequate at one post at a time; a fan-out burst across many targets on
  one grant can still stampede a platform.
- **The composer's focal point is read-only.** [133 §15.2](../133-social-media-posting.md) promised a
  draggable focal point per target. What ships reads `focalX`/`focalY` off the media asset and
  quantizes to nine buckets ([post-preview.tsx:59](../../apps/workbench/surfaces/social/post-preview.tsx#L59)).
  The focal point is editable in the media library, just not from the composer, and never per-target.
  There is also no per-target `mediaOverride`, which the data model supports.
- **No per-automation auto-approve.** [133 §9](../133-social-media-posting.md) specified
  `autoApprove` in the action config; the setting that ships is a single tenant-wide
  `requireApproval` switch. An automation cannot be trusted independently of the whole module.
- **Approvals is the only surface that is not pictures-first.**
  [approvals.tsx:133](../../apps/workbench/surfaces/social/approvals.tsx#L133) shows a text excerpt
  and destination name badges — no `PostThumb`, no `DestinationAvatars` — while every other list
  leads with the image. You approve a picture post without seeing the picture.
- **Stale header comment.** [queue.tsx:6](../../apps/workbench/surfaces/social/queue.tsx#L6) still
  describes "a switch in the toolbar hops between them"; the Calendar⇄List segmented control was
  deliberately removed ([implementation/social.md, 2026-07-24](../implementation/social.md)).

## 6. What is genuinely excellent, and should not be touched

Worth naming, because the roadmap is long and none of it should erode these.

- **[post-preview.tsx](../../apps/workbench/surfaces/social/post-preview.tsx) is the differentiator.**
  The real image cropped to the platform's actual aspect, the caption **struck through in the error
  tone at the exact character the platform will cut**, `requiresMedia` rendered as a dashed red frame
  in the right shape, and a per-platform link treatment (`cta` / `card` / `inline` / `destination`)
  that mirrors what the adapters actually do — so the preview never promises something the publish
  path will not deliver. Competitors describe limits; this shows them.
- **The voice.** "24 characters over the 280-character limit — it will be cut short here."
  "This platform needs a picture or video — add one, or leave it off this post." "Anything already
  posted to your accounts stays live there." Non-technical throughout, with no leaked "OAuth scope"
  or "target."
- **Honest state.** Nullable metrics render `—`, never a fabricated `0`
  ([data.ts:226](../../apps/workbench/surfaces/social/data.ts#L226)). Publishing polls only while
  publishing and stops the moment it settles. Role gates mirror the server's ranked bar so a control
  never appears for something the server will refuse.
- **Correct partial-failure semantics** end to end, from the DB shape through the worker to the
  per-target rows in the UI.

## 7. Deployment state (blocks the score, not the code)

Per [implementation/social.md §5](../implementation/social.md), two whole verticals are code-complete
and not live: **UTM attribution** (needs `pnpm install` to link `@sparx/attribution` into
`social-worker`) and **all of Measure** (needs the `SocialPostMetric` migration + client regen, the
`social.metrics.collect` topic + subscription via `terraform apply`, and a deploy of both services).
The same Terraform apply carries `MEDIA_PUBLIC_BASE_URL` on the social-worker — **without it every
post publishes text-only, image silently dropped.**

Nothing in the roadmap should be started before that apply lands; three of the scorecard rows move
on deploy alone.

---

## 9. What shipped

Built 2026-07-28, in one pass across the package, the API, the worker and the operator app.
Typecheck, lint and tests green in `@sparx/social`, `social-worker`, `api-rest`, `@sparx/email` and
`workbench`; 160 tests in `@sparx/social`, of which the cadence, rate-limiter, CSV-parser and
hashtag-normalizer suites are new.

### The four highest-impact gaps

| Gap                              | What closed it                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — silent dead connections**  | A health sweep ([social-sweeps.ts](../../services/api-rest/src/lib/social-sweeps.ts) → [health.ts](../../services/social-worker/src/health.ts)) that renews a grant a WEEK before expiry and proves it still works with a live probe — the only way to catch a revoked one. Any failure flips `status='expired'` + `lastError`, which lights the reconnect alert that was previously unreachable. A `401`/`403` on publish does the same. |
| **2 — failures told nobody**     | Two emails ([social-post-failed](../../packages/email/src/templates/social-post-failed.tsx), [social-connection-expired](../../packages/email/src/templates/social-connection-expired.tsx)) published as `email.send` from the worker, covering total AND partial failure. Plus a nav-badge primitive (`SurfaceDefinition.useBadgeCount`) the whole workbench now has, wired to Approvals and the new Inbox.                              |
| **3 — retry unreachable**        | `POST /posts/:id/targets/:targetId/retry` + a per-destination "Try X again" on the results list, shown on `partially_published`. One destination retries; its siblings, including the ones already live, are untouched.                                                                                                                                                                                                                   |
| **4 — targets frozen at create** | `PATCH /posts/:id/targets` (add / remove / retune / per-destination time). The composer's destination picker is now one component serving both the new and saved states, and Approvals gained "Change it first".                                                                                                                                                                                                                          |

### Everything else in the roadmap

- **Site scoping** — `listSocialConnections` and `listSocialPosts` take a `propertyId`; every read
  resolves the site header; created posts are stamped with it.
- **Engagement inbox** — new `social_inbox_items` model, an inbound adapter contract
  (`supportsInbox` / `listInbox` / `replyToInbox`), implementations for **Facebook** comments +
  reviews, **Instagram** comments and **Google Business reviews**, a two-phase reply that cannot
  double-post, sync + reply sweeps, and a two-pane [Inbox surface](../../apps/workbench/surfaces/social/inbox.tsx).
  Google Business works on day one (`business.manage` already covers reviews); Meta is gated behind
  `META_INBOX_ENABLED`, which also widens the OAuth scope so a tenant never carries a token missing
  what the inbox needs.
- **Metrics sweep** — `find_due_social_metric_targets` with a cadence that decays with post age
  (hourly < 1d, 6-hourly < 7d, daily < 30d). Insights is no longer frozen minutes after publish.
- **Cadence + evergreen** — `social_posting_slots`, a DST-correct
  [cadence module](../../packages/social/src/cadence.ts), a slot filler that only touches slots
  someone marked, never overwrites a real post, and still respects the approval gate. The calendar
  draws unfilled slots as gaps.
- **Per-destination scheduling** — `social_post_targets.scheduled_at` + its own drain, so one post
  can land at the right local hour on each platform.
- **Content leverage** — "Share this" from a product (seeded composer), duplicate/post-again,
  evergreen marking, saved hashtag sets in the first-comment field, best-time-to-post from the
  tenant's OWN history (and an honest "not enough history yet"), and CSV import with a
  preview-then-import flow that reports what is wrong with line 14 before creating anything.
- **Rate limiting** — a per-connection token bucket honouring `Retry-After`, applied to the whole
  grant, with a bounded inline wait so a long back-off defers rather than blowing the ack deadline.
- **Housekeeping** — reviewer notes on send-back (shown to the author), a link-tracking opt-out,
  the calendar's week view, and the stale Posts header comment.

### Gaps the roadmap missed, found on review and closed

The roadmap was written from the audit, and the audit did not look hard enough at three things:

- **MCP parity had silently regressed.** Every capability added above — retargeting, per-destination
  retry, duplicate, evergreen, the inbox, hashtag sets, posting slots, best-time, CSV import,
  seed-from-entity — existed only in the operator app. An agent that can post but cannot fix a post
  that half-failed is a keyhole, and "API-first, the dashboard is one consumer among many" is a
  house rule. The MCP surface went from 11 tools to **28**, and `reject_social_post` now takes the
  reviewer's note.
- **An automation could only post to EVERY connected account.** `social.post` has always accepted
  `targetIds`; nothing could set them, because the automations config form had no field type for a
  choice whose values only exist at runtime. Added `multiselect` + an `optionSource` seam (the first
  source is `social-targets`), so an automation can now be narrowed to specific accounts. An empty
  selection still means "all" — narrowing is the deliberate act.
- **LinkedIn was written off as "limited/paid" for the inbox without checking.** Its
  `socialActions` comments API is the same shape the adapter already uses to post a first comment.
  LinkedIn now reads and answers comments on its company-page posts, behind
  `LINKEDIN_INBOX_ENABLED` (which also widens the connect scope with `r_organization_social`).
- **Metrics stored a history and showed only the latest.** The performance panel now shows the
  change since the first reading — "340 likes, +60" — because a number with no direction is a
  report, not a scoreboard.

### Corrections to this audit

Two scorecard rows were wrong when written:

- **Media reliability (scored 5)** was already fixed in the working tree via `MEDIA_DIRECT_BASE_URL`
  — a DNS-only origin host that bypasses Cloudflare's `206`, wired end to end through
  `needsDirectHost`/`swapMediaHost`, `cloudflare.tf` and `serverless.tf`. The audit read the
  tracker, which still said "STILL OPEN". Verified in code, still unverified live.
- **Per-automation auto-approve** was listed as missing. It ships: `autoApprove` is in the
  `social.post` config schema AND has a select in the automations catalog. Only a per-automation
  destination picker is absent, and "every enabled destination" is a defensible default.

### Hand-offs — what is NOT done

1. **Deploy.** The schema migration `20270122000000_social_health_inbox_cadence` is applied to the
   local docker DB and the client is regenerated; prod applies it on push via the DB-migrate
   pipeline. **Terraform is applied** (2026-07-28) — the four topics, the three new social-worker
   subscriptions and `WORKBENCH_BASE_URL` are live and verified in `sparxworks`; the apply was
   targeted so Cloudflare never entered the graph. What remains is a deploy of `api-rest` +
   `social-worker`, without which nothing publishes to or consumes those topics.
2. **The platform applications.** Verified in Meta's App Dashboard on 2026-07-28, app
   `1674943623584234`:
   - **The app is UNPUBLISHED** — still in Development mode. This is the headline: a development-mode
     app works ONLY for accounts holding a role on it. No tenant can connect a Facebook Page or
     Instagram account at all today, review or no review. The Publish page reports "All required app
     settings are complete", so nothing is blocking it but the decision.
   - **No permission has been submitted for App Review.** Every one across Instagram, Pages, Threads,
     Marketing and Catalog reads **"Ready for testing"** — Meta's label for Standard Access — and the
     per-permission Actions menu still offers "Add to App Review". `instagram_basic` (49 calls),
     `instagram_content_publish` (45) and `business_management` (31) have real traffic, which is
     Brandon's own admin account exercising Standard Access, not evidence of approval.
   - **Threads has 0 API calls** on both `threads_basic` and `threads_content_publish` — that
     connection has never once succeeded, even for a role-holder.

   **Progress the same day.** WizeWorks is now a Meta **Tech Provider** — an irreversible account
   classification that gates the entire App Review path and brings stricter data-access
   requirements. Enabling it auto-staged 13 permissions into the review request; 5 more were added
   by hand (`pages_read_user_content`, `pages_manage_engagement`, `instagram_manage_comments`,
   `instagram_manage_insights`, `read_insights`), and the written **"how this app uses it"
   description is complete for all 13 permissions sparx actually needs**. The submission remains
   **Not submitted**.

   **Second pass, same day — the submission is now 3 of 5 steps green.** Verification, App settings
   and **Data handling** all read complete (Data handling was answered after the note above was
   written). What changed in this pass:
   - **The submission is down to 15 permissions**, and it now matches the code exactly. Removed
     `ads_management`, `ads_read` and `Marketing API Access Tier` — nothing in the repo calls them
     (verified by grepping the adapter scope constants, not by recall). Removal is reversible from
     the use case's Customize page.
   - **Every one of the 15 has its description AND its compliance attestation done.**
     `public_profile` is fully complete. `catalog_management`'s description was written from
     scratch this pass.
   - **Reviewer instructions** were empty and are now written — what sparx is, the
     `app.sparx.works` entry point (NOT `sparx.works`, which is the marketing site the Site URL
     field points at), the click path to the connect flow, a per-permission map of where a reviewer
     sees it exercised, and the scope-of-use statement. "Is Facebook Login integrated" = **Yes**
     (Facebook Login for Business is the connect handshake, even though sparx sign-in is
     email/password). Geo restrictions answered: none.

   Still required before it can go, none of it engineering:
   - **Remove the 3 permissions sparx does not use** — `ads_management`, `ads_read`,
     `Marketing API Access Tier`. They were swept in automatically, and each demands its own
     screencast of a feature that does not exist. Unsupportable permissions sink whole submissions.
     [docs/133](../133-social-media-posting.md) §249 puts ads in **Phase 4, explicitly not this
     module**, so there is nothing to demo and nothing to lose by dropping them.

     > **Correction (2026-07-28):** an earlier revision of this list said **four**, including
     > `catalog_management`. That was wrong. `catalog_management` **is** used — by the commerce
     > sales-channel sync in
     > [packages/channels/src/adapters/meta.ts](../../packages/channels/src/adapters/meta.ts),
     > which requests `catalog_management,business_management` and pushes the tenant's products
     > into their own Meta catalog via `items_batch` for Facebook & Instagram Shops. It belongs in
     > the submission; its description is now written, and its screencast must demo the **channel
     > sync**, not social posting. The lesson: the removal list came from recall, and the scope
     > constants in the adapters are the only ground truth.

   - **The per-permission compliance attestation** ("If approved, I agree that any data I receive
     through X will be used in accordance with the allowed usage"). It lives _inside_ each
     permission's dialog, under the screencast uploader, which is why it is easy to miss — none of
     the 18 were ticked. **Done 2026-07-28** for all 15 permissions sparx actually uses;
     `public_profile` is now fully complete. The 3 above are deliberately left untouched pending
     the removal decision — ticking a compliance attestation for an ads permission we never call
     would be attesting to nothing.
   - **A reviewer test account, and its credentials pasted into the access-code field.** The
     Reviewer instructions step reads "Needs your review" until an owner confirms it, and the
     instructions promise credentials in that field. **This is the step that decides the
     submission**: a reviewer who cannot sign in to `app.sparx.works` and drive the connect flow
     fails the review regardless of how good the descriptions are. It also presumes api-rest +
     social-worker are actually deployed (still outstanding, below).
   - **A screencast per permission** — 14 of them, showing the OAuth flow and the end-to-end
     experience. `catalog_management`'s must demo the **Commerce → Sales channels** sync, not
     social posting; the other 13 are the Social module.
   - **At least one successful API call per permission**, which takes up to 24h to register. Seven
     read `0 of 1`: `read_insights`, `pages_read_user_content`, `pages_manage_engagement`,
     `instagram_manage_insights`, `instagram_manage_comments`, `threads_basic`,
     `threads_content_publish`. The rest already read `Completed`. The unblock is to exercise them
     once under Standard Access — set `META_INBOX_ENABLED=true`, reconnect, let the inbox sync and
     metrics sweep run — which is the same work that would fix Threads' zero calls.
   - **The Data handling questionnaire** — legal declarations about the entity (data controller,
     country, subprocessors, public-authority requests). The controller answer is **WizeWorks LLC**,
     not a natural person, matching the DPA. The public-authority answers are now backed by
     [docs/corporate/legal/](../corporate/legal/), written 2026-07-28 for exactly this.
   - **The per-permission agreement checkbox, and Submit.** Attestations — the owner's to make.

   What each unlocks once approved: Meta engagement scopes light up the Inbox for Facebook +
   Instagram, Meta insights scopes turn reach/views from dashes into numbers with no code change, and
   the Pinterest / TikTok / YouTube content-API approvals make those platforms connectable at all.
   See §10 for how to tell when one has landed.

   Unrelated but on the same developer account: two **past-due Required Actions** (a platform-policy
   violation on `stumbleable`, a data-access renewal on `JobSight Pro`), both showing App state
   **Restricted**. Different apps and a different business, so not a sparx blocker — but unresolved
   enforcement on an account is not a helpful backdrop to a review submission.

3. **Live verification.** Nothing here has been exercised against a real platform account.
4. **Two platforms cannot connect at all, for reasons outside the code** (found 2026-07-28 by
   probing each platform's token endpoint with the credentials in Secret Manager):
   - **Pinterest** refuses its own `client_credentials` grant with `1201 Two-factor authentication
required` — Pinterest requires 2FA on the _developer account_ that owns the app before it will
     serve the API at all. Until that is switched on in Pinterest's settings, no tenant can connect
     a Pinterest board no matter what the adapter does.
   - **LinkedIn and Google OAuth have no credentials.** `linkedin-client-id`, `linkedin-client-secret`,
     `google-oauth-client-id` and `google-oauth-client-secret` exist as Secret Manager containers
     with **zero versions** — never populated. That silently disables LinkedIn, Google Business
     Profile _and_ YouTube, all three of which read those two Google vars. They report `coming_soon`
     rather than erroring, so the gap is invisible from the UI.

   Meta (`1674943623584234`, "sparx") and TikTok both answered correctly, so their credentials are
   live and valid.

## 10. Telling whether a platform review has landed

None of these platforms expose approval status as an API — not Meta, not TikTok, not Pinterest. So
the module answers the question the only way it can be answered: by looking at what a LIVE grant can
actually do. **Connections → Permission check** (admin-only, `GET /v1/social/readiness`, or
`check_social_connections` over MCP) diffs the permissions each platform granted against the ones
each adapter asks for, and reports one of `ready` · `permissions_missing` · `awaiting_review` ·
`reconnect_required` · `unverifiable`.

Three things about it are worth knowing before trusting a green tick:

- **Meta cannot be tested with your own account.** Meta grants anyone holding a role on the
  developer app every permission the app has merely _configured_ — reviewed or not. Connect the
  account that owns the app and you get a perfect, complete, entirely meaningless permission list.
  The check detects this (it reads `/{app-id}/roles`) and refuses to call it a pass, saying so in
  `caveat`. **To test a Meta review, connect an account with no role on the sparx app.**
- **TikTok CAN be tested with your own account**, because its limit is on the app rather than on who
  granted it: an unaudited app is capped at private posts no matter whose account connects. The
  check reads TikTok's allowed privacy levels — a public option can only come from an approved app.
  A private-only answer is reported as "not confirmed", never as "rejected", because a creator whose
  own TikTok account is private looks identical.
- **`unverifiable` is a real answer.** Threads reports no scope at all on its token exchange, so
  there is genuinely nothing to compare. The check says that rather than showing a green tick that
  means "we never looked" — and the adapters no longer record the scope they _asked_ for as though
  the platform had confirmed it.

## 8. Cross-references

- Design: [133 — Social Media Posting](../133-social-media-posting.md)
- Build plan: [134 — Social Media build plan](../134-social-media-build-plan.md)
- Living status + decision log: [implementation/social.md](../implementation/social.md)
- Attribution taxonomy: [80 — attribution](../80-marketing-attribution-analytics.md)
- Media serving contract: [brain: services](../brain/apps/services.md)
- Sales channels (adjacent, out of scope): [106](../106-channel-marketplace-strategy.md)
