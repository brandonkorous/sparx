import type { Prisma } from '@wizeworks/db';

// HOW MANY PEOPLE ARE ON THIS TEAM — asked once, so the two readers cannot
// disagree.
//
// ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
//
// Both the nightly snapshot and the live report counted `user`:
//
//     safe(() => withTenant(ctx, (tx) => tx.user.count()))
//
// `users` is the platform's login table and carries a `tenant_id` naming the
// account the login was CREATED under. That is not the same question. A person
// joins a team by accepting an invitation, and if they signed up on their own
// first — which is one of the two doors the invitation offers — their user row
// is stamped with their own workspace forever. They are an active member of
// somebody else's team and they never move the meter.
//
// MEASURED 2026-09-30: 4 of 40 members on the platform hold a user row stamped
// with a different tenant, and one of those four was produced by walking the
// ordinary invitation flow from end to end. Juniper Row, with two people on its
// team, read "People on your team: 1" on the card headed "What changes your
// bill is scale: how many people" (issue 882).
//
// The irony is in the live reader's own comment: seats is counted live, rather
// than read from last night's row, because "a person who has just invited a
// teammate and is looking at '3 of 3 users' would reasonably conclude the
// invitation failed". The count was made instant for exactly the case it could
// not see. [[feedback_a_screen_over_a_function_nobody_calls]]
//
// ── WHY INVITATIONS COUNT ───────────────────────────────────────────────────
//
// The Team roster settled this already, and a second screen answering the same
// question must not settle it differently:
//
//     "She either is or she isn't. If she was invited yesterday she is on the
//      team and hasn't logged in yet, which is a STATE, not a category."
//
// So the roster is one list of members and pending invitations, and its count
// in the toolbar includes both. A meter headed "People on your team" that said
// something smaller would make an owner who had just invited somebody go
// looking for what went wrong.
//
// `pending` AND unexpired, exactly as `GET /v1/team/invitations` filters, so
// the two lists are the same list. A withdrawn or lapsed invitation is holding
// nothing open and drops out on its own, with no sweep to run.
//
// ── WHY BOTH READERS SHARE THIS ─────────────────────────────────────────────
//
// The `locations` branch beside them learnt it the hard way and wrote it down:
// "the nightly snapshot and the live report have to agree or the card shows one
// number and the bill is worked out from another." Two copies of a count are
// two counts.

/** The minimum of a Prisma client this needs — whatever `withTenant` hands its
 *  callback. Typed structurally so a caller can pass a transaction or the
 *  client itself without this module knowing which. */
export interface SeatCountClient {
  member: { count: (args?: Prisma.MemberCountArgs) => Promise<number> };
  invitation: { count: (args?: Prisma.InvitationCountArgs) => Promise<number> };
}

/**
 * People on this team: everyone who can sign in, plus everyone who has been
 * asked and has not answered yet.
 *
 * Call it inside a tenant-scoped transaction — both tables are isolated by
 * `organization_id = current_tenant_id()`, so the scoping is the caller's
 * context and not a `where` clause here.
 */
export async function countSeats(tx: SeatCountClient, now: Date = new Date()): Promise<number> {
  const [members, invited] = await Promise.all([
    tx.member.count(),
    tx.invitation.count({ where: { status: 'pending', expiresAt: { gt: now } } }),
  ]);
  return members + invited;
}
