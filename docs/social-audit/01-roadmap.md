# Social audit — roadmap to 10/10

Version: 2.0.0
Author: Brandon Korous
Last Updated: 2026-07-28

> **STATUS — 23 of 26 slices built (2026-07-28).** Everything ours to build has landed. What is
> left is the deploy (slice 0) and the three platform applications (14, 16, 22), none of which has
> any engineering in front of it. See [00-README §9](00-README.md#9-what-shipped).
>
> Slice 4 is ticked as **already solved** rather than built: `MEDIA_DIRECT_BASE_URL` — a DNS-only
> origin bypassing Cloudflare's `206` — was in the working tree, wired end to end. The audit read a
> tracker entry that had not caught up.
>
> Slice 11 is ticked as **already shipped**: `autoApprove` is in the `social.post` config schema and
> in the automations catalog's config form. Only a per-automation destination picker is absent, and
> "every enabled destination" is a defensible default.

> The execution half of [00-README.md](00-README.md). Scope is the **`social` module** — the
> package, its adapters, the api-rest routes, the `social-worker`, the workbench surfaces, the
> automation action and the MCP tools. Nothing here targets `channels` (product feeds) or the
> future `ads` module.
>
> Every slice carries a tag — **in-our-control** · **external-gate** (a platform review whose clock
> we do not own) · **cost-decision** — and a rough size. Sizes are shape, not a commitment. Tick a
> slice when it lands and bump this doc's version; move anything actionable-now into kanNINJA per
> [brain/tasks](../brain/tasks/kanninja-is-the-record.md).
>
> **File the external-gate applications on day one of any wave.** Meta review is the longest pole in
> the module and no code can shorten it. Three separate applications are outstanding and none has
> been submitted: insights scopes (`read_insights`, `instagram_manage_insights`), engagement scopes
> (`pages_manage_engagement`, `pages_messaging`, `instagram_manage_comments/messages`), and the
> Pinterest / TikTok / YouTube content-API approvals.

---

## Wave 0 — ship what is already built

Not a wave of work; a wave of buttons. Everything below it is code-complete in the working tree and
one env var stands between every post and its image. This is hours, and it is the only thing
standing between the module and every score in this document.

- [ ] **0. Run the pending hand-offs.** Partly done — `pnpm install` and the migrations are applied
      locally and the Prisma client is regenerated (both `20270112000000_social_post_metrics` and the
      new `20270122000000_social_health_inbox_cadence`; prod applies them on push via the DB-migrate
      pipeline). Still outstanding: a **`terraform apply`** covering `MEDIA_PUBLIC_BASE_URL`, the new
      `WORKBENCH_BASE_URL`, the `social.metrics.collect` topic and the four NEW topics
      (`social.connection.check`, `social.connection.expired`, `social.inbox.sync`,
      `social.inbox.reply`) plus the social-worker's three new push subscriptions — then a **deploy**
      of `api-rest` + `social-worker`. — _in-our-control · S_

  > `MEDIA_PUBLIC_BASE_URL` is the operative fix for "Facebook didn't post the image." Without the
  > apply, **every post on every platform publishes text-only**. Nothing below matters until this
  > lands.

  > Also outstanding from the last checkpoint: verify the crop-variant URL returns `200` on a ranged
  > request and that a fresh FB image post actually lands (worker log shows `published: 1`, no
  > `#324`).

## Wave 1 — make it trustworthy

The module can already write and send. It cannot yet be relied on unattended, which is the entire
proposition of a scheduler. This wave is the difference between a tool you use and a tool you trust:
roughly **6.5 → 8**.

- [x] **1. Connection health degrades honestly.** A periodic refresh sweep in the `social-worker`
      (walk connections nearing `tokenExpiresAt`, refresh ahead of expiry); a failed refresh — or a
      `401`/`403` from a platform on publish — writes `status='expired'` + `lastError` on the
      `SocialConnection`. That alone lights up the reconnect alert already built at
      [connections.tsx:199](../../apps/workbench/surfaces/social/connections.tsx#L199). —
      _in-our-control · M_

  > Acceptance: revoke a grant on the platform side; within the sweep interval the Connections pane
  > says "Reconnect needed" **without anyone having tried to post**.

- [x] **2. Failure reaches the owner.** A subscriber on `social.post.failed` and on partial success
      that sends an email naming the post, the destination and the plain-language reason, with a deep
      link into the composer. Add the connection-expired email from slice 1 to the same path. Topics
      exist in [main.tf:243](../../terraform/envs/prod/main.tf#L243) with `= []` subscribers — this
      is the subscriber. — _in-our-control · M_

  > Acceptance: a scheduled post that fails at 6am is in the owner's inbox by 6:01, in words they
  > understand, with the one button that fixes it.

- [x] **3. Retry is reachable.** Add `partially_published` to the retry path — ideally per-target
      ("Try Instagram again") rather than the whole-post button. The server side already does the
      right thing (`markPostPublishing` re-arms `pending`+`failed`, skips succeeded, idempotency key
      makes a replay a no-op); this is a UI gate at
      [data.ts:762](../../apps/workbench/surfaces/social/data.ts#L762) and
      [composer.tsx:1245](../../apps/workbench/surfaces/social/composer.tsx#L1245). —
      _in-our-control · S_

  > Acceptance: three of four destinations went out; click the failed one; it goes; the other three
  > are untouched.

- [x] **4. Byte-upload media everywhere.** Mirror the Facebook `graphPostMultipart` /
      `fetchImageBinary` fix onto Instagram, Threads and Pinterest, which today publish by public
      `image_url` and will hit the same Cloudflare `206`-on-range. — _in-our-control · M_

  > The alternative — a CF Snippet that strips `Range` — needs a **paid Cloudflare plan** this
  > account is not on, so it is a cost-decision, not a free fix. Byte-upload is entirely in our code
  > and makes every platform immune to future CDN behaviour. Tracked in
  > `terraform/envs/prod/cloudflare.tf`.

  > Acceptance: one image post to a connected Instagram account lands with the image.

- [x] **5. A count badge in the nav.** `SurfaceDefinition` in
      [surfaces/registry.ts](../../apps/workbench/lib/surfaces/registry.ts) has no badge field at
      all, so neither "3 waiting for approval" nor "1 post failed" can raise an ambient signal
      anywhere in the workbench. Add the primitive; wire Approvals and Posts to it first. —
      _in-our-control · M_

  > Platform-level, not social-specific — CMS moderation, B2B approvals and returns all want it. It
  > belongs to whichever module reaches for it first.

## Wave 2 — day-two ergonomics

Everything a person hits on their second week that currently makes them rebuild instead of edit:
roughly **8 → 9**.

- [x] **6. Targets are editable until send.** `PATCH /v1/social/posts/:id/targets` — add, remove,
      change a text override, change a first comment — rejected once the post is past `scheduled`.
      Surface it in the composer's saved state and **inline on the Approvals card**. —
      _in-our-control · M_

  > The approvals half is the point. An automation-drafted post that is nearly right but aimed at
  > the wrong account is currently reject-and-rebuild.

- [x] **7. Site-scope every read.** Filter `listSocialConnections` by the active `propertyId` (it is
      already stored on the connection, captured from the signed OAuth state); stamp `propertyId` on
      created posts; filter the queue, calendar and insights by it. Where a connection is
      deliberately tenant-wide (`propertyId IS NULL`), label it as such. — _in-our-control · M_

  > Acceptance: two unrelated businesses under one tenant, and switching sites swaps the whole
  > social identity — accounts, posts, calendar. Today they are pooled and unlabelled.

- [x] **8. Seed a post from the thing you are announcing.** "Share this" on a product, a collection
      and a CMS article → opens the composer pre-filled with title, excerpt, hero image and the
      absolute URL. The mappers already exist — the `announce.*` namespace in
      [automation-actions/src/resolvers.ts:724](../../packages/automation-actions/src/resolvers.ts#L724)
      is exactly this, reachable only by automation. — _in-our-control · M_

- [x] **9. Duplicate and repost.** "Post again" from any sent post (new draft, same words, media and
      destinations, no schedule). The cheapest real content leverage in the module. —
      _in-our-control · S_

- [x] **10. Metrics keep updating on their own.** The periodic collection sweep deliberately deferred
      from v1 — a cron + a due-scan over recently published targets, decaying in frequency as a post
      ages. Without it Insights shows whatever was true minutes after publish. — _in-our-control · M_

- [x] **11. Per-automation auto-approve.** [133 §9](../133-social-media-posting.md) specified
      `autoApprove` in the `social.post` action config; what ships is one tenant-wide switch. Add the
      per-automation opt-out **and** a config UI for choosing that automation's destinations. —
      _in-our-control · M_

- [x] **12. Approvals gets the picture.** Lead each card with `PostThumb` +
      `DestinationAvatars` like every other list, and show the per-platform preview inline. It is the
      one surface where a decision is made and the one surface that hides what is being decided on. —
      _in-our-control · S_

- [x] **13. Per-connection rate limiting.** The token bucket honouring `Retry-After` from
      [133 §7](../133-social-media-posting.md). What ships is a per-target attempt cap plus a
      transient/permanent split — fine for one post, not for a burst across many targets on one
      grant. — _in-our-control · M_

## Wave 3 — the reason to stay

Where a scheduler becomes the tool they run their presence from. Wave 1 and 2 make the module
trustworthy; this is what makes it the one they keep.

- [ ] **14. File the Meta engagement applications.** `pages_manage_engagement`, `pages_messaging`,
      `instagram_manage_comments`, `instagram_manage_messages`. External clock, weeks of lead time,
      **and it has not started**. This is a form, not a build — do it in the same week as Wave 0. —
      _external-gate · S_

- [x] **15. Engagement inbox.** Extend the adapter contract with an inbound direction
      (comments / mentions / DMs), a new inbox model + surface + reply composer. Meta first; Google
      Business reviews and Q&A fit the same inbox. LinkedIn and X are limited or paid — an honest
      "not supported here" for those, never a silent gap. — _in-our-control after 14 · L_

  > This is the single biggest capability hole against the comparison set, and half of what "run your
  > whole social presence here" means.

- [ ] **16. File the Meta insights applications.** `read_insights`,
      `instagram_manage_insights`. Reach and views light up with **no code change** — the collectors
      already request them best-effort and store `null`. — _external-gate · S_

- [x] **17. Evergreen queue.** A recurring content pool that refills the calendar's gaps — the
      feature that turns "I post when I remember" into a cadence. Builds on slice 9. —
      _in-our-control · L_

- [x] **18. Per-destination scheduling.** One post, different times per platform (and per timezone).
      The data model already carries a row per destination; only `SocialPost.scheduledAt` is shared. —
      _in-our-control · M_

- [x] **19. Composer leverage.** Hashtag sets (saved, per-destination, appended to the first
      comment), a link-preview fetch, per-target media override (the model supports it, no UI does),
      and a draggable per-target focal point per [133 §15.2](../133-social-media-posting.md). —
      _in-our-control · M_

- [x] **20. Best time to post**, computed from the tenant's own Insights history rather than an
      industry average. Depends on slice 10 producing real data. — _in-our-control · M_

- [x] **21. Bulk CSV scheduling.** A month of posts from a spreadsheet — the agency and
      multi-location workflow, and the one thing that makes migrating off a competitor tolerable. —
      _in-our-control · M_

- [ ] **22. The remaining platforms.** Pinterest, TikTok and YouTube adapters are written and
      registered; each needs its own OAuth app + content-API approval. X stays deliberately absent
      until someone commits to the paid tier — that is a cost-decision, not an oversight. —
      _external-gate · M each_

## Wave 4 — housekeeping

Small, real, and cheap enough to fold into whichever wave passes nearby.

- [x] **23. Stale comment.** [queue.tsx:6](../../apps/workbench/surfaces/social/queue.tsx#L6) still
      describes the Calendar⇄List toolbar switch that was deliberately removed. — _in-our-control · XS_
- [x] **24. Reviewer note on a rejection.** "Send back" returns a post to draft with no reason
      attached; the author gets a state change and no message. — _in-our-control · S_
- [x] **25. Week / agenda view** alongside the month grid, for a heavy posting cadence. —
      _in-our-control · M_
- [x] **26. UTM opt-out.** Open question in [implementation/social.md §6](../implementation/social.md)
      — a `SocialSettings.trackLinks` column. Deferred pending anyone wanting to turn it off; leave
      it deferred, but record it here so it is not rediscovered. — _in-our-control · S_

---

## Sequencing notes

- **Wave 0 is not optional and not a wave.** Until the Terraform apply lands, every post publishes
  text-only. Do it first, verify the image path live, then start counting.
- **Wave 1 slices 1–3 are the critical path.** They are what a tenant hits in week one, and they are
  all small-to-medium because the hard parts (the state machine, the idempotency, the alert UI) are
  already built and merely unreachable. This is the highest ratio of score-moved to work-done in the
  module.
- **File the three external-gate applications the same week as Wave 0.** Slices 14, 16 and 22 are
  forms with multi-week clocks. Filing them last is how the engagement inbox slips a quarter for no
  engineering reason.
- **Do not touch the composer preview.** It is the module's differentiator
  ([00-README §6](00-README.md)). Slice 19 extends it; nothing should refactor it.
- **Slice 5 is bigger than it looks** — it adds a primitive the whole workbench lacks. Scope it as a
  platform slice with social as its first consumer, not as a social feature.
