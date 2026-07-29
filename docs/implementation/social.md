# Social module — implementation tracker

Version: 1.2
Author: Brandon Korous
Last Updated: 2026-07-29

> The **living** status + decision log for the `social` module. It answers three
> questions the design docs don't: what are we building _toward_, where are we
> _actually_, and _why_ did we choose what we chose.
>
> It complements — does not replace — the two static docs:
>
> - [133 — Social Media Posting](../133-social-media-posting.md) — the design spec
>   (the _what_ and _why_ of the module).
> - [134 — Social Media build plan](../134-social-media-build-plan.md) — the
>   planned, dependency-ordered slices.
>
> When a decision here contradicts an assumption in 133/134, **this doc wins** and
> the older doc should be reconciled. Update this file in the same change that ships
> the thing it describes.

**Status legend:** ✅ shipped · 🟡 code-complete, pending install/deploy · ⬜ not
started · 🔒 blocked on an external gate (platform API review).

---

## 1. What we're working toward

A social tool a non-technical business owner runs their whole social presence from —
built in capability order, each layer standing on its own:

| Layer         | Capability                                                                                  | State                                                                        |
| ------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Publish**   | Connect accounts → write one post → fan out to N platforms, each in its own shape           | ✅                                                                           |
| **Plan**      | A calendar as the daily workspace — month + week, drag to reschedule, a standing cadence    | ✅                                                                           |
| **Attribute** | Post links carry attribution, so social shows up in the same reports as every other channel | 🟡                                                                           |
| **Measure**   | "How did it do?" — per-post + per-account performance, on a self-refreshing cadence         | 🟡                                                                           |
| **Engage**    | An inbox — read and reply to comments, mentions, reviews                                    | 🟡 built in code; no platform provisioned (§2)                               |
| **Advertise** | Paid campaigns + ROAS against real revenue                                                  | — (its own module, out of scope — [133 §14](../133-social-media-posting.md)) |

**The whole arc is built in CODE — no platform is connectable yet.** Every one is waiting on
its own developer app + approval; see the **Platform provisioning** table in §2, which is the
only place in this doc that answers "can a tenant actually use this?". The audit in
[docs/social-audit/](../social-audit/00-README.md) scored the module 6.5/10 and its roadmap has been
executed: 23 of 26 slices, everything that was ours to build. Terraform is applied (§5). What is
left is a deploy, and the platform applications — forms with external clocks, not engineering. See
[social-audit §9](../social-audit/00-README.md#9-what-shipped) for the full inventory.

The arc: a tenant should be able to **publish**, **plan**, **attribute**,
**measure**, and **engage** without leaving the module — in that order of priority.

**Attribute vs Measure are two different analytics, at two different maturities.**
_Source-level_ analytics — "social drove N visits / $X" — is **already wired**: the
platform's Traffic dashboard has a "Social media" channel
([`builder-traffic.ts`](../../services/api-rest/src/lib/analytics/metrics/builder-traffic.ts)),
and the UTM tie-in (Attribute) feeds it. Nothing new is built to see social _as a
traffic/revenue source_. _Post-level_ analytics — "this post got N likes, reached M
people" — is the separate **Measure** build (this doc §2/§3), a per-post/per-account
performance model + its own Insights surface, because on-platform engagement never
touches the tenant's own site and so can't come from the traffic pipeline.

---

## 2. Where we are

### Shipped ✅

| Surface / capability          | Notes                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Connections**               | OAuth connect / reconnect / disconnect; per-target enable. **This row describes the CODE only.** As of 2026-07-29 NO platform is operational end-to-end: every one is waiting on its own developer-app + approval. An adapter being "shipped" says nothing about whether a tenant can connect it — read the **Platform provisioning** table below, never this one, for what is actually live. |
| **Composer**                  | One post → N platforms; per-destination text/first-comment overrides; save draft / schedule / submit for approval / publish now. Split-studio layout (form left, live preview pinned right); avatar destination cards; the saved/draft view shows the **same** "How it will look" as compose-new.                                                                                             |
| **Live per-platform preview** | Real image cropped to each platform's shape (focal-point aware), caption cut at the platform's limit (struck-through overflow), per-platform link treatment.                                                                                                                                                                                                                                  |
| **Calendar** (module landing) | Its own top-level panel and the module's default landing. Month grid (agenda fallback on a narrow pane); **drag-to-reschedule**; tap a day to write a post already dated to it; unscheduled-drafts tray.                                                                                                                                                                                      |
| **Posts** (list)              | Search + triage. Pipeline strip (glance + filter); image-led rows with destination avatars; grouped by lifecycle.                                                                                                                                                                                                                                                                             |
| **Approvals**                 | The `pending_approval` inbox (surfaces automation-drafted posts).                                                                                                                                                                                                                                                                                                                             |
| **Publish pipeline**          | `social-worker` drain: resolve/refresh grant → render per platform → adapter publish (idempotent) → per-target result; partial-publish state machine.                                                                                                                                                                                                                                         |
| **Media preview**             | Variant-URL contract fixed (`variantUrlPath` single source of truth) — see [brain: services](../brain/apps/services.md). Deployed.                                                                                                                                                                                                                                                            |

### Code-complete, pending install/deploy 🟡

| Item                                       | What remains                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **UTM attribution tie-in**                 | Code merged into the working tree (worker + taxonomy + test). Needs `pnpm install` to link the new `@sparx/attribution` dep into `social-worker`, then a deploy. See §3 (decision) + §5 (hand-off).                                                                                                                                                                                                                                                                                                                                                                                |
| **Analytics — post performance (Measure)** | Full vertical merged: `social_post_metrics` model + RLS migration; `getMetrics` on the Meta adapters (FB + IG, counts on granted scopes, reach/impressions best-effort) + tests; `social.metrics.collect` event + worker collector; api-rest `GET /posts/:id/metrics`, `GET /insights`, `POST /posts/:id/metrics/refresh`; workbench **Insights** surface. Needs the DB regen + Terraform apply + deploy (§5). Reach/impressions stay null until the extra Meta review clears. **2026-07-29: `getMetrics` now covers ALL 8 adapters** (was 3 of 8 — see the decision entry below). |

### Not started ⬜ / blocked 🔒

| Item                                     | State                                                                                                                                                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engagement inbox**                     | 🔒 Entirely new inbound direction; the adapter contract is publish-only today. Replying is gated on Meta App Review (`pages_manage_engagement`, `pages_messaging`, `instagram_manage_comments/messages`). |
| **Hashtag helper / bulk CSV scheduling** | ⬜ Standalone conveniences; not built.                                                                                                                                                                    |

### Platform provisioning — the REAL "is it live?" table

**An adapter is code; a connection needs a developer app AND an approval.** Those are two
different clocks and this doc previously conflated them, which read as "Google Business and
LinkedIn are live" when neither had ever been set up. Adapter coverage is 8/8 with
`getMetrics` on all of them. **Operational platforms: none, as of 2026-07-29.** Track the
provisioning half here.

| Platform            | Adapter | Developer app                                      | Gate before a tenant can connect                                                                                                                                                                                                                              |
| ------------------- | ------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LinkedIn**        | ✅      | ✅ `sparx` (client `86oksrabanjmb`), page-verified | 🔒 Community Management API Development Tier **submitted 2026-07-29**, in review. Analytics use case to be added at Standard Tier.                                                                                                                            |
| **Google Business** | ✅      | ⬜ not set up                                      | 🔒 Needs a GBP listing **verified + active 60+ days** and a website on the profile, THEN the GBP API contact form w/ Project Number. Approval reads as quota: 0 QPM = no, 300 QPM = yes. The 60-day clock starts at listing verification, not at application. |
| **Facebook Page**   | ✅      | ⬜ not set up                                      | 🔒 Meta app + Business Verification + App Review (Advanced Access) — screencast per permission.                                                                                                                                                               |
| **Instagram**       | ✅      | ⬜ not set up                                      | 🔒 Same Meta app + review as Facebook.                                                                                                                                                                                                                        |
| **Threads**         | ✅      | ⬜ not set up                                      | 🔒 Same Meta verification, but its own app credentials + host. `threads_manage_insights` is its own review.                                                                                                                                                   |
| **Pinterest**       | ✅      | ⬜ not set up                                      | 🔒 Trial access cannot create Pins in production — needs the Standard-access upgrade (demo video), hence `PINTEREST_SANDBOX`.                                                                                                                                 |
| **TikTok**          | ✅      | ⬜ not set up                                      | 🔒 Content Posting API audit to post publicly + URL-ownership verification of the media CDN domain. `video.list` is a separate ask.                                                                                                                           |
| **YouTube**         | ✅      | ⬜ not set up                                      | 🟡 Lightest gate: reuses the Google OAuth client; needs the YouTube Data API enabled + the `youtube.upload` scope through OAuth verification.                                                                                                                 |

**Ordering note.** Every gate above is an external clock, so they should be started in
parallel rather than one at a time — and the 60-day GBP prerequisite means Google Business
is the LONGEST lead time despite looking like the simplest platform. A ninth adapter adds
nothing a tenant can use; the bottleneck is applications, not engineering. The one
exception is a platform with no gatekeeper at all (e.g. Bluesky), which is why that is the
only adapter worth adding before these clear.

---

## 3. Decision log

Newest first. Each entry: the decision, and the reason it beat the alternative.

### 2026-07-28 — connection readiness: answering "has the review landed?" without an API

None of these platforms publish approval status. Meta has no review-status endpoint (confirmed by
probing `/{app-id}/permissions`, `/app_review_submissions` and an `app_review_status` field — the
first returns an empty set, the other two do not exist); TikTok and Pinterest have nothing either.
So the question is answered from the only evidence that exists: what a live grant can actually do.

- **Compare granted against required, per connection.** `SocialAdapter.requiredScopes()` is now part
  of the contract (all 8 adapters), diffed against what the platform reported. Live introspection
  beats the stored set where a platform offers it — someone can strip one permission from their
  account settings weeks after connecting and nothing in sparx would otherwise know.
- **Detect the insider false-green.** This is the point of the Meta probe. Meta grants any holder of
  a role on the developer app every permission the app has merely _configured_, reviewed or not. So
  connecting the account that owns the app returns a flawless permission list that proves nothing —
  and would read as "approved" for as long as nobody checked with an outside account. The probe
  reads `/{app-id}/roles`, notices the overlap, and refuses to report a pass. Meta's `appReview` is
  therefore never `passed`, only `unknown` with a caveat: an unprovable claim reported honestly.
- **TikTok is the one platform testable with your own account**, because the audit caps the APP, not
  the grantee — an unaudited app cannot post publicly for anybody. `creator_info`'s
  `privacy_level_options` is the tell. Asymmetric on purpose: a public option proves approval, but
  private-only is reported as "not confirmed" rather than "rejected", since a private creator
  account looks identical and "still under review" would send someone to TikTok support for nothing.
- **Stop recording assumed scopes as facts.** Pinterest, TikTok and YouTube fell back to `data.scope
?? SCOPE` and Threads hardcoded `scope: SCOPE`, so the DB stored what we _asked_ for as though the
  platform had confirmed it — which would have made every connection read green forever. They now
  record only what the platform actually returned, and Threads (which reports none) surfaces as
  `unverifiable`. A verdict of "nobody can tell you from here" is worth more than a false tick.

### 2026-07-28 — the audit roadmap, executed

Driven by [docs/social-audit/](../social-audit/00-README.md). The decisions worth keeping:

- **Grant health is a SWEEP, not a publish-time check.** Refreshing 60 seconds before expiry, only
  when a post happened to go out, had no margin and could not see a REVOKED grant at all (revocation
  does not move the recorded expiry). So: renew a week early, and prove the token still works with
  one cheap `listTargets` probe — the only way to catch a revoked grant. Either failure flips
  `status='expired'` + `lastError`, which is what finally lights the reconnect alert the Connections
  surface could always render but nothing ever triggered.
- **Notifications publish `email.send`, they do not subscribe to `social.post.failed`.** A dedicated
  subscriber would have meant a new service for two emails. The worker already knows the outcome, so
  it publishes — same house rule as every other outbound email. Best-effort throughout: a
  notification failure must never fail the drain that triggered it.
- **Retry is per-DESTINATION.** Whole-post "publish again" already existed and was hidden by the
  editable-status gate. Adding `partially_published` to that gate would have been the one-line fix;
  a per-target retry is the honest one, because the failure being retried is one account's.
- **The destination picker is ONE component.** Destinations were frozen after creation precisely
  because the picker lived only in the new-post branch — there was no second copy to edit with. One
  component, two states, so the next change to it cannot drift.
- **Inbound is a separate capability flag from posting** (`supportsInbox()` vs `isConfigured()`),
  and it also widens the OAuth SCOPE. The same Meta app is cleared to post long before it is cleared
  to read comments, and a tenant who connects while inbound is off must not carry a token that
  silently lacks the permissions.
- **Google Business reviews need no review of their own.** `business.manage` — already held to post
  — reads and answers reviews, so the engagement inbox is genuinely live on day one for the platform
  a local business cares most about, with no external clock in front of it.
- **A reply is two-phase.** api-rest writes an outbound row with `replied_at` null and emits
  `social.inbox.reply`; the worker sends it. The ROW is the idempotency anchor, which is what makes
  a Pub/Sub redelivery incapable of posting a second answer to a customer.
- **A posting slot is a recurring LOCAL time, never a timestamp.** 9am has to stay 9am across a
  daylight-saving boundary — the audience's morning does not move because the clocks did. Hence
  `cadence.ts` (`weekday` + `minuteOfDay` + IANA zone, resolved with a two-pass offset), shared by
  the slot filler and the calendar so the plan a person SEES is the plan that RUNS.
- **The evergreen filler has three hard rules** — only slots explicitly marked `auto_fill`, never
  over an existing post, and always through the approval gate. Anything looser is a robot posting to
  a real brand's account on its own initiative.
- **Best-time is computed from the tenant's OWN history, and says when it cannot say.** An industry
  average tells a parts distributor the same thing it tells a bakery. A bucket needs three posts
  before it is reported at all; below that the panel says so rather than showing a confident table.
- **Rate limiting is per-CONNECTION and in memory.** Destinations under one grant share that
  account's quota, so a `429` on one pauses its siblings. Shared cross-instance state would mean
  Redis for a problem already bounded by one-post-per-drain; the real win is honouring the
  `Retry-After` the platform actually sent.
- **CSV import previews before it creates**, and a dated row still goes through the approval gate.
  Discovering a broken import by finding thirty half-right drafts is the failure mode; so is an
  import being the one path that reaches live accounts unreviewed.

Two corrections to the audit, both recorded in
[social-audit §9](../social-audit/00-README.md#9-what-shipped): media reliability was **already
fixed** in-tree via `MEDIA_DIRECT_BASE_URL`, and per-automation `autoApprove` **already ships**
with its config UI.

### 2026-07-28 — a second pass on what the roadmap itself missed

- **MCP has to keep up with the UI, or it is a keyhole.** Every capability added in the pass above
  was reachable only from the operator app. An agent that can post but cannot fix a post that
  half-failed is worse than one that cannot post. 11 tools → 28, covering retarget, per-destination
  retry, duplicate, evergreen, the inbox (list / thread / reply / archive), posting slots, hashtag
  sets, best-time, CSV import (with a `dryRun`) and seed-from-entity.
- **A config form needs a way to offer RUNTIME choices.** `social.post` always accepted `targetIds`
  and nothing could set them, because every automation field type was answered by static config.
  Added `multiselect` + an `optionSource` seam rather than a one-off social field, so the next
  runtime-valued choice (a CRM pipeline, a warehouse) is a case, not another field type.
- **An empty multiselect means ALL, not NONE.** Storing `[]` would have turned "I haven't thought
  about this" into "post nowhere". Absent = the action's own default.
- **LinkedIn's inbox was written off without checking.** Its `socialActions` comments API is the
  same one the adapter already posts a first comment through. Reading and answering comments on
  company-page posts is now live behind `LINKEDIN_INBOX_ENABLED`, which also widens the connect
  scope with `r_organization_social` — same discipline as the Meta flag.
- **A number with no direction is a report, not a scoreboard.** `social_post_metrics` stored a
  time series from day one and the UI showed only the newest row. The performance panel now shows
  the change since the FIRST reading (not since the last refresh, which would be near-zero and read
  as a dead post), and only when it actually moved.

### 2026-07-25 — MCP agent parity: added `list_social_connections`

The social MCP already had full compose/lifecycle parity, but an agent had no way
to DISCOVER the target ids `create_social_post` needs — a keyhole (can post, can't
see where). Fixed by moving the connections read view into `@sparx/social`
(`connections.ts` → `@sparx/social/service`, api-rest re-exports it — one service,
many transports) and adding one `read:social` tool `list_social_connections`
(returns each connection + its targets: `id`, `name`, `enabled`, `propertyId`).
Now: **list connections → (upload media via `@sparx/media/mcp`) → create draft →
schedule/publish** is fully agent-drivable. Account CONNECT (OAuth) stays out of
MCP by design. Design note: [mcp-media-agent-parity.md](mcp-media-agent-parity.md)
(also scopes the media site-scoping + auto-groups/collections work — NOT built
yet). Code-complete; ships with the next api-mcp deploy (tool is `social`-module
gated, so it only appears for tenants with the flag on). 🟡

### 2026-07-25 — RESUME HERE: two more FB-image fixes pushed, verification pending

State at last checkpoint (post-`(#324)` byte-upload, which is LIVE on social-worker
v1.166.0). A live re-test of a real FB image publish surfaced TWO more bugs, both fixed
and **pushed to `main`, deploy pipeline running** — NOT yet verified live:

1. **Crop variant URLs 422'd** (commit `800fc74c`, api-rest). The byte-upload path
   downloads the platform-framed crop (`jpeg-1x1-1080.jpg`), but the public media route's
   filename regex only matched BASE variants (`jpeg-800.jpg`) — the aspect segment 422'd
   on validation. Fixed: regex now accepts the optional aspect and passes it back through
   `variantKey()`; the pattern moved to `storage.ts` as `VARIANT_FILENAME_RE`, imported by
   BOTH the route and its test so it can't drift again (a private test copy staying green
   while the route drifted is what shipped the bug). The first byte-upload test dodged this
   (no 1:1 crop existed yet → used the base).
2. **Retry churned permanent errors** (commit `9ce7cf8d`, `@sparx/social` + worker). The
   deferred-target retry (from the earlier worker fix) hammered a permanent 4xx all 5
   attempts. Fixed: Graph + image-fetch helpers throw a status-bearing `HttpError`; the
   worker's `isRetryableError()` keeps `pending` only for transient failures (5xx / 429 /
   network) and fails a 4xx immediately.

**TO VERIFY once api-rest + social-worker redeploy** (watch `gcloud run services describe`
image tags climb past v1.166.0):

- `curl -I -H "Range: bytes=0-" <crop URL>` — the crop `jpeg-1x1-1080.jpg` for asset
  `ec276cf9-…` under tenant `005ed4ee-…` must return **200** (was 422).
- Re-publish a fresh post with an image to the connected FB Page → expect the image to
  actually land (worker log shows `published: 1`, no `#324`).
- The old stuck "publishing" test posts are being deleted by the user (they can't
  self-heal — acked before the retry fix shipped).

STILL OPEN: Instagram / Pinterest / Threads publish by public `image_url` only (no byte
upload) → they WILL hit the same Cloudflare 206 when first used to post an image. Fix is a
CF Snippet (needs a PAID plan — this account is on free), a CF Worker, or a DNS-only media
origin. Documented in `terraform/envs/prod/cloudflare.tf`. LinkedIn already byte-uploads.

### 2026-07-25 — Fix: Facebook rejected the image with `(#324)` — Cloudflare 206, so upload bytes

After the media-resolution fix (below) went live, a real FB image publish STILL
failed — `Facebook photo post: 400 Missing or invalid image file` (Graph `#324`).
Root cause, run to ground against prod:

- The image variant is valid (complete 800×801 progressive JPEG) and public — a
  plain GET returns **200** even with Facebook's crawler UA.
- But Facebook's `/photos?url=` fetch sends `Range: bytes=0-`, and **Cloudflare's
  edge serves any range request a `206 Partial Content`** (verified on HIT and
  MISS). The ORIGIN is fine — curl direct to the ingress with a Range header → 200,
  `Server: Caddy`. Cloudflare is slicing it. Facebook's photo ingestion requires a
  clean 200 and rejects the 206 (its OG Sharing-Debugger scraper tolerates the 206,
  which masked it — the debugger rendered a preview while `/photos` refused).

**Decision: upload the image BYTES to Facebook (multipart `source`), not a url.**
The worker downloads the image itself (a plain GET, no Range → 200) and POSTs the
bytes, so Facebook never fetches our CDN and the 206 is irrelevant. `graphPostMultipart`

- `fetchImageBinary` in `@sparx/social`; `facebook.ts` single + multi photo paths;
  regression test locks "source, never url=".

* **Why not fix it at Cloudflare (which would cover every platform at once):** a
  Transform Rule can't remove `Range` (managed header); a Cache Rule bypass still
  206s; a Snippet that strips `Range` works but needs a **paid CF plan** we're not
  on. Byte-upload is fully in our code, needs no CF change, and makes FB immune to
  any future CDN quirk.
* **Still open:** Instagram / Pinterest / Threads can ONLY publish by public
  `image_url` — no byte upload — so they WILL hit this same 206 when first used to
  post an image. Fix then = CF Snippet (paid), a CF Worker, or a DNS-only origin
  media host. Tracked in `terraform/envs/prod/cloudflare.tf`. (LinkedIn already
  uploads bytes, so it's unaffected.)

Also fixed two worker bugs this uncovered: publish failures now LOG the platform
error (they were only written to the target row — the `#324` took a browser
React-tree dig to surface), and a **deferred target now retries** (the worker was
acking even on a deferred target, so a transient hiccup stranded the post on
"publishing" forever; it now 500s → Pub/Sub redelivers → re-drains only still-pending
targets, capped at MAX_ATTEMPTS).

### 2026-07-24 — Fix: Facebook (and every platform) posted text-only, image dropped

Two bugs in the worker's media path, both fixed:

- **`MEDIA_PUBLIC_BASE_URL` was never set on the prod social-worker** → `resolvePostAssets`
  returns `[]` → every post publishes text-only, image silently skipped. This was the
  actual cause. Fixed by setting it to `https://media.sparx.works` in `serverless.tf`
  (the same origin api-rest mints variant URLs on — needs a **terraform apply**, §5). The
  var name differs from api-rest's `MEDIA_PUBLIC_URL` — a naming footgun that helped it go
  unnoticed; noted for a later rename.
- **The doubled-`/variants/` URL** — the worker built `.../media/variants/${key}` with the
  raw 4-segment key, the same drift the preview 503 fix cured in `GcsStorage.publicUrl` but
  in the worker's own URL construction. So even with the env set the platform couldn't
  fetch the image. Fixed with a worker-local `variantUrlPath()` + a test locking the
  3-segment contract. Also: **prefer a jpeg base** (platforms reliably accept jpeg but can
  reject an avif/webp base; the aspect crops were already jpeg) and added `.avif` to the
  image-extension filter.

### 2026-07-29 — `getMetrics` on every adapter: Measure is only real if it covers all 8

- **The gap was silent, which is why it survived.** The Measure vertical shipped complete
  (model, event, collector, endpoints, Insights surface) with `getMetrics` on only THREE
  adapters — Facebook, Instagram, Pinterest. `collect.ts` skips a target whose adapter has
  no `getMetrics` (`if (!adapter?.getMetrics) continue`), so LinkedIn, Threads, TikTok,
  YouTube, and Google Business reported nothing and nothing ever errored. A capability
  that degrades quietly reads as "built" on every status table while five of eight
  platforms show dashes forever. Now implemented on all eight.
- **Centralizing posting without read-back isn't the product.** A business routes five
  networks through sparx to see, in one place, what worked. So analytics is core scope,
  and every platform-access application must request the analytics/insights use case
  ALONGSIDE posting — not narrowed to posting because the adapter doesn't call analytics
  yet. That reasoning is backwards and it cost us the LinkedIn Community Management
  Development-Tier form (one-shot, unamendable — filed Page management only).
- **Each platform reports a different subset, and the map says so honestly.** LinkedIn is
  the only counts-vs-statistics split (socialActions for likes/comments on scopes we hold,
  `organizationalEntityShareStatistics` best-effort for impressions/reach). TikTok is the
  only one giving all four on a single edge. Threads sums `reposts + quotes` into shares
  because both are how a post travels. YouTube counts arrive as STRINGS and a hidden
  counter is omitted, not zeroed. Google Business is a LISTING — no likes/comments/shares
  exist there at all, only `LOCAL_POST_VIEWS_SEARCH` → impressions. Nobody synthesises
  `reach` from impressions: absent stays absent so the panel shows "—", never a
  fabricated number. Same "null, never zero" rule as 2026-07-24.
- **Analytics scope is gated at CONNECT, not at collection.** `THREADS_INSIGHTS_ENABLED`
  (`threads_manage_insights`) and `TIKTOK_INSIGHTS_ENABLED` (`video.list`) join the
  existing `META_INSIGHTS_ENABLED` / `LINKEDIN_INBOX_ENABLED` pattern — a token minted
  while the flag was off can NEVER read metrics later, so flipping one requires the tenant
  to reconnect. Both default off; requesting an ungranted scope fails the whole authorize
  call and would take posting down with it. Google Business and YouTube need no flag —
  their metrics ride `business.manage` / `youtube.readonly`, already requested at connect.

### 2026-07-24 — Post-performance analytics: snapshots pulled by event, counts-first

- **Time-series snapshots, not a running total.** `social_post_metrics` stores one row
  per (post target, collection) — a post's numbers keep climbing for days, so "how did
  it do?" is the LATEST snapshot with the earlier ones kept for a trend.
- **Null, never zero.** Every metric column is nullable: a platform that can't report
  reach/impressions (the insights scopes need extra Meta review) leaves them null, so the
  UI shows "—", never a misleading 0.
- **Collection is an event (`social.metrics.collect`), pulled by the worker** — same
  event-driven discipline as publishing. Triggered on-demand by the Insights "Refresh"
  action (api-rest enqueues); a periodic multi-snapshot sweep is a later enhancement (it
  needs a cron + a due-scan). No synchronous platform calls on a request path.
- **`getMetrics` reuses the publish token seam** — it takes the same `target` as
  `publish` (Facebook reads insights with the PAGE token), and degrades gracefully:
  engagement counts return on granted scopes, reach/impressions are best-effort so a
  missing scope never drops the counts.
- **Attribute ≠ Measure.** Kept separate on purpose — social-as-a-traffic-source already
  lives in the Traffic dashboard (fed by the UTM work); this is the on-platform,
  never-touches-our-site half. See the note under §1.

### 2026-07-24 — UTM tagging lives at publish time, in the worker

Outbound post links are tagged for attribution in the `social-worker` publish drain
(`services/social-worker/src/utm.ts`), **not** in the shared renderer.

- **Why not the renderer:** it's pure and also drives the composer preview, which
  should show the human link, not a tracking URL. The campaign month is a
  publish-time fact anyway.
- **Reuse, don't reinvent:** tagging calls `buildUtmUrl` from `@sparx/attribution`
  and the controlled taxonomy ([80](../80-marketing-attribution-analytics.md)) — never an ad-hoc tag, which is the
  fragmentation the taxonomy exists to prevent.
- **Scheme:** `utm_source` per platform, `utm_medium=organic-social`,
  `utm_campaign=social-<yyyy-mm>`, `utm_content=<platform>`. Facebook / Instagram /
  Threads collapse to the taxonomy's `meta` source; the specific surface rides in
  `utm_content` so reports can still tell them apart. Registered `pinterest` as a new
  source (the one gap).
- **Automatic, with a guard:** every http(s) link is tagged, but a link the **author
  already UTM-tagged wins** (untouched), and non-http links pass through. No per-post
  or per-tenant opt-out yet — see Open question in §6.

### 2026-07-24 — Calendar is a top-level panel AND the module's landing

The calendar is its own registered surface (`social.calendar`, `order: 1`, the
lowest-order unsectioned surface → the module's landing), not a view toggle inside
Posts.

- **Why:** the calendar is what a social manager opens the app to. Burying it as a
  secondary view of a list undersold the day's primary workspace.

### 2026-07-24 — Calendar and Posts are peer panels; no in-surface view switch

They are two independent top-level panels. The rail/nav is how you move between them;
there is **no** Calendar⇄List segmented control inside either.

- **Why:** two nav entries + an in-surface switch is redundant double-navigation. An
  earlier iteration shipped the switch; it was removed.
- Shared data/handlers live once in a `useSocialBoard(ctx)` hook so the split costs no
  duplication.

### 2026-07-24 — Drag-to-reschedule: pointer-first, published posts pinned

Built on the workbench's dnd-kit pattern (6px activation distance separates a
click-to-open from a drag).

- Only **editable** posts drag (a published one is pinned to when it went out); a
  viewer who can't schedule can't drag at all (no silent 403).
- Optimistic — the chip lands on the new day instantly and rolls back if the server
  refuses; time-of-day is preserved; a drop that would land in the past is nudged an
  hour out (the server requires a future time).
- Pointer-only, on purpose: the equivalent keyboard path is opening the post and using
  its schedule field, so no capability is keyboard-inaccessible.

### 2026-07-24 — Posts are pictures-first in every list

Every row/chip leads with the post's lead image (or a module-tinted "text post" tile),
plus an avatar cluster of the accounts it lands on. Status stays its own axis
(`statusTone` badge), never overloaded onto the avatars.

### 2026-07-24 — Media preview: one URL contract

`variantUrlPath()` is the single source of truth for the 3-segment public variant URL;
emitting the raw 4-segment key was the cause of the prod 503. Locked by a test. Detail
in [brain: services](../brain/apps/services.md).

---

## 4. What's next (ordered)

Items 2–4 of the previous list are **built** (metrics sweep, hashtag sets + bulk CSV, engagement
inbox). What remains:

1. **Run the hand-offs in §5** — `terraform apply` + deploy. Nothing built on 2026-07-28 does
   anything in prod until both roll.
2. **File the three platform applications** (Meta engagement, Meta insights, Pinterest/TikTok/
   YouTube content APIs). Each is a form with a multi-week clock and no engineering in front of it.
   Filing them last is how the inbox slips a quarter for no reason.
3. **Verify live** — the three checks listed at the end of §5.
4. **Then: ads** ([133 §14](../133-social-media-posting.md)), its own module. Organic is done;
   closing the loop on paid spend against attributed revenue is the next real capability, not
   another slice of this one.

---

## 5. Pending hand-offs

**Done 2026-07-28:** `pnpm install` (links `@sparx/attribution` into `social-worker` and
`@sparx/social` into the workbench, lockfile updated); both migrations applied to the local docker
Postgres and the Prisma client regenerated. Typecheck, lint, format and tests are green across
`@sparx/social`, `social-worker`, `api-rest`, `@sparx/email` and `workbench`.

**Terraform applied 2026-07-28** (targeted at `module.pubsub` + `module.social_worker_cloudrun`, so
the Cloudflare resources stayed out of the graph — there was a CF auth issue at the time and the
social work needs nothing from it). Verified live in `sparxworks`:

- Topics `social.connection.check`, `social.connection.expired`, `social.inbox.sync`,
  `social.inbox.reply` created; `social.metrics.collect` already existed.
- The social-worker's push subscriptions for connection-check, inbox-sync and inbox-reply created
  alongside the existing post.due + metrics.collect ones — each with the dead-letter topic, 5
  delivery attempts and the OIDC invoker.
- `WORKBENCH_BASE_URL=https://app.sparx.works` set on the worker.

> **Correction:** `MEDIA_PUBLIC_BASE_URL` and `MEDIA_DIRECT_BASE_URL` were NOT in that plan — both
> were already live. The "Facebook didn't post the image" fix has been in prod since an earlier
> apply; this tracker was carrying a stale hand-off. Posts are not text-only.

> **Unrelated drift, noted not fixed:** every Cloud Run worker (verified on `email-worker`,
> `media-worker` and `social-worker`) shows a perpetual `scaling { min_instance_count = 0 → null }`
> removal that never converges — the API returns the block, the shared `cloud-run-worker` module
> doesn't declare it. Cosmetic (min-instances is 0 either way; no cost or behaviour change). The fix
> is one line in that module, which governs all eight workers, so it is a fleet decision rather than
> something to slip into a social change.

**Platform credentials, probed 2026-07-28** (each platform's own token endpoint, called with the
values in Secret Manager — read-only, no tokens logged):

| Platform               | Result                                                                     |
| ---------------------- | -------------------------------------------------------------------------- |
| Meta                   | Valid — app `1674943623584234` ("sparx", Business). One admin role-holder. |
| TikTok                 | Valid — `client_credentials` grant succeeds.                               |
| Pinterest              | **Blocked** — `1201 Two-factor authentication required`.                   |
| LinkedIn               | **No credentials** — secret exists, zero versions.                         |
| Google (GBP + YouTube) | **No credentials** — secret exists, zero versions.                         |

Two of those are actionable now and neither is a code problem. Pinterest requires 2FA on the
**developer account that owns the app** before it serves the API at all, so no tenant can connect a
board until that is switched on. `linkedin-client-id/secret` and `google-oauth-client-id/secret` were
never populated, which silently disables LinkedIn, Google Business Profile _and_ YouTube (the last
two share the Google vars) — they report `coming_soon` rather than erroring, so nothing in the UI
reveals the gap.

**Still outstanding:**

- **Deploy** `api-rest` + `social-worker`. Everything from grant health to the engagement inbox is
  inert until both roll — the topics and subscriptions exist, but nothing publishes to or consumes
  them until the new code ships.
- **Optional env, whenever a review lands:** `META_INBOX_ENABLED=true` turns on the Meta half of the
  engagement inbox and `LINKEDIN_INBOX_ENABLED=true` the LinkedIn half — no code change either time.
  Both also widen the OAuth scope requested at connect, so existing connections need reconnecting to
  gain the permissions. Google Business needs neither: `business.manage` already covers reviews.
- **Live verification.** Nothing built on 2026-07-28 has been exercised against a real platform
  account. The first pass should be: revoke a grant → confirm "Reconnect needed" appears without a
  post being attempted; fail one destination of a multi-destination post → confirm the email and
  the per-destination retry; post an image to Instagram → confirm the direct-host fix.

---

## 6. Open questions

- ~~**UTM opt-out.**~~ Settled 2026-07-28: `trackLinks` is a tenant setting (default ON) on the
  `settings.modules.social` slot — no migration needed — with a switch on the Connections surface.
  The worker skips tagging when it is off; an author-tagged link is still never touched.
- **Analytics reach/impressions.** Blocked on a Meta review (`read_insights` /
  `instagram_manage_insights`); **application still not filed.** No engineering in front of it —
  the collectors already request these best-effort and store `null`.
- **Meta engagement scopes.** `pages_read_user_content`, `pages_manage_engagement`,
  `pages_messaging`, `instagram_manage_comments`. **Still not filed.** The inbox is built and live
  for Google Business; Facebook and Instagram light up behind `META_INBOX_ENABLED` the day this
  clears.
- **Per-automation destination picker.** `social.post` supports `targetIds`, but the automations
  config form has no dynamic multi-select field type, so an automation posts to every enabled
  destination. Adding one is a cross-cutting automation-UI change, not a social one.
- **Facebook/Instagram DMs.** The inbox models `kind: 'message'` and the schema supports it, but no
  adapter reads conversations yet — comments, mentions and reviews first, since they are public and
  the ones a business is judged on. Messenger's send API also carries a 24-hour reply window and its
  own policy surface, which is a design decision rather than an implementation gap.
- **Threads replies.** Threads' reply flow is its two-step create-then-publish with a `reply_to_id`,
  which differs enough from its post flow to be worth writing against a real account rather than
  blind. LinkedIn, Facebook, Instagram and Google Business cover the inbox for now.

---

## 7. Cross-references

- Design: [133 — Social Media Posting](../133-social-media-posting.md)
- Build plan: [134 — Social Media build plan](../134-social-media-build-plan.md)
- Attribution engine: [80 — attribution](../80-*) · taxonomy in
  `packages/attribution/src/taxonomy.ts`
- Session attribution + analytics: [128](../128-session-attribution.md),
  [129](../129-analytics-dashboards.md), [130](../130-analytics-normalization.md)
- Media serving contract: [brain: services](../brain/apps/services.md)
