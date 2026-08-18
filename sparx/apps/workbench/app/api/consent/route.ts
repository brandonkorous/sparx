// Records the operator's analytics decision against their ACCOUNT.
//
// ── WHY THE WRITE LIVES HERE AND NOT IN api-rest ────────────────────────────
//
// `GET /v1/me/preferences` serves the record and deliberately refuses to patch
// it (see wizeworks/services/api-rest routes/v1/me.ts). That is not an oversight:
// api-rest is the API the browser calls with a token the browser holds, so
// accepting a consent patch there would give the tracked surface a way to change
// its own tracking permission. The decision has to be taken somewhere that
// authenticates the person by session, on the surface where they deal with the
// vendor.
//
// Piggles has a separate account app on its own domain for exactly that, and
// writes it there. sparx does not — the workbench IS where a sparx operator
// manages their own account — so the write is here, in the app that owns Better
// Auth, behind the same session cookie that owns everything else about them.
//
// ── WHAT IT WILL NOT DO ─────────────────────────────────────────────────────
//
// It writes only when a person answers. There is no default write, no "record
// false on first sight", no backfill — because a value that nobody chose is
// indistinguishable from one they did, and the whole point of the three-state
// record is that "never asked" stays visible until it is answered.

import { NextResponse } from 'next/server';
import { getSession } from '@wizeworks/auth';
import { withTenant } from '@wizeworks/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { analytics?: unknown } | null;
  // Strictly a boolean. A missing or non-boolean value is not "no" — it is a
  // malformed request, and answering it as a refusal would record a decision the
  // person did not make.
  if (typeof body?.analytics !== 'boolean') {
    return NextResponse.json({ error: 'analytics must be true or false' }, { status: 400 });
  }
  const analytics = body.analytics;

  // `withTenant` rather than a bare write: `users` carries a
  // `tenant_id = current_tenant_id()` policy, and an update issued without the
  // GUC set matches no rows and reports success having changed nothing — which
  // would leave somebody being asked the same question forever.
  await withTenant({ tenantId: session.user.tenantId }, async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });
    const base =
      before?.preferences &&
      typeof before.preferences === 'object' &&
      !Array.isArray(before.preferences)
        ? (before.preferences as Record<string, unknown>)
        : {};

    await tx.user.update({
      where: { id: session.user.id },
      // MERGED, never assigned — `users.preferences` also carries view defaults
      // and tour outcomes, and replacing the object would silently drop them.
      //
      // Written as an inline literal rather than through a named interface: a
      // named type has no implicit index signature, so Prisma's `InputJsonObject`
      // refuses it and the fix would be a cast — which would go on compiling
      // after somebody adds a `Date` or an `undefined` to the shape.
      data: {
        preferences: { ...base, consent: { analytics, at: new Date().toISOString() } },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
