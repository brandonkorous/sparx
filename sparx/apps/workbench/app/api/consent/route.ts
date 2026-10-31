// Records the operator's analytics decision against their ACCOUNT.
//
// ── WHY THE WRITE GOES THROUGH HERE AND NOT THE PUBLIC API ──────────────────
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
// manages their own account — so the write is here, behind the same session
// cookie that owns everything else about them. api-rest's session-authenticated
// route does the write (`/auth/sparx/platform/consent`, docs/154), under the
// person's HOME business: RLS refuses the write from a business they joined
// (sparx persona issue 122).
//
// ── WHAT IT WILL NOT DO ─────────────────────────────────────────────────────
//
// It writes only when a person answers. There is no default write, no "record
// false on first sight", no backfill — because a value that nobody chose is
// indistinguishable from one they did, and the whole point of the three-state
// record is that "never asked" stays visible until it is answered.

import { NextResponse } from 'next/server';
import { platformRequest, PlatformRequestError } from '@wizeworks/auth-client-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as { analytics?: unknown } | null;
  // Strictly a boolean. A missing or non-boolean value is not "no" — it is a
  // malformed request, and answering it as a refusal would record a decision the
  // person did not make.
  if (typeof body?.analytics !== 'boolean') {
    return NextResponse.json({ error: 'analytics must be true or false' }, { status: 400 });
  }

  try {
    // MERGED into `users.preferences`, never assigned: it also carries view
    // defaults and tour outcomes.
    await platformRequest('consent', {
      body: { analytics: body.analytics },
      requestHeaders: request.headers,
    });
  } catch (err) {
    if (err instanceof PlatformRequestError && err.status === 401) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
