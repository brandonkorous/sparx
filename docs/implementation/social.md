# Social module — implementation tracker

Version: 0.1
Author: Brandon Korous
Last Updated: 2026-07-24

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
| **Plan**      | A calendar as the daily workspace — see the month, drag to reschedule                       | ✅                                                                           |
| **Attribute** | Post links carry attribution, so social shows up in the same reports as every other channel | 🟡                                                                           |
| **Measure**   | "How did it do?" — per-post + per-account performance                                       | 🟡                                                                           |
| **Engage**    | An inbox — read and reply to comments, mentions, DMs                                        | 🔒                                                                           |
| **Advertise** | Paid campaigns + ROAS against real revenue                                                  | — (its own module, out of scope — [133 §14](../133-social-media-posting.md)) |

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

| Surface / capability          | Notes                                                                                                                                                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Connections**               | OAuth connect / reconnect / disconnect; per-target enable. Meta app configured in prod — Facebook Page + Instagram + Threads are `available`; LinkedIn + Google Business Profile live.                                                                                                            |
| **Composer**                  | One post → N platforms; per-destination text/first-comment overrides; save draft / schedule / submit for approval / publish now. Split-studio layout (form left, live preview pinned right); avatar destination cards; the saved/draft view shows the **same** "How it will look" as compose-new. |
| **Live per-platform preview** | Real image cropped to each platform's shape (focal-point aware), caption cut at the platform's limit (struck-through overflow), per-platform link treatment.                                                                                                                                      |
| **Calendar** (module landing) | Its own top-level panel and the module's default landing. Month grid (agenda fallback on a narrow pane); **drag-to-reschedule**; tap a day to write a post already dated to it; unscheduled-drafts tray.                                                                                          |
| **Posts** (list)              | Search + triage. Pipeline strip (glance + filter); image-led rows with destination avatars; grouped by lifecycle.                                                                                                                                                                                 |
| **Approvals**                 | The `pending_approval` inbox (surfaces automation-drafted posts).                                                                                                                                                                                                                                 |
| **Publish pipeline**          | `social-worker` drain: resolve/refresh grant → render per platform → adapter publish (idempotent) → per-target result; partial-publish state machine.                                                                                                                                             |
| **Media preview**             | Variant-URL contract fixed (`variantUrlPath` single source of truth) — see [brain: services](../brain/apps/services.md). Deployed.                                                                                                                                                                |

### Code-complete, pending install/deploy 🟡

| Item                                       | What remains                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **UTM attribution tie-in**                 | Code merged into the working tree (worker + taxonomy + test). Needs `pnpm install` to link the new `@sparx/attribution` dep into `social-worker`, then a deploy. See §3 (decision) + §5 (hand-off).                                                                                                                                                                                                                                                                            |
| **Analytics — post performance (Measure)** | Full vertical merged: `social_post_metrics` model + RLS migration; `getMetrics` on the Meta adapters (FB + IG, counts on granted scopes, reach/impressions best-effort) + tests; `social.metrics.collect` event + worker collector; api-rest `GET /posts/:id/metrics`, `GET /insights`, `POST /posts/:id/metrics/refresh`; workbench **Insights** surface. Needs the DB regen + Terraform apply + deploy (§5). Reach/impressions stay null until the extra Meta review clears. |

### Not started ⬜ / blocked 🔒

| Item                                     | State                                                                                                                                                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engagement inbox**                     | 🔒 Entirely new inbound direction; the adapter contract is publish-only today. Replying is gated on Meta App Review (`pages_manage_engagement`, `pages_messaging`, `instagram_manage_comments/messages`). |
| **Hashtag helper / bulk CSV scheduling** | ⬜ Standalone conveniences; not built.                                                                                                                                                                    |

---

## 3. Decision log

Newest first. Each entry: the decision, and the reason it beat the alternative.

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

1. **Ship the two 🟡 verticals** — run the hand-offs in §5 so UTM + Analytics go live.
2. **Analytics follow-ons** (the base is built): a **periodic collection sweep** so a
   post's numbers keep updating without someone opening it (needs a cron + a due-scan —
   deliberately deferred from v1, which collects on publish + on-demand refresh); and,
   once the extra Meta review clears, **reach/impressions** light up with no code change.
3. **Finish the plan/compose leftovers** (the [133 §12](../133-social-media-posting.md)
   tail): hashtag helper, bulk CSV scheduling.
4. **Engagement inbox — Meta-first, scope-gated.** Extend the adapter contract for
   inbound (comments/DMs/mentions), a new inbox model + surface + reply composer.
   **Start the App Review applications early** (external clock): `pages_manage_engagement`,
   `pages_messaging`, `instagram_manage_comments/messages`. Google Business reviews/Q&A
   fit the same inbox; LinkedIn and X are limited/paid — honest "not supported here"
   for those.

---

## 5. Pending hand-offs

- **`pnpm install`** to link `@sparx/attribution` into `social-worker` (the UTM dep) and
  update `pnpm-lock.yaml` (needed before push — the pre-push guard runs
  `--frozen-lockfile`).
- **`prisma migrate dev` + `prisma generate`** for the new `SocialPostMetric` model
  (migration `20270112000000_social_post_metrics`). Until the client is regenerated,
  `social-worker` and `api-rest` show expected `socialPostMetric` type errors — that's
  the normal new-model state, not a bug. Prod applies the same SQL via the DB-migrate
  pipeline on push.
- After both: `pnpm --filter @sparx/social-worker typecheck` + `test` and
  `pnpm --filter @sparx/api-rest typecheck` go green.
- **Terraform apply** — three things in `main.tf` + `serverless.tf`: (1) sets
  **`MEDIA_PUBLIC_BASE_URL`** on the social-worker — **the operative fix for "Facebook
  didn't post the image"** (without it, every post is text-only); (2) the
  `social.metrics.collect` topic; (3) the social-worker's second push subscription.
  Without (2)/(3), publishing that event 5-`NOT_FOUND`s (the recurring "event type with no
  topic" drift). **The image fix is live only after this apply + a social-worker deploy.**
- **Deploy** `social-worker` + `api-rest` so publish-time UTM tagging AND metrics
  collection/reads take effect in prod.

---

## 6. Open questions

- **UTM opt-out.** Tagging is automatic (author-tagged links excepted). A per-tenant
  opt-out would be a `SocialSettings.trackLinks` column → a migration. Deferred pending
  a decision that anyone wants to turn it off.
- **Analytics reach/impressions.** Blocked on a Meta review (`read_insights` /
  `instagram_manage_insights`); application not yet filed.
- **Inbox scope applications.** Not yet filed; they're the long pole for the Engage
  layer.

---

## 7. Cross-references

- Design: [133 — Social Media Posting](../133-social-media-posting.md)
- Build plan: [134 — Social Media build plan](../134-social-media-build-plan.md)
- Attribution engine: [80 — attribution](../80-*) · taxonomy in
  `packages/attribution/src/taxonomy.ts`
- Session attribution + analytics: [128](../128-session-attribution.md),
  [129](../129-analytics-dashboards.md), [130](../130-analytics-normalization.md)
- Media serving contract: [brain: services](../brain/apps/services.md)
