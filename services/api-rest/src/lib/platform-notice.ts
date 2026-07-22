// Platform notices — the narrow, deliberate exception to "notification rows are
// derived, never inlined" (docs/124, 86-notifications.prisma).
//
// THE LINE: is sparx a party to this conversation?
//
// Almost every notification is about the TENANT'S OWN BUSINESS — an order fails,
// stock runs out, a visitor leaves feedback on their site, a task lands on a
// colleague. Who hears about those, under what conditions, and when, is the
// business owner's decision. That is policy, it is theirs to author and edit,
// and it belongs in the rule engine: producers publish a domain event and the
// `platform.notify` AUTOMATION ACTION writes the rows, inheriting conditions,
// gates, versioning and the run ledger. Nothing in that category belongs here.
//
// A small number of notices are not about the tenant's business at all. They are
// correspondence between sparx and the person running the account: they wrote to
// us from the workbench, and we answered. The tenant is not the sender, cannot
// choose the audience, and would never author a rule for it — "notify me when my
// software vendor replies to me" is not a business rule, and there is no sane
// version of it switched off. Those are platform mechanics, and they are written
// here, in the transaction that caused them.
//
// Worth stating because it is the distinction that is easy to get wrong: this is
// NOT "1:1 versus fan-out". A task assigned to one named person is also 1:1, and
// it is still emphatically the tenant's policy — their assignment rules, their
// quiet hours. The axis is OWNERSHIP, not recipient count.
//
// Three concrete properties follow from being platform mechanics, and each one
// is a reason the automation path cannot serve this case:
//
//   1. It cannot be LOST. The automation fan-in is explicitly best-effort —
//      `pubsub.ts` swallows tee failures with "one missed automation trigger is
//      recoverable". True of a marketing rule; false of "we answered you".
//      Written here, the row lands in the same transaction as the reply, so a
//      reply cannot exist without its notice.
//   2. It cannot be OPTIONAL. Rules are tenant-authored and there is no seeded
//      system-rule concept, so via automation a tenant who never wrote the rule
//      would silently stop hearing back from us.
//   3. It cannot FAN OUT. `platform.notify` resolves recipients by ROLE and
//      pledges "addressed to same-tenant staff". A feedback reply sent to every
//      owner would publish one person's private correspondence to their
//      colleagues — the precise opposite of docs/112 §9.
//
// This mirrors the email pipeline exactly: outbound mail defaults to publishing
// `email.send`, with a stated, narrow escape hatch for flows that cannot tolerate
// the queue (OTP). Same discipline, same shape of exemption.
//
// Adding a caller here needs an answer to the question at the top. If sparx is
// not a party to it, it is a rule, and it belongs in the engine.

import type { Prisma } from '@sparx/db';

export type NoticeSeverity = 'info' | 'success' | 'warning' | 'danger';

export interface PlatformNotice {
  tenantId: string;
  /** The one person this concerns. Null is tolerated (see below), not an error. */
  userId: string | null;
  /** Namespaced kind, e.g. `feedback.replied`. Consumers map it to a surface. */
  kind: string;
  title: string;
  body?: string | null;
  /** Module slug for the row's hue; null for account-level notices, which these
   *  usually are — a message from sparx belongs to no business module. */
  module?: string | null;
  severity?: NoticeSeverity;
  /** What it concerns, so a consumer can deep-link without a stored route. */
  entityType?: string | null;
  entityId?: string | null;
}

const MAX_TITLE = 255;

/**
 * Writes one notice addressed to one person.
 *
 * `tx` MUST be a tenant-scoped client (inside `withTenant` / `withRequestTenant`)
 * — `notifications` is FORCE-RLS, so a bare client writes nothing.
 *
 * Returns whether a row was written. A null `userId` is a real state rather than
 * a fault: the submitter FK is `SET NULL` on user delete, and a deleted account
 * has no bell to ring. The caller's work must not fail because the person it
 * concerned is gone.
 */
export async function writePlatformNotice(
  tx: Prisma.TransactionClient,
  notice: PlatformNotice
): Promise<boolean> {
  if (!notice.userId) return false;

  await tx.notification.create({
    data: {
      tenantId: notice.tenantId,
      userId: notice.userId,
      kind: notice.kind,
      // Truncated rather than rejected: an over-long title is cosmetic, and
      // throwing here would roll back the thing the notice is about.
      title: notice.title.slice(0, MAX_TITLE),
      body: notice.body ?? null,
      module: notice.module ?? null,
      severity: notice.severity ?? 'info',
      entityType: notice.entityType ?? null,
      entityId: notice.entityId ?? null,
    },
  });

  return true;
}
