import { withTenant } from '@wizeworks/db';

// The consent decision, stored on the ACCOUNT rather than in a cookie.
//
// ── WHY NOT A COOKIE ────────────────────────────────────────────────────────
//
// Piggles has one optional tracker and it runs on mypiggles.com. The decision is
// made here, on getpiggles.com, because getpiggles.com is where a customer deals
// with WizeWorks — their subscription, their details, and this. Those are two
// separate registrable domains and cannot share a cookie, which is the same fact
// that forces the auth handoff to exist.
//
// So the record travels the only way it can: on the user row, which both
// surfaces already read. `users.preferences` is the per-user JSON blob that
// already carries view defaults and tour outcomes, and the API that serves it
// (GET /v1/me/preferences) preserves keys it does not own — so this needed no
// migration, no table, and no new endpoint.
//
// ── THE THREE STATES, AND WHY THE KEY'S ABSENCE MATTERS ─────────────────────
//
// A recorded decision needs three states, not two, and only one of them is
// storable as `false`:
//
//   • key ABSENT   — never asked. The handoff stops here and asks.
//   • analytics:false — asked, declined. Never asked again.
//   • analytics:true  — asked, granted.
//
// Collapsing "never asked" into "declined" is the failure this whole seam exists
// to prevent: it looks identical on screen and in the database, and it is how
// somebody ends up either measured without being asked or never asked at all.
// Nothing here ever writes a default — a value only lands when a person answers.
//
// ── WHAT IS DELIBERATELY NOT STORED ─────────────────────────────────────────
//
// The other consent categories the platform's vocabulary knows about —
// `preferences`, `marketing`. Nothing in Piggles sets either, so writing
// `marketing: false` would record a decision about a question nobody was asked.
// When something does set one, it gets its own key, and its ABSENCE from every
// existing record is exactly what will make everybody get asked again. That is
// the correct behaviour and it comes for free.

/** The one optional thing Piggles runs, and when the person answered. */
export interface ConsentRecord {
  /** PostHog product analytics inside the console. */
  analytics: boolean;
  /** ISO timestamp of the answer. Consent that cannot be dated cannot be
   *  evidenced, and "when did they agree" is the first question anybody asks. */
  at: string;
}

/** The shape of the `consent` branch as it sits in `users.preferences`. */
function parse(raw: unknown): ConsentRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  // A malformed record reads as NO decision rather than as a grant. The failure
  // mode has to fall the safe way — the cost of asking twice is a screen; the
  // cost of guessing "yes" is measuring somebody who never said so.
  if (typeof obj.analytics !== 'boolean') return null;
  return { analytics: obj.analytics, at: typeof obj.at === 'string' ? obj.at : '' };
}

/** The user's recorded decision, or null if they have never been asked.
 *
 *  `withTenant` rather than a bare `prisma.user` read: `users` carries a
 *  `tenant_id = current_tenant_id()` policy, and a query issued without the GUC
 *  set matches nothing — which would report as "never asked" and re-ask a person
 *  who has already answered, every single time. */
export async function readConsent(userId: string, tenantId: string): Promise<ConsentRecord | null> {
  const row = await withTenant({ tenantId }, (tx) =>
    tx.user.findUnique({ where: { id: userId }, select: { preferences: true } })
  );
  const prefs = row?.preferences;
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return null;
  return parse((prefs as Record<string, unknown>).consent);
}

/** Record an answer.
 *
 *  Read-modify-write, MERGED — never assigned. `users.preferences` is shared:
 *  view defaults, notification preferences and tour outcomes all live in the
 *  same blob, and replacing the object would silently drop every one of them.
 *  The same rule the tour writer and the preferences endpoint both follow. */
export async function writeConsent(
  userId: string,
  tenantId: string,
  analytics: boolean
): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    const base =
      before?.preferences &&
      typeof before.preferences === 'object' &&
      !Array.isArray(before.preferences)
        ? (before.preferences as Record<string, unknown>)
        : {};

    await tx.user.update({
      where: { id: userId },
      // Written as an INLINE literal rather than through a `ConsentRecord`
      // variable. A named interface has no implicit index signature, so Prisma's
      // `InputJsonObject` refuses it and the fix would be a cast — and a cast
      // here is exactly the thing that would go on compiling after somebody adds
      // a `Date` or an `undefined` to the shape. An anonymous literal is checked
      // structurally, so the compiler keeps doing the work.
      data: { preferences: { ...base, consent: { analytics, at: new Date().toISOString() } } },
    });
  });
}
