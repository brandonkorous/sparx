# 134 — Social Media Posting: build plan

Version: 0.1
Author: Brandon Korous
Last Updated: 2026-07-22

> The slice-by-slice execution plan for the `social` module designed in
> [133-social-media-posting.md](133-social-media-posting.md). Each slice is
> independently committable and — from Slice 3 on — demoable. Sequenced by
> dependency: nothing is blocked on a later slice. Phase 1 ships the spine +
> Google Business Profile + LinkedIn; Meta/Threads (Phase 2) and the rest of the
> platform tail (Phase 3) are adapter-only additions gated on external API review.

## Conventions for this plan

- **Reuse over rebuild.** The channels stack ([106](106-channel-marketplace-strategy.md))
  already ships the OAuth + encrypted-token + adapter + worker spine; we mirror it,
  we do not fork it. The genuinely new code is the _post_ domain, the publish-direction
  adapter, the renderer, the approval lifecycle, and the composer UI.
- **DB work is authored as files only.** Prisma schema + hand-edited RLS SQL land as
  files and go through the [db-migrate pipeline](../packages/db/CLAUDE.md); we never
  run `prisma migrate`/`generate` against the shared stack. New-model TypeScript will
  not typecheck until the client is regenerated — expected.
- **Terraform + code in the same slice.** Any new Pub/Sub topic/subscriber is mirrored
  into `terraform/envs/prod/main.tf` in the slice that introduces it (no drift).

---

## Phase 1

### Slice 0 — Module + events plumbing

**Goal:** the module can be turned on/off and its event topics exist; no user surface yet.

- `wizeworks/packages/modules/src/index.ts` — add `social` to the `ModuleSlug` union + `ALL_MODULES`
  (no `REQUIRES`, no `BUNDLED_FREE`).
- `wizeworks/services/api-rest/src/lib/module-toggle.ts` — add `social` to the duplicated
  `MODULE_SLUGS` toggle vocabulary.
- `wizeworks/packages/billing/src/price-catalog.ts` — **no** `MODULE_MONTHLY_CENTS` entry (a
  module with no entry is not billed → free); add a comment so the omission is not
  "fixed" later. Enabling flows the normal toggle path; `syncModuleItems` finds no
  price id and creates no Stripe item.
- `wizeworks/packages/events/src/types.ts` — add the `social.*` literals (§10 of 133).
- `terraform/envs/prod/main.tf` — declare the `social.*` topics (`[]` topic-only for
  now; `social.post.due` gets the `social-worker` subscriber in Slice 4).

**Acceptance:** `social` toggles on/off via `PATCH /v1/tenant/modules/social`;
`module.activated` fires; no Stripe item is created; typecheck/lint green.

**Deliberately deferred to later slices:** the tenant-facing module catalog card +
module hue token (`MODULE_META` / `--color-module-social`) land with the workbench
surface (Slice 6); the automation module tag (Slice 7).

### Slice 1 — Data model + RLS

**Goal:** the four tables exist with tenant isolation.

- `wizeworks/packages/db/prisma/schema/87-social.prisma` — `SocialConnection`, `SocialTarget`,
  `SocialPost`, `SocialPostTarget` (§5 of 133), each `tenant_id` + FORCE RLS, mirroring
  the `79-channels.prisma` shape. `SocialConnection` holds `accessTokenEnc` /
  `refreshTokenEnc` (Text, AES-GCM boxed), `SOCIAL_TOKEN_KEY`.
- The migration SQL (Prisma-generated DDL) + **hand-edited RLS** (`ENABLE` + `FORCE` +
  `tenant_isolation` using `current_tenant_id()`), authored as files.

**Handoff:** I author files; **you** run the migration through the pipeline + regenerate
the client. New-model code compiles only after that.

**Acceptance (post-pipeline):** tables exist; a cross-tenant select returns 0 rows
under a tenant role.

### Slice 2 — `@wizeworks/social` package + `SocialAdapter` contract

**Goal:** the network-free core — contract, registry, renderer, crypto — fully tested.

- New workspace package `@wizeworks/social` (new-workspace-package skill): `SocialAdapter`
  interface + shared types (§4), the adapter **registry**, the AES-GCM secret box
  (`SOCIAL_TOKEN_KEY`, reusing the channels crypto util), and the **renderer**
  (`SocialPost` → `RenderedPost` per target + constraint validation).

**Acceptance:** unit tests for the renderer + per-platform constraints pass; no live
platform needed.

### Slice 3 — Connect an account (Google Business Profile)

**Goal:** first clickable thing — connect a real account, attach targets.

- GBP adapter: `isConfigured`/`connectUrl`/`exchangeCode`/`refresh`/`listTargets`/`publish`.
- api-rest: **connect** (build `connectUrl` + signed state), **OAuth callback** (verify
  state, `exchangeCode`, encrypt + store `SocialConnection`), **attach targets**
  (`listTargets` → `SocialTarget`). Mirror the channels OAuth callback.

**Acceptance:** connect a live Google Business account; chosen locations persist as targets.

### Slice 4 — Compose + publish-now (GBP end-to-end)

**Goal:** first post out the door.

- api-rest CRUD for `SocialPost` / `SocialPostTarget` (API-first).
- `services/social-worker` (Pub/Sub consumer; `channel-sync-worker` template) — drains a
  publish job, decrypts token, renders, `adapter.publish` with `postId:targetId`
  idempotency key, records per-target result + per-connection backoff. Add its
  subscription to `social.post.due` in Terraform.
- "Publish now" path emits the job.

**Acceptance:** compose via API → post appears live on GBP; kill one target → post is
`partially_published` with a retry that no-ops the succeeded target.

### Slice 5 — Scheduling + approval lifecycle

**Goal:** scheduled + reviewed posting.

- `scheduledAt` + `find_due_social_posts()` SECURITY DEFINER drain mirroring
  `wizeworks/services/api-rest/src/lib/scheduled-publish.ts`; emits `social.post.due`.
- Full lifecycle states + the approval gate: require-approval tenant default, `approve`
  as a staff permission (§7 of 133).

**Acceptance:** schedule +5 min → publishes; unapproved post is blocked in an inbox.

### Slice 6 — Workbench social surface

**Goal:** the whole flow with no hand-rolled API calls.

- `sparx/apps/workbench` `social` surface (workbench-surface conventions): Connections,
  Composer (live per-platform preview + focal-point crop), Calendar/queue, Approvals
  inbox. Add the `social` module hue token + `MODULE_META` card. Media auto-variants
  (§8 of 133) generated in the media worker; composer exposes the focal point.

**Acceptance:** connect → compose → schedule → approve → publish, all in the UI.

### Slice 7 — Automation action

**Goal:** posts as a first-class automation step.

- `'social.post'` in the `ActionType` enum + executor via `installModuleActions()`;
  add the `social` tag to the automations catalog; seed disabled starter automations
  ("Announce new product", "Announce new blog post").

**Acceptance:** publishing a product drafts a post into the approval inbox.

### Slice 8 — Second platform: LinkedIn

**Goal:** prove the abstraction with a second platform.

- LinkedIn org-post adapter. Flush out any GBP-specific leakage in the shared spine.

**Acceptance:** one composed post fans out to GBP **and** LinkedIn.

---

## Phase 2 — Meta (Facebook Pages + Instagram + Threads)

Gated on Meta App Review + Business Verification (start during Phase 1 — §6 of 133).
Adapter-only: three adapters sharing one Meta app + verification. No spine changes if
Phase 1 held the abstraction.

## Phase 3 — the platform tail

X (flag the paid-tier API cost first), TikTok, Pinterest, YouTube — one adapter + one
OAuth app each, as their API approvals land.

## Phase 4 — paid ads

Its own module + doc (§14 of 133). Not scoped here.
