// The single allocation table for Postgres ADVISORY LOCK keys.
//
// Every background tick in the platform guards itself with
// `pg_try_advisory_lock(<key>)` so that exactly one pod runs it at a time. That
// works only if each tick owns a DISTINCT key — two ticks sharing one do not
// merely race, they MUTUALLY EXCLUDE: whichever grabs it first makes the other
// silently no-op for that interval, reporting `acquired: false` as though a
// sibling pod were already working. The skipped tick logs nothing alarming and
// simply does not run.
//
// Keys were previously declared as bare literals next to each tick, and by the
// time this file was written FOUR PAIRS had collided:
//
//   4242_4243  webhook delivery      ↔  sitebuilder publish
//   4242_4244  email dispatch        ↔  media GC
//   4242_4246  email provisioning    ↔  scheduling calendar sync
//   4242_4247  scheduling series     ↔  module provisioning
//
// The last of those carried the comment "distinct from the other api-rest
// ticks" — which was false when written. That is the whole argument for this
// file: a claim of uniqueness is worthless when the thing it refers to is
// scattered across nine modules, because nobody can check it. Here, a collision
// is visible on one screen.
//
// RULES
//   · Add a key here, never inline at the call site.
//   · Never reuse or renumber an existing key — a rolling deploy runs old and
//     new pods together, and a renumbered key means both think they hold the
//     lock, which is the exact failure this table prevents.
//   · Keep the list contiguous and append at the end.
//
// ─────────────────────────────────────────────────────────────────────────
// Use these keys ONLY through `withAdvisoryTickLock` (./advisory-tick-lock).
//
// The original acquire/release pattern LEAKED:
//
//     await prisma.$queryRaw`SELECT pg_try_advisory_lock(${KEY}::int)`
//     ...work...
//     await prisma.$queryRaw`SELECT pg_advisory_unlock(${KEY}::int)`
//
// `pg_advisory_lock` is SESSION-scoped, but `prisma.$queryRaw` runs on whatever
// pooled connection is free — so the acquire could land on connection A and the
// release on connection B, where the unlock returns false (B is not the holder)
// and is discarded, leaving the lock held on A. A tick could thus permanently
// lose its own lock: every later run saw `acquired: false`, logged "held by
// another pod, skipping", and never ran again until the pod restarted (scheduled
// publishes / queued email silently stopping, no error). Observed directly in
// pg_locks against idle sessions, and it made the tick suites flaky (pass in
// isolation, fail in a full run).
//
// `withAdvisoryTickLock` fixes it with `pg_try_advisory_xact_lock` — a
// transaction-scoped lock Postgres releases automatically at commit/rollback on
// the SAME connection, so acquire and release can no longer split. All twelve
// ticks were migrated to it. Do not reintroduce a raw session lock here.
// ─────────────────────────────────────────────────────────────────────────

export const ADVISORY_LOCKS = {
  /** wizeworks/services/api-rest — scheduled content publish tick. */
  SCHEDULED_PUBLISH: 4242_4242,
  /** wizeworks/packages/api-core — outbound webhook delivery tick. */
  WEBHOOK_DELIVERY: 4242_4243,
  /** wizeworks/services/api-rest — due scheduled-send dispatch tick. */
  EMAIL_DISPATCH: 4242_4244,
  /** wizeworks/services/api-rest — scheduling notification tick. */
  SCHEDULING_NOTIFICATIONS: 4242_4245,
  /** wizeworks/services/api-rest — email default provisioning reconcile sweep. */
  EMAIL_PROVISIONING_RECONCILE: 4242_4246,
  /** wizeworks/services/api-rest — recurring scheduling series materialization. */
  SCHEDULING_SERIES: 4242_4247,
  /** wizeworks/services/api-rest — scheduling waitlist tick. */
  SCHEDULING_WAITLIST: 4242_4248,
  /** wizeworks/packages/automation — automation run tick. */
  AUTOMATION_RUN: 4242_4250,

  // ── Assigned when the collisions above were split apart ────────────────
  /** wizeworks/services/api-rest — sitebuilder scheduled publish (was colliding with
   *  WEBHOOK_DELIVERY). */
  SITEBUILDER_PUBLISH: 4242_4251,
  /** wizeworks/services/api-rest — media garbage collection (was colliding with
   *  EMAIL_DISPATCH). */
  MEDIA_GC: 4242_4252,
  /** wizeworks/services/api-rest — scheduling calendar sync (was colliding with
   *  EMAIL_PROVISIONING_RECONCILE). */
  SCHEDULING_CALENDAR_SYNC: 4242_4253,
  /** wizeworks/services/api-rest — module provisioning reconcile (was colliding with
   *  SCHEDULING_SERIES). */
  MODULE_PROVISIONING_RECONCILE: 4242_4254,
  /** wizeworks/services/api-rest — social scheduled-post drain (docs/133 §7): flips due
   *  `scheduled` social posts to `publishing` + emits `social.post.due`. */
  SOCIAL_SCHEDULED_PUBLISH: 4242_4255,
  /** wizeworks/services/api-rest — social connection health sweep: refreshes grants ahead of
   *  expiry and flips a grant that can no longer refresh to `expired`, so a dead
   *  account surfaces as "reconnect needed" before a post is lost. */
  SOCIAL_CONNECTION_HEALTH: 4242_4256,
  /** wizeworks/services/api-rest — per-destination scheduled drain: a fan-out row carrying its
   *  OWN `scheduled_at` fires on its own clock, independent of its siblings. */
  SOCIAL_TARGET_SCHEDULED_PUBLISH: 4242_4257,
  /** wizeworks/services/api-rest — social post-metrics sweep: re-reads a published post's
   *  numbers on a cadence that decays with its age. */
  SOCIAL_METRICS_SWEEP: 4242_4258,
  /** wizeworks/services/api-rest — engagement-inbox poll: pulls comments/mentions/reviews for
   *  each enabled destination. */
  SOCIAL_INBOX_SYNC: 4242_4259,
  /** wizeworks/services/api-rest — evergreen slot filler: schedules the least-recently-used
   *  evergreen post into the next empty auto-fill posting slot. */
  SOCIAL_SLOT_FILL: 4242_4260,
  /** services/automation-worker — email-sequence enrollment drain: advances each
   *  due enrollment (send the current step, schedule the next, exit on goal). */
  EMAIL_SEQUENCE_DRAIN: 4242_4261,
  /** wizeworks/services/api-rest — golden-blueprint reconcile: back-fills the default site
   *  install onto any tenant PRIMARY property that still carries none. */
  GOLDEN_BLUEPRINT_RECONCILE: 4242_4262,
  /** wizeworks/services/api-rest — blueprint-backfill reconcile: materializes an installed
   *  blueprint's slice for a module the tenant enabled AFTER install. */
  BLUEPRINT_BACKFILL_RECONCILE: 4242_4263,
} as const;

export type AdvisoryLockName = keyof typeof ADVISORY_LOCKS;
